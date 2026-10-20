-- Owner cancels a booking: one atomic step so the booking and its refund never disagree.
-- Rules (Figma 5.2): only confirmed bookings that haven't started; owner cancellations
-- always refund in full. The Paystack refund call itself is made by server code
-- afterwards and moves the refund from 'pending' to 'processed'.
-- Called only by our server code with the service role.

create function public.owner_cancel_booking(p_booking_id uuid)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_payment public.payments;
  v_refund  public.refunds;
begin
  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = 'owner',
         refund_due = true,
         updated_at = now()
   where id = p_booking_id
     and status = 'confirmed'
     and starts_at > now()
  returning * into v_booking;

  if not found then
    raise exception 'booking_not_cancellable' using errcode = 'P0001';
  end if;

  select * into v_payment
    from public.payments
   where booking_id = v_booking.id and status = 'success'
   order by paid_at desc
   limit 1;

  if not found then
    raise exception 'booking_has_no_payment' using errcode = 'P0001';
  end if;

  insert into public.refunds (payment_id, amount_kobo)
  values (v_payment.id, v_payment.amount_kobo)
  returning * into v_refund;

  return v_refund;
end;
$$;

revoke execute on function public.owner_cancel_booking(uuid) from public, anon, authenticated;
grant execute on function public.owner_cancel_booking(uuid) to service_role;
