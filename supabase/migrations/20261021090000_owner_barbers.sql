-- Owner barber management (Figma 5.8–5.11). Each step is one transaction so a barber is
-- never half-saved. Called only by our server code with the service role, after it has
-- checked the caller is the owner. Invite tokens arrive already hashed.

-- Invite a new barber: creates the barber (status 'invited') with the shop's opening hours
-- as their starting working hours, plus a 7-day invite.
create function public.owner_invite_barber(p_email text, p_token_hash text, p_expires_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_barber_id uuid;
begin
  if exists (select 1 from public.barbers where lower(email) = v_email) then
    raise exception 'barber_email_taken' using errcode = 'P0001';
  end if;

  insert into public.barbers (email, status, sort_order)
  values (v_email, 'invited', coalesce((select max(sort_order) from public.barbers), 0) + 1)
  returning id into v_barber_id;

  insert into public.barber_hours (barber_id, weekday, is_open, starts_at, ends_at)
  select v_barber_id, weekday, is_open, opens_at, closes_at from public.opening_hours;

  insert into public.barber_invites (barber_id, token_hash, expires_at)
  values (v_barber_id, p_token_hash, p_expires_at);

  return v_barber_id;
end;
$$;

-- Resend: the old link stops working and a fresh 7-day one is issued.
create function public.owner_resend_invite(p_barber_id uuid, p_token_hash text, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.barbers where id = p_barber_id and status = 'invited') then
    raise exception 'barber_not_invited' using errcode = 'P0001';
  end if;

  update public.barber_invites
     set revoked_at = now()
   where barber_id = p_barber_id and accepted_at is null and revoked_at is null;

  insert into public.barber_invites (barber_id, token_hash, expires_at)
  values (p_barber_id, p_token_hash, p_expires_at);
end;
$$;

-- Save the barber page: which services they offer and their working hours.
-- p_hours: [{"weekday":1,"is_open":true,"starts_at":"09:00","ends_at":"18:00"}, ...] for all 7 days.
create function public.owner_save_barber(p_barber_id uuid, p_service_ids uuid[], p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.barbers where id = p_barber_id) then
    raise exception 'barber_not_found' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_hours) <> 7 then
    raise exception 'hours_need_seven_days' using errcode = 'P0001';
  end if;

  delete from public.barber_services where barber_id = p_barber_id;
  insert into public.barber_services (barber_id, service_id)
  select p_barber_id, s.id from public.services s where s.id = any (p_service_ids);

  delete from public.barber_hours where barber_id = p_barber_id;
  insert into public.barber_hours (barber_id, weekday, is_open, starts_at, ends_at)
  select p_barber_id,
         (h ->> 'weekday')::smallint,
         (h ->> 'is_open')::boolean,
         case when (h ->> 'is_open')::boolean then (h ->> 'starts_at')::time end,
         case when (h ->> 'is_open')::boolean then (h ->> 'ends_at')::time end
  from jsonb_array_elements(p_hours) as h;
end;
$$;

-- Deactivate or reactivate. A barber with upcoming bookings can't be deactivated: the
-- owner cancels those first (Figma 5.11).
create function public.owner_set_barber_active(p_barber_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not p_active and exists (
    select 1 from public.bookings
     where barber_id = p_barber_id
       and status in ('pending_payment', 'confirmed')
       and starts_at > now()
  ) then
    raise exception 'barber_has_upcoming_bookings' using errcode = 'P0001';
  end if;

  update public.barbers
     set status = case when p_active then 'active' else 'inactive' end::public.barber_status
   where id = p_barber_id and status in ('active', 'inactive');

  if not found then
    raise exception 'barber_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.owner_invite_barber(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.owner_resend_invite(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.owner_save_barber(uuid, uuid[], jsonb) from public, anon, authenticated;
revoke execute on function public.owner_set_barber_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.owner_invite_barber(text, text, timestamptz) to service_role;
grant execute on function public.owner_resend_invite(uuid, text, timestamptz) to service_role;
grant execute on function public.owner_save_barber(uuid, uuid[], jsonb) to service_role;
grant execute on function public.owner_set_barber_active(uuid, boolean) to service_role;
