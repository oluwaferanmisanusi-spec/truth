-- "Remember this device for 30 days" for two-step login (decided 2026-10-26). After the
-- authenticator code, a device can get a pass (a random token in an httpOnly cookie; only its
-- SHA-256 hash is stored here). With it, logging in on that device needs only the password
-- until it expires. Using a backup code, the owner's reset and a password reset delete them.
-- Server only.

create table public.two_step_trusted_devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index two_step_trusted_devices_user on public.two_step_trusted_devices (user_id);

alter table public.two_step_trusted_devices enable row level security;
revoke all on public.two_step_trusted_devices from anon, authenticated;
