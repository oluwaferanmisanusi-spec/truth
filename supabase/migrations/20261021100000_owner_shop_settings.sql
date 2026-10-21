-- Owner Shop settings (Figma 5.12): save the weekly opening hours and the time zone in one
-- transaction. Called only by our server code with the service role, after the owner check.
-- p_hours: [{"weekday":1,"is_open":true,"opens_at":"09:00","closes_at":"19:00"}, ...] for all 7 days.

create function public.owner_save_shop_settings(p_hours jsonb, p_time_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_array_length(p_hours) <> 7 then
    raise exception 'hours_need_seven_days' using errcode = 'P0001';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'unknown_time_zone' using errcode = 'P0001';
  end if;

  update public.opening_hours o
     set is_open   = (h ->> 'is_open')::boolean,
         opens_at  = case when (h ->> 'is_open')::boolean then (h ->> 'opens_at')::time end,
         closes_at = case when (h ->> 'is_open')::boolean then (h ->> 'closes_at')::time end
    from jsonb_array_elements(p_hours) as h
   where o.weekday = (h ->> 'weekday')::smallint;

  update public.shop_settings set time_zone = p_time_zone, updated_at = now();
end;
$$;

revoke execute on function public.owner_save_shop_settings(jsonb, text) from public, anon, authenticated;
grant execute on function public.owner_save_shop_settings(jsonb, text) to service_role;
