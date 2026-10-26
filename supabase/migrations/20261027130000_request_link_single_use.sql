-- The shop's "please choose a new time" link (Ask to reschedule, 20261026130000) stops
-- working once it's been used: when the booking is moved or cancelled, by anyone (decided
-- 2026-10-27). The customer's own booking link (guest_token_hash) is unchanged.

create function public.clear_used_request_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.request_token_hash is not null
     and (new.status <> 'confirmed' or new.starts_at <> old.starts_at) then
    new.request_token_hash := null;
  end if;
  return new;
end;
$$;

create trigger bookings_clear_used_request_link
  before update of status, starts_at on public.bookings
  for each row execute function public.clear_used_request_link();

revoke execute on function public.clear_used_request_link() from public, anon, authenticated;

-- Links already used: the booking was moved (the request is cleared) or isn't confirmed now.
update public.bookings
   set request_token_hash = null
 where request_token_hash is not null
   and (status <> 'confirmed' or reschedule_requested_at is null);
