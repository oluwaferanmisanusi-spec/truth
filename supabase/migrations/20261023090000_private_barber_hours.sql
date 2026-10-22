-- Barbers' weekly hours are private (decided with the shop on 2026-10-23): only that barber
-- and the owner may read them. Customers only ever see bookable start times, which
-- available_slots works out inside the database without returning the hours themselves.

drop policy "Anyone can read barber hours" on public.barber_hours;
revoke select on public.barber_hours from anon;

create policy "Barber reads own hours" on public.barber_hours
  for select to authenticated using (barber_id = (select public.current_barber_id()));
create policy "Owner reads all barber hours" on public.barber_hours
  for select to authenticated using ((select public.is_owner()));
