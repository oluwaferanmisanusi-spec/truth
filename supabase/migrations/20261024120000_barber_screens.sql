-- Phase 5 barber screens (Figma 4.1–4.15). Decided with the shop on 2026-10-24:
--   * one login per person: barber access comes from an active barbers row linked to the
--     profile, so a barber can still book as a customer, and deactivating them removes
--     the barber side without touching their account
--   * an invite is accepted by creating an account, or by logging in if the email already
--     has one
--   * "Mark as completed" from the start time, "Mark as no-show" from start + the grace
--     period; both are final
--   * blocks can't overlap bookings; whole days run from opening to closing and skip days
--     the shop is closed
-- Called only by our server code with the service role, after it has checked the caller.

-- ---------------------------------------------------------------------------
-- Accepting an invite

-- Links the invite's barber to a login and makes them active, in one step. The login's
-- email must be the invited one. Raises invite_missing, invite_expired, email_mismatch or
-- already_barber.
create function public.accept_barber_invite(p_token_hash text, p_profile_id uuid, p_full_name text)
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
  if exists (select 1 from public.barbers where profile_id = p_profile_id) then
    raise exception 'already_barber' using errcode = 'P0001';
  end if;

  update public.barbers
     set profile_id = p_profile_id,
         full_name = coalesce(nullif(trim(p_full_name), ''), v_profile.full_name),
         status = 'active'
   where id = v_barber.id;
  update public.barber_invites set accepted_at = now() where id = v_invite.id;
  -- The invite link went to this email, so it counts as verified.
  update public.profiles set email_verified_at = now()
   where id = p_profile_id and email_verified_at is null;

  return v_barber.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Outcomes

-- Records "completed" or "no_show" for the barber's own confirmed appointment. Raises
-- booking_not_found, already_recorded or too_early.
create function public.barber_record_outcome(p_barber_id uuid, p_booking_id uuid, p_outcome public.booking_status)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grace   integer;
  v_booking public.bookings;
begin
  if p_outcome not in ('completed', 'no_show') then
    raise exception 'invalid_outcome' using errcode = 'P0001';
  end if;
  select no_show_grace_minutes into v_grace from public.shop_settings where id;

  select * into v_booking from public.bookings
   where id = p_booking_id and barber_id = p_barber_id and reschedule_of is null
   for update;
  if not found or v_booking.status not in ('confirmed', 'completed', 'no_show') then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'already_recorded' using errcode = 'P0001';
  end if;
  if now() < v_booking.starts_at
     or (p_outcome = 'no_show' and now() < v_booking.starts_at + make_interval(mins => v_grace)) then
    raise exception 'too_early' using errcode = 'P0001';
  end if;

  update public.bookings
     set status = p_outcome, outcome_recorded_at = now(), outcome_recorded_by = p_barber_id,
         updated_at = now()
   where id = v_booking.id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Blocks never overlap bookings

-- Bookings and blocks for one barber take the same lock, so a customer paying for a time
-- and the barber blocking it at the same moment can't both succeed.
create function public.lock_barber_time(p_barber_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('barber_time:' || p_barber_id::text, 0));
$$;

-- A booking (or hold) can't land on blocked time. Raised as an exclusion violation, so the
-- booking engine treats it like any other taken time (tries the next barber, refunds a
-- late payment, says "slot taken").
create function public.bookings_not_in_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_barber_time(new.barber_id);
  if exists (
    select 1 from public.time_blocks tb
     where tb.barber_id = new.barber_id
       and tstzrange(tb.starts_at, tb.ends_at) && tstzrange(new.starts_at, new.ends_at)
  ) then
    raise exception 'time_blocked' using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger bookings_not_in_block
  before insert or update of barber_id, starts_at, ends_at, status on public.bookings
  for each row
  when (new.status in ('pending_payment', 'confirmed'))
  execute function public.bookings_not_in_block();

-- Raises overlaps_booking if a live booking or hold touches the range, overlaps_block if
-- another block does (unless p_replace_blocks, used by whole days to absorb shorter blocks).
create function public.check_block_range(
  p_barber_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_replace_blocks boolean
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.bookings bk
     where bk.barber_id = p_barber_id
       and public.booking_is_live(bk.status, bk.hold_expires_at)
       and tstzrange(bk.starts_at, bk.ends_at) && tstzrange(p_starts_at, p_ends_at)
  ) then
    raise exception 'overlaps_booking' using errcode = 'P0001';
  end if;
  if not p_replace_blocks and exists (
    select 1 from public.time_blocks tb
     where tb.barber_id = p_barber_id
       and tstzrange(tb.starts_at, tb.ends_at) && tstzrange(p_starts_at, p_ends_at)
  ) then
    raise exception 'overlaps_block' using errcode = 'P0001';
  end if;
end;
$$;

-- Part of a day (4.11). Must sit inside the shop's opening hours that day. Raises
-- shop_closed, outside_hours, in_the_past, overlaps_booking or overlaps_block.
create function public.barber_block_time(
  p_barber_id uuid, p_date date, p_from time, p_to time, p_reason text
)
returns public.time_blocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz    text;
  v_hours public.opening_hours;
  v_start timestamptz;
  v_end   timestamptz;
  v_block public.time_blocks;
begin
  select time_zone into v_tz from public.shop_settings where id;
  select * into v_hours from public.opening_hours where weekday = extract(dow from p_date) and is_open;
  if not found or exists (select 1 from public.holidays where date = p_date) then
    raise exception 'shop_closed' using errcode = 'P0001';
  end if;
  if p_from < v_hours.opens_at or p_to > v_hours.closes_at or p_to <= p_from then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;
  v_start := (p_date + p_from) at time zone v_tz;
  v_end := (p_date + p_to) at time zone v_tz;
  if v_end <= now() then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;

  perform public.lock_barber_time(p_barber_id);
  perform public.check_block_range(p_barber_id, v_start, v_end, false);

  insert into public.time_blocks (barber_id, starts_at, ends_at, is_whole_day, reason)
  values (p_barber_id, v_start, v_end, false, nullif(trim(p_reason), ''))
  returning * into v_block;
  return v_block;
end;
$$;

-- Whole days (4.11b): one opening-to-closing block per day the shop is open, replacing any
-- shorter blocks on those days. All or nothing. Raises no_open_days, in_the_past or
-- overlaps_booking. Returns how many days were blocked.
create function public.barber_block_days(p_barber_id uuid, p_from date, p_to date, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz    text;
  v_today date;
  v_day   record;
  v_count integer := 0;
begin
  select time_zone into v_tz from public.shop_settings where id;
  v_today := (now() at time zone v_tz)::date;
  if p_from < v_today then
    raise exception 'in_the_past' using errcode = 'P0001';
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

revoke execute on function public.accept_barber_invite(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.barber_record_outcome(uuid, uuid, public.booking_status) from public, anon, authenticated;
revoke execute on function public.lock_barber_time(uuid) from public, anon, authenticated;
revoke execute on function public.check_block_range(uuid, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.barber_block_time(uuid, date, time, time, text) from public, anon, authenticated;
revoke execute on function public.barber_block_days(uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.accept_barber_invite(text, uuid, text) to service_role;
grant execute on function public.barber_record_outcome(uuid, uuid, public.booking_status) to service_role;
grant execute on function public.barber_block_time(uuid, date, time, time, text) to service_role;
grant execute on function public.barber_block_days(uuid, date, date, text) to service_role;
