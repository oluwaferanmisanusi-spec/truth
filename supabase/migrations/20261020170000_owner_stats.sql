-- Figures for the owner Stats screen (Figma 5.4), one row per barber with bookings in range.
-- A booking belongs to the range by its appointment time. Holds (pending/expired) don't count.
--   bookings      every booking, including cancelled ("Includes N cancelled")
--   completed / no_shows   appointments that took place
--   paid_kobo     successful payments
--   refunded_kobo refunds that haven't failed (pending ones are already owed)
-- security invoker: row-level security applies, so only the owner sees every barber.

create function public.owner_stats(p_from timestamptz, p_to timestamptz)
returns table (
  barber_id     uuid,
  full_name     text,
  bookings      bigint,
  cancelled     bigint,
  completed     bigint,
  no_shows      bigint,
  paid_kobo     bigint,
  refunded_kobo bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with in_range as (
    select bk.id, bk.barber_id, bk.status
    from public.bookings bk
    where bk.starts_at >= p_from
      and bk.starts_at < p_to
      and bk.status not in ('pending_payment', 'expired')
  ),
  paid as (
    select p.booking_id, sum(p.amount_kobo) as kobo
    from public.payments p
    where p.status = 'success' and p.booking_id in (select id from in_range)
    group by p.booking_id
  ),
  refunded as (
    select p.booking_id, sum(r.amount_kobo) as kobo
    from public.refunds r
    join public.payments p on p.id = r.payment_id
    where r.status <> 'failed' and p.booking_id in (select id from in_range)
    group by p.booking_id
  )
  select b.id,
         b.full_name,
         count(*),
         count(*) filter (where ir.status = 'cancelled'),
         count(*) filter (where ir.status = 'completed'),
         count(*) filter (where ir.status = 'no_show'),
         coalesce(sum(paid.kobo), 0)::bigint,
         coalesce(sum(refunded.kobo), 0)::bigint
  from in_range ir
  join public.barbers b on b.id = ir.barber_id
  left join paid on paid.booking_id = ir.id
  left join refunded on refunded.booking_id = ir.id
  group by b.id, b.full_name, b.sort_order
  order by b.sort_order;
$$;

revoke execute on function public.owner_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.owner_stats(timestamptz, timestamptz) to authenticated, service_role;
