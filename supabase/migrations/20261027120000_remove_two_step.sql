-- Two-step login removed (decided 2026-10-26): the owner and managers log in with email and
-- password only. Its last table goes; the authenticator apps already set up (Supabase's
-- auth.mfa_factors) are removed by the developer with the admin API, not here.
drop table public.two_step_trusted_devices;
