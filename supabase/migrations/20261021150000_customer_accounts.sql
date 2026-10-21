-- Phase 4: customer accounts, cancelling and rescheduling. Decided with the shop on 2026-10-21:
--   * the site sends its own verify-email (24 h) and reset-password (1 h) links via Resend
--   * guest bookings join an account only once its email is verified
--   * rescheduling keeps the same barber, any number of times, while 24+ h before the start
--   * customers cancelling 24+ h before get a full refund, otherwise none

-- ---------------------------------------------------------------------------
-- Email verification and one-time links

-- Our own record of a verified email. (Supabase's email_confirmed_at is set at sign-up so
-- unverified customers can still log in, as the design allows.)
alter table public.profiles add column email_verified_at timestamptz;
update public.profiles set email_verified_at = now() where role = 'owner';

create type public.auth_token_purpose as enum ('verify_email', 'reset_password');

-- Only a SHA-256 hash of each emailed token is stored. Server only: RLS on, no policies.
create table public.auth_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  purpose     public.auth_token_purpose not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index auth_tokens_user on public.auth_tokens (user_id, purpose, created_at desc);
alter table public.auth_tokens enable row level security;
revoke all on public.auth_tokens from anon, authenticated;

-- Moves bookings made as a guest with this account's email into the account. Returns how
-- many were added ("We added 2 bookings you made as a guest"). Call only after verifying.
create function public.merge_guest_bookings(p_user_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  with moved as (
    update public.bookings b
       set customer_id = p.id, updated_at = now()
      from public.profiles p
     where p.id = p_user_id
       and p.email_verified_at is not null
       and b.customer_id is null
       and lower(b.customer_email) = lower(p.email)
       and b.status in ('confirmed', 'completed', 'no_show', 'cancelled')
    returning b.id
  )
  select count(*)::integer from moved;
$$;

revoke execute on function public.merge_guest_bookings(uuid) from public, anon, authenticated;
grant execute on function public.merge_guest_bookings(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Rescheduling

-- A reschedule hold is a pending_payment row pointing at the booking it would replace.
-- It never gets a payment; "Move my booking" deletes it and moves the original.
alter table public.bookings
  add column reschedule_of uuid references public.bookings (id) on delete cascade;

-- Holds a new time with the same barber for the shop's hold_minutes. Raises
-- booking_not_movable (not confirmed, or under 24 h to go) or slot_taken. Server only.
create function public.create_reschedule_hold(p_booking_id uuid, p_starts_at timestamptz)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.shop_settings;
  v_original public.bookings;
  v_day      date;
  v_hold     public.bookings;
begin
  select * into v_settings from public.shop_settings where id;
  select * into v_original from public.bookings
   where id = p_booking_id
     and status = 'confirmed'
     and starts_at - now() >= make_interval(hours => v_settings.refund_window_hours);
  if not found then
    raise exception 'booking_not_movable' using errcode = 'P0001';
  end if;

  -- Release holds that ran out. This booking's earlier reschedule hold is removed outright,
  -- so an old tab can't still move the booking to the time the customer changed their mind on.
  delete from public.bookings where reschedule_of = v_original.id;
  update public.bookings
     set status = 'expired', updated_at = now()
   where status = 'pending_payment' and hold_expires_at <= now();

  v_day := (p_starts_at at time zone v_settings.time_zone)::date;
  if not exists (
    select 1 from public.available_slots(v_original.service_id, v_original.barber_id, v_day, v_day) a
    where a.starts_at = p_starts_at
  ) then
    raise exception 'slot_taken' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    customer_id, customer_name, customer_email, barber_id, any_barber, service_id,
    service_name, price_kobo, duration_minutes, buffer_minutes,
    starts_at, ends_at, busy_until, status, hold_expires_at, reschedule_of
  ) values (
    v_original.customer_id, v_original.customer_name, v_original.customer_email,
    v_original.barber_id, v_original.any_barber, v_original.service_id,
    v_original.service_name, v_original.price_kobo, v_original.duration_minutes, v_original.buffer_minutes,
    p_starts_at,
    p_starts_at + make_interval(mins => v_original.duration_minutes),
    p_starts_at + make_interval(mins => v_original.duration_minutes + v_original.buffer_minutes),
    'pending_payment',
    now() + make_interval(mins => v_settings.hold_minutes),
    v_original.id
  )
  returning * into v_hold;
  return v_hold;
exception when exclusion_violation then
  raise exception 'slot_taken' using errcode = 'P0001';
end;
$$;

revoke execute on function public.create_reschedule_hold(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.create_reschedule_hold(uuid, timestamptz) to service_role;

-- "Move my booking": the original takes the held time and the hold disappears, in one step.
-- If the hold ran out and someone else took the time, raises slot_taken and nothing changes.
create function public.move_booking(p_hold_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.shop_settings;
  v_hold     public.bookings;
  v_original public.bookings;
  v_old      public.bookings;
begin
  select * into v_settings from public.shop_settings where id;
  select * into v_hold from public.bookings
   where id = p_hold_id and reschedule_of is not null and status in ('pending_payment', 'expired')
   for update;
  if not found then
    raise exception 'hold_not_found' using errcode = 'P0001';
  end if;

  select * into v_original from public.bookings
   where id = v_hold.reschedule_of
     and status = 'confirmed'
     and starts_at - now() >= make_interval(hours => v_settings.refund_window_hours)
   for update;
  if not found then
    raise exception 'booking_not_movable' using errcode = 'P0001';
  end if;

  v_old := v_original;
  delete from public.bookings where id = v_hold.id;

  begin
    update public.bookings
       set starts_at = v_hold.starts_at, ends_at = v_hold.ends_at, busy_until = v_hold.busy_until,
           updated_at = now()
     where id = v_original.id
    returning * into v_original;
  exception when exclusion_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;

  insert into public.booking_changes (booking_id, old_starts_at, old_ends_at, new_starts_at, new_ends_at)
  values (v_original.id, v_old.starts_at, v_old.ends_at, v_original.starts_at, v_original.ends_at);

  return v_original;
end;
$$;

revoke execute on function public.move_booking(uuid) from public, anon, authenticated;
grant execute on function public.move_booking(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Customer cancels

-- Cancels a confirmed booking that hasn't started. 24+ h before: full refund, recorded
-- here and sent to Paystack by server code. Under 24 h: no refund. Returns the refund row,
-- or null when there's no refund. Server only (it checks who may cancel).
create function public.customer_cancel_booking(p_booking_id uuid)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.shop_settings;
  v_booking  public.bookings;
  v_payment  public.payments;
  v_refund   public.refunds;
begin
  select * into v_settings from public.shop_settings where id;
  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = 'customer',
         refund_due = starts_at - now() >= make_interval(hours => v_settings.refund_window_hours),
         updated_at = now()
   where id = p_booking_id
     and status = 'confirmed'
     and starts_at > now()
  returning * into v_booking;
  if not found then
    raise exception 'booking_not_cancellable' using errcode = 'P0001';
  end if;

  -- Its reschedule hold goes too.
  delete from public.bookings where reschedule_of = v_booking.id;

  if not v_booking.refund_due then
    return null;
  end if;

  select * into v_payment from public.payments
   where booking_id = v_booking.id and status = 'success'
   order by paid_at desc
   limit 1;
  if not found then
    return null;
  end if;

  insert into public.refunds (payment_id, amount_kobo)
  values (v_payment.id, v_payment.amount_kobo)
  returning * into v_refund;
  return v_refund;
end;
$$;

revoke execute on function public.customer_cancel_booking(uuid) from public, anon, authenticated;
grant execute on function public.customer_cancel_booking(uuid) to service_role;
