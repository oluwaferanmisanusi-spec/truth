-- Phase 6 security review (2026-10-25):
--   * a password reset logs the account out everywhere, so whoever knew the old password
--     (or created the account first) loses access
--   * the API also checks that a token's session still exists, so logging out, a password
--     reset or removing a manager ends access at once instead of when the token expires
-- Server only.

create function public.revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = p_user_id;
end;
$$;

create function public.session_is_active(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (select 1 from auth.sessions where id = p_session_id);
end;
$$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
revoke execute on function public.session_is_active(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
grant execute on function public.session_is_active(uuid) to service_role;
