-- Phase 6: limits on repeated attempts (sign-up, password reset, holds, invite links).
-- The API runs on Vercel as many short-lived copies, so the counts live here rather than in
-- memory. Keys are hashed by the API (no emails or IP addresses stored in the clear).
-- Server only: RLS on, no policies.

create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts one attempt in the current fixed window and says whether it is still allowed.
-- One statement, so two requests at the same moment can't both slip under the limit.
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.rate_limits as r (key, window_start, hits)
  values (
    p_key,
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds),
    1
  )
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits <= p_limit;
$$;

revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
