-- Two-step login for the owner and managers (decided 2026-10-26; not in Figma). The
-- authenticator app itself is Supabase Auth's TOTP factor (auth.mfa_factors); this table
-- holds the 10 one-time backup codes each person gets at setup, for a lost phone.
-- Only SHA-256 hashes are stored. A used code keeps its row with used_at set.
-- Server only.

create table public.two_step_backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);
create index two_step_backup_codes_user on public.two_step_backup_codes (user_id);

alter table public.two_step_backup_codes enable row level security;
revoke all on public.two_step_backup_codes from anon, authenticated;
