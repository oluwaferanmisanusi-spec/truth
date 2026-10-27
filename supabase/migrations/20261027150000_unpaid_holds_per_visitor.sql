-- Hold limit (decided 2026-10-27): instead of 3 holds per 10 minutes per visitor, a visitor
-- can have at most 3 unpaid holds at once. Going back or paying frees one straight away, so a
-- customer comparing times is never blocked, and phones sharing a mobile network's address
-- don't use up each other's tries.
--
-- held_by is a SHA-256 hash of the visitor's network (as for rate_limits), never the address
-- itself. The hourly tidy job clears it once the hold is no longer waiting for payment.

alter table public.bookings add column held_by text;

create index bookings_unpaid_holds_by_visitor on public.bookings (held_by)
  where status = 'pending_payment' and held_by is not null;
