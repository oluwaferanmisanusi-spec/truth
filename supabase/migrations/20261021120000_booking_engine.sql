-- Phase 3 booking engine: which times are free, holding a time for 10 minutes, and
-- recording the Paystack result. Rules decided with the shop on 2026-10-21:
--   * start times every 15 minutes; a cut blocks its length + the service's clean-up buffer
--   * book up to 4 weeks ahead, and at least 24 hours before the start (walk-ins cover today)
--   * "any available barber" goes to the free barber with the fewest bookings that day
--   * a payment that lands after the hold ran out is kept if the time is still free,
--     otherwise it is refunded

alter table public.shop_settings
  add column slot_step_minutes    integer not null default 15 check (slot_step_minutes > 0),
  add column min_notice_hours     integer not null default 24 check (min_notice_hours >= 0),
  add column booking_window_days  integer not null default 28 check (booking_window_days > 0);

-- Paystack's checkout link for a pending payment, reused if the customer presses Pay again.
alter table public.payments add column authorization_url text;

-- Live = still taking up the barber's time. A hold past its expiry no longer counts, even
-- before anything has marked it 'expired'.
create function public.booking_is_live(p_status public.booking_status, p_hold_expires_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status in ('confirmed', 'completed', 'no_show')
      or (p_status = 'pending_payment' and p_hold_expires_at > now());
$$;

-- ---------------------------------------------------------------------------
-- Free times

-- Every bookable start time for a service between two shop-local dates (inclusive),
-- per barber. p_barber_id = null means any barber who offers the service.
-- Read-only and returns no personal data, so the booking pages can call it directly.
create function public.available_slots(
  p_service_id uuid,
  p_barber_id  uuid,
  p_from       date,
  p_to         date
)
returns table (barber_id uuid, starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with rules as (
    select time_zone as tz,
           make_interval(mins => slot_step_minutes) as step,
           make_interval(hours => min_notice_hours) as notice,
           booking_window_days as window_days,
           (now() at time zone time_zone)::date as today
    from public.shop_settings
  ),
  svc as (
    select make_interval(mins => duration_minutes) as dur,
           make_interval(mins => duration_minutes + buffer_minutes) as busy
    from public.services
    where id = p_service_id and is_active
  ),
  days as (
    select d::date as day
    from rules,
         generate_series(greatest(p_from, rules.today),
                         least(p_to, rules.today + rules.window_days),
                         interval '1 day') as d
    where not exists (select 1 from public.holidays h where h.date = d::date)
  ),
  -- The barber's working hours that day, trimmed to the shop's opening hours.
  windows as (
    select b.id as barber_id,
           (days.day + greatest(oh.opens_at, bh.starts_at)) at time zone rules.tz as win_start,
           (days.day + least(oh.closes_at, bh.ends_at)) at time zone rules.tz as win_end
    from days
    cross join rules
    join public.opening_hours oh on oh.weekday = extract(dow from days.day) and oh.is_open
    join public.barbers b on b.status = 'active' and (p_barber_id is null or b.id = p_barber_id)
    join public.barber_services bs on bs.barber_id = b.id and bs.service_id = p_service_id
    join public.barber_hours bh on bh.barber_id = b.id and bh.weekday = oh.weekday and bh.is_open
  ),
  candidates as (
    select w.barber_id, s as starts_at, s + svc.dur as ends_at, s + svc.busy as busy_until
    from windows w
    cross join svc
    cross join rules
    cross join lateral generate_series(w.win_start, w.win_end - svc.dur, rules.step) as s
  )
  select c.barber_id, c.starts_at
  from candidates c, rules
  where c.starts_at >= now() + rules.notice
    and not exists (
      select 1 from public.bookings bk
      where bk.barber_id = c.barber_id
        and public.booking_is_live(bk.status, bk.hold_expires_at)
        and tstzrange(bk.starts_at, bk.busy_until) && tstzrange(c.starts_at, c.busy_until)
    )
    and not exists (
      select 1 from public.time_blocks tb
      where tb.barber_id = c.barber_id
        and tstzrange(tb.starts_at, tb.ends_at) && tstzrange(c.starts_at, c.ends_at)
    )
  order by c.starts_at, c.barber_id;
$$;

grant execute on function public.available_slots(uuid, uuid, date, date) to anon, authenticated;

-- Each barber's earliest free time for a service ("Next free Mon 12 Oct, 09:00").
create function public.next_free_slots(p_service_id uuid)
returns table (barber_id uuid, starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (a.barber_id) a.barber_id, a.starts_at
  from public.shop_settings s,
       public.available_slots(p_service_id, null,
                              (now() at time zone s.time_zone)::date,
                              (now() at time zone s.time_zone)::date + s.booking_window_days) as a
  order by a.barber_id, a.starts_at;
$$;

grant execute on function public.next_free_slots(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Holding a time

-- Holds a free time for the shop's hold_minutes while the customer pays. Tries the chosen
-- barber, or for "any barber" the least busy free one first; if two customers race for
-- the same barber, the overlap guard on bookings stops one and we try the next barber.
-- Raises slot_taken when nobody is free at that time. Server only.
create function public.create_hold(
  p_service_id  uuid,
  p_barber_id   uuid,
  p_starts_at   timestamptz,
  p_customer_id uuid default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.shop_settings;
  v_service  public.services;
  v_day      date;
  v_barber   uuid;
  v_booking  public.bookings;
begin
  select * into v_settings from public.shop_settings where id;
  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then
    raise exception 'service_unavailable' using errcode = 'P0001';
  end if;

  -- Release holds that ran out, so they don't trip the overlap guard.
  update public.bookings
     set status = 'expired', updated_at = now()
   where status = 'pending_payment' and hold_expires_at <= now();

  v_day := (p_starts_at at time zone v_settings.time_zone)::date;

  for v_barber in
    select a.barber_id
    from public.available_slots(p_service_id, p_barber_id, v_day, v_day) as a
    join public.barbers b on b.id = a.barber_id
    where a.starts_at = p_starts_at
    order by (
      select count(*) from public.bookings bk
      where bk.barber_id = a.barber_id
        and public.booking_is_live(bk.status, bk.hold_expires_at)
        and (bk.starts_at at time zone v_settings.time_zone)::date = v_day
    ), b.sort_order
  loop
    begin
      insert into public.bookings (
        customer_id, customer_name, customer_email, barber_id, any_barber, service_id,
        service_name, price_kobo, duration_minutes, buffer_minutes,
        starts_at, ends_at, busy_until, status, hold_expires_at
      ) values (
        p_customer_id, '', '', v_barber, p_barber_id is null, v_service.id,
        v_service.name, v_service.price_kobo, v_service.duration_minutes, v_service.buffer_minutes,
        p_starts_at,
        p_starts_at + make_interval(mins => v_service.duration_minutes),
        p_starts_at + make_interval(mins => v_service.duration_minutes + v_service.buffer_minutes),
        'pending_payment',
        now() + make_interval(mins => v_settings.hold_minutes)
      )
      returning * into v_booking;
      return v_booking;
    exception when exclusion_violation then
      -- Someone else got this barber a moment ago; try the next one.
    end;
  end loop;

  raise exception 'slot_taken' using errcode = 'P0001';
end;
$$;

revoke execute on function public.create_hold(uuid, uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.create_hold(uuid, uuid, timestamptz, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Recording the payment result

-- Called with Paystack's verified answer (from the return page or the webhook; both may
-- arrive, so it is safe to call twice). Returns what happened:
--   'confirmed'          this call confirmed the booking (send the confirmation email)
--   'already_confirmed'  an earlier call did
--   'failed'             payment failed or was abandoned; the time is released
--   'refund_needed'      paid, but the time went to someone else after the hold ran out
--                        (a pending refund is recorded; server code sends it to Paystack)
create function public.record_payment(
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
  v_booking public.bookings;
  v_payment public.payments;
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
    begin
      update public.bookings set status = 'confirmed', updated_at = now() where id = v_booking.id;
      return 'confirmed';
    exception when exclusion_violation then
      -- The hold ran out and someone else booked this time meanwhile.
    end;
  end if;

  update public.bookings set status = 'expired', refund_due = true, updated_at = now()
   where id = v_booking.id;
  insert into public.refunds (payment_id, amount_kobo) values (v_payment.id, p_amount_kobo);
  return 'refund_needed';
end;
$$;

revoke execute on function public.record_payment(text, boolean, integer, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.record_payment(text, boolean, integer, timestamptz, jsonb) to service_role;
