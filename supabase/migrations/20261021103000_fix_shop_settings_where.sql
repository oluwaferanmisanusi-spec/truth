-- Supabase's safeupdate guard rejects UPDATE without WHERE; shop_settings has one row (id = true).

create or replace function public.owner_save_shop_settings(p_hours jsonb, p_time_zone text)
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

  update public.shop_settings set time_zone = p_time_zone, updated_at = now() where id;
end;
$$;
