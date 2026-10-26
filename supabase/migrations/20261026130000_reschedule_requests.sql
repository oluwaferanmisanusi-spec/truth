-- "Ask to reschedule" (decided with the shop on 2026-10-26; not in Figma). Instead of
-- cancelling, the owner or a manager can ask the customer to move a booking, with a reason.
-- The customer is emailed a link and may then, any time before the appointment:
--   * move it for free, even inside the 24-hour window, or
--   * cancel for a full refund, even inside the 24-hour window.
-- If they do neither, the booking stays confirmed and the owner follows up.
-- Moving the booking clears the request; cancelling leaves it on record.

alter table public.bookings
  add column reschedule_requested_at timestamptz,
  add column reschedule_reason       text check (char_length(reschedule_reason) <= 300),
  -- The emailed link's token (hash only), alongside the confirmation email's guest link.
  add column request_token_hash      text unique;

-- Same as 20261021150000, except a booking the shop asked to move may move inside the window.
create or replace function public.create_reschedule_hold(p_booking_id uuid, p_starts_at timestamptz)
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
     and starts_at > now()
     and (reschedule_requested_at is not null
          or starts_at - now() >= make_interval(hours => v_settings.refund_window_hours));
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

-- Same as 20261021150000, except the shop's request lifts the window and moving clears it.
create or replace function public.move_booking(p_hold_id uuid)
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
     and starts_at > now()
     and (reschedule_requested_at is not null
          or starts_at - now() >= make_interval(hours => v_settings.refund_window_hours))
   for update;
  if not found then
    raise exception 'booking_not_movable' using errcode = 'P0001';
  end if;

  v_old := v_original;
  delete from public.bookings where id = v_hold.id;

  begin
    update public.bookings
       set starts_at = v_hold.starts_at, ends_at = v_hold.ends_at, busy_until = v_hold.busy_until,
           reschedule_requested_at = null, reschedule_reason = null,
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

-- Same as 20261021150000, except a booking the shop asked to move is always refunded.
create or replace function public.customer_cancel_booking(p_booking_id uuid)
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
         refund_due = reschedule_requested_at is not null
                      or starts_at - now() >= make_interval(hours => v_settings.refund_window_hours),
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
