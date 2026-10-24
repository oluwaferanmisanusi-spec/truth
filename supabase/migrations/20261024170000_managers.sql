-- Managers, decided with the shop on 2026-10-24:
--   * a manager uses the owner dashboard with the same powers as the owner (bookings,
--     stats, services, barbers, shop settings), except inviting managers
--   * only the owner invites managers, by email, like barbers (7-day link, hashed token)
--   * the owner can remove any manager; a manager can remove other managers but never
--     the owner. Removing deletes the manager's login.
--   * a manager's email must not already have an account (logins are one role each)
-- Everything goes through our server code with the service role.

alter type public.user_role add value if not exists 'manager';

create table public.manager_invites (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
-- One open invite per email; resending revokes the old one first.
create unique index manager_invites_one_open on public.manager_invites (lower(email))
  where accepted_at is null and revoked_at is null;
alter table public.manager_invites enable row level security;
revoke all on public.manager_invites from anon, authenticated;

-- Turns a brand-new login into a manager and uses up the invite, in one step. Raises
-- invite_missing, invite_expired or email_mismatch.
create function public.accept_manager_invite(p_token_hash text, p_profile_id uuid, p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite  public.manager_invites;
  v_profile public.profiles;
begin
  select * into v_invite from public.manager_invites
   where token_hash = p_token_hash and accepted_at is null and revoked_at is null
   for update;
  if not found then
    raise exception 'invite_missing' using errcode = 'P0001';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  select * into v_profile from public.profiles where id = p_profile_id;
  if not found or lower(v_profile.email) <> lower(v_invite.email) or v_profile.role <> 'customer' then
    raise exception 'email_mismatch' using errcode = 'P0001';
  end if;

  update public.profiles
     set role = 'manager',
         full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
         email_verified_at = coalesce(email_verified_at, now())
   where id = p_profile_id;
  update public.manager_invites set accepted_at = now() where id = v_invite.id;
end;
$$;

revoke execute on function public.accept_manager_invite(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_manager_invite(text, uuid, text) to service_role;
