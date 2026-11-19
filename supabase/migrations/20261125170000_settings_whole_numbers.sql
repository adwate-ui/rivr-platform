-- A setting's whole numbers are stored whole (#916). pg_jsonschema takes 20.0 as an integer, so a setting written straight
-- through the API as {"minutes": 20.0} passed its check, and every reader that casts the text (->> then ::integer, about
-- forty sites) then failed on "20.0" until a newer row replaced it. Rather than change every reader, a setting is stored
-- with each whole number written whole (20.0 becomes 20, wherever it sits in the value); a fraction such as 12.5 stays.
-- Readers, present and future, then always read what the console writes.

-- The value with every whole number written whole.
create function private.whole_numbers(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(p_value)
    when 'object' then coalesce((select jsonb_object_agg(e.key, private.whole_numbers(e.value)) from jsonb_each(p_value) e), '{}'::jsonb)
    when 'array' then coalesce((select jsonb_agg(private.whole_numbers(a.value) order by a.place)
                                from jsonb_array_elements(p_value) with ordinality a (value, place)), '[]'::jsonb)
    when 'number' then case when p_value::numeric = trunc(p_value::numeric) then to_jsonb(trunc(p_value::numeric)) else p_value end
    else p_value end;
$$;
revoke all on function private.whole_numbers(jsonb) from public, anon, authenticated;

create function private.setting_whole_numbers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.value := private.whole_numbers(new.value);
  return new;
end;
$$;
revoke all on function private.setting_whole_numbers() from public, anon, authenticated;

-- Before every check and guard that reads the value (triggers fire in name order; only refuse_frozen_write, which reads no
-- value, comes first), so each reads it as stored.
create trigger setting_0_whole_numbers before insert on public.setting
for each row execute function private.setting_whole_numbers();
