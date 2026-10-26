-- No backup codes for two-step login after all (decided 2026-10-26): they worried staff more
-- than they helped. A lost phone is reset by the owner (managers, on the Managers page) or by
-- the developer (`npm run reset-two-step -- email`, for the owner).
drop table public.two_step_backup_codes;
