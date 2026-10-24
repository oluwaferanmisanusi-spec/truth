-- Changes to the barber screens, decided with the shop on 2026-10-24:
--   * barber logins are barber-only (profiles.role = 'barber'); a barber is never also a
--     customer, so an invite can only be accepted by creating a new login
--   * whole-day blocks need notice: they must start at least leave_notice_days ahead

alter table public.shop_settings
  add column leave_notice_days integer not null default 3 check (leave_notice_days >= 0);

-- Barbers already set up with a login become barber-only.
update public.profiles p set role = 'barber'
  from public.barbers b
 where b.profile_id = p.id and p.role = 'customer';

-- As before, but the login must be a fresh customer login and becomes a barber login.
-- Raises invite_missing, invite_expired, email_mismatch or already_barber.
create or replace function public.accept_barber_invite(p_token_hash text, p_profile_id uuid, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite  public.barber_invites;
  v_barber  public.barbers;
  v_profile public.profiles;
begin
  select * into v_invite from public.barber_invites
   where token_hash = p_token_hash and accepted_at is null and revoked_at is null
   for update;
  if not found then
    raise exception 'invite_missing' using errcode = 'P0001';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  select * into v_barber from public.barbers where id = v_invite.barber_id and status = 'invited' for update;
  if not found then
    raise exception 'invite_missing' using errcode = 'P0001';
  end if;
  select * into v_profile from public.profiles where id = p_profile_id;
  if not found or lower(v_profile.email) <> lower(v_barber.email) then
    raise exception 'email_mismatch' using errcode = 'P0001';
  end if;
  if v_profile.role <> 'customer' or exists (select 1 from public.barbers where profile_id = p_profile_id) then
    raise exception 'already_barber' using errcode = 'P0001';
  end if;

  update public.barbers
     set profile_id = p_profile_id,
         full_name = coalesce(nullif(trim(p_full_name), ''), v_profile.full_name),
         status = 'active'
   where id = v_barber.id;
  update public.barber_invites set accepted_at = now() where id = v_invite.id;
  -- The invite link went to this email, so it counts as verified.
  update public.profiles
     set role = 'barber', email_verified_at = coalesce(email_verified_at, now())
   where id = p_profile_id;

  return v_barber.id;
end;
$$;

-- As before, plus the notice rule. Raises too_soon, no_open_days, in_the_past or
-- overlaps_booking.
create or replace function public.barber_block_days(p_barber_id uuid, p_from date, p_to date, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz     text;
  v_notice integer;
  v_today  date;
  v_day    record;
  v_count  integer := 0;
begin
  select time_zone, leave_notice_days into v_tz, v_notice from public.shop_settings where id;
  v_today := (now() at time zone v_tz)::date;
  if p_from < v_today then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;
  if p_from < v_today + v_notice then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;

  perform public.lock_barber_time(p_barber_id);

  for v_day in
    select (d.day + oh.opens_at) at time zone v_tz as starts_at,
           (d.day + oh.closes_at) at time zone v_tz as ends_at
    from (
      select g::date as day
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as g
    ) d
    join public.opening_hours oh on oh.weekday = extract(dow from d.day) and oh.is_open
    where not exists (select 1 from public.holidays h where h.date = d.day)
    order by 1
  loop
    perform public.check_block_range(p_barber_id, v_day.starts_at, v_day.ends_at, true);
    delete from public.time_blocks
     where barber_id = p_barber_id
       and tstzrange(starts_at, ends_at) && tstzrange(v_day.starts_at, v_day.ends_at);
    insert into public.time_blocks (barber_id, starts_at, ends_at, is_whole_day, reason)
    values (p_barber_id, v_day.starts_at, v_day.ends_at, true, nullif(trim(p_reason), ''));
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'no_open_days' using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;
