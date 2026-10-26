-- Review fixes (decided 2026-10-27).
--
-- 1. A payment that arrives after its hold ran out is confirmed only if that time could still
--    be booked now, by the same rules as a new booking (in the future with notice, shop and
--    barber open, no holiday, barber active and offering the service, no block, nobody else
--    on it). Otherwise it's refunded in full, as before.
-- 2. Refunds Paystack rejects are retried a few times over a day, then left for the owner:
--    the owner is told, refunds it in Paystack and marks it refunded on the Bookings page.

alter table public.refunds
  add column attempts          integer not null default 0,
  add column last_attempt_at   timestamptz,
  add column last_error        text check (char_length(last_error) <= 300),
  -- Automatic retries stopped; the owner has been told.
  add column gave_up_at        timestamptz,
  -- The owner or a manager refunded it themselves (in Paystack) and marked it here.
  add column settled_by_hand_at timestamptz,
  add column settled_by        uuid references public.profiles (id) on delete set null;

-- Same as 20261021120000, except a late payment re-checks the time before confirming.
create or replace function public.record_payment(
  p_reference   text,
  p_success     boolean,
  p_amount_kobo integer,
  p_paid_at     timestamptz,
  p_raw         jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking  public.bookings;
  v_payment  public.payments;
  v_settings public.shop_settings;
  v_day      date;
begin
  select * into v_booking from public.bookings where reference = p_reference for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;

  if not p_success then
    if v_payment.status = 'success' then
      return case when v_booking.status = 'confirmed' then 'already_confirmed' else 'refund_needed' end;
    end if;
    update public.payments set status = 'failed', raw = p_raw where id = v_payment.id;
    update public.bookings set status = 'expired', updated_at = now()
     where id = v_booking.id and status = 'pending_payment';
    return 'failed';
  end if;

  if v_payment.status = 'success' then
    return case when v_booking.status = 'confirmed' then 'already_confirmed' else 'refund_needed' end;
  end if;

  update public.payments
     set status = 'success', paid_at = p_paid_at, amount_kobo = p_amount_kobo, raw = p_raw
   where id = v_payment.id;

  if p_amount_kobo = v_booking.price_kobo and v_booking.status in ('pending_payment', 'expired') then
    -- The hold ran out: only confirm if this time could be booked now.
    if v_booking.status = 'expired' or v_booking.hold_expires_at <= now() then
      select * into v_settings from public.shop_settings where id;
      -- Release holds that ran out (this one too), so they don't count as taking the time.
      update public.bookings
         set status = 'expired', updated_at = now()
       where status = 'pending_payment' and hold_expires_at <= now();
      v_day := (v_booking.starts_at at time zone v_settings.time_zone)::date;
      if exists (
        select 1 from public.available_slots(v_booking.service_id, v_booking.barber_id, v_day, v_day) a
        where a.starts_at = v_booking.starts_at
      ) then
        begin
          update public.bookings set status = 'confirmed', updated_at = now() where id = v_booking.id;
          return 'confirmed';
        exception when exclusion_violation then
          -- Someone took the time a moment ago.
        end;
      end if;
    else
      begin
        update public.bookings set status = 'confirmed', updated_at = now() where id = v_booking.id;
        return 'confirmed';
      exception when exclusion_violation then
        -- Can't happen while the hold is live; refund to be safe.
      end;
    end if;
  end if;

  update public.bookings set status = 'expired', refund_due = true, updated_at = now()
   where id = v_booking.id;
  insert into public.refunds (payment_id, amount_kobo) values (v_payment.id, p_amount_kobo);
  return 'refund_needed';
end;
$$;

revoke execute on function public.record_payment(text, boolean, integer, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.record_payment(text, boolean, integer, timestamptz, jsonb) to service_role;
