-- The menu from a file (#799; decision 0440): staff who set up the menu save many items at once from a CSV, after the
-- console has shown each line and what is wrong with it. All or none. An item named as one the menu has (in any case)
-- takes the file's kind, and whether it is on offer when the file says; a new one goes after the last item, in the file's
-- order, on offer unless the file says not. The menu keeps no price (#123, decision 0284), so the console sends none.

-- The file's items as rows, in its order; a kind the menu has not, or on offer not true, false or null, raises 22P02.
create function private.fnb_menu_file_items(p_items jsonb)
returns table (name text, kind public.fnb_item_kind, is_available boolean, ordinality bigint)
language sql
stable
set search_path = ''
as $$
  select btrim(e.value ->> 'name'), (e.value ->> 'kind')::public.fnb_item_kind, (e.value ->> 'is_available')::boolean, e.ordinality
  from jsonb_array_elements(p_items) with ordinality as e (value, ordinality);
$$;

-- Saves 1 to 300 items, each a name, a kind and whether it is on offer (null: as it is, or on offer for a new one), and
-- says how many the file held. Items already as the file says are left untouched. Refusals: 42501 not staff who run or
-- serve F&B at the venue; 22023 an item out of bounds or a name twice; RVFRZ the venue frozen.
create function private.save_fnb_menu(p_venue_id uuid, p_items jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_last integer;
begin
  if not private.may_serve_fnb(p_venue_id) then
    raise exception 'Only staff who run or serve F&B change the menu' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 300 then
    raise exception 'One to 300 items' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  select coalesce(max(i.position), 0) into v_last from public.fnb_item i where i.venue_id = p_venue_id;
  begin
    if (select count(*) <> count(distinct lower(f.name)) from private.fnb_menu_file_items(p_items) f) then
      raise exception 'A name twice' using errcode = '23505';
    end if;
    update public.fnb_item i set kind = f.kind, is_available = coalesce(f.is_available, i.is_available)
    from private.fnb_menu_file_items(p_items) f
    where i.venue_id = p_venue_id and lower(i.name) = lower(f.name)
      and (i.kind, i.is_available) is distinct from (f.kind, coalesce(f.is_available, i.is_available));
    insert into public.fnb_item (venue_id, name, kind, is_available, position)
    select p_venue_id, f.name, f.kind, coalesce(f.is_available, true), least(v_last + f.ordinality, 999)
    from private.fnb_menu_file_items(p_items) f
    where not exists (select 1 from public.fnb_item i where i.venue_id = p_venue_id and lower(i.name) = lower(f.name));
  exception when check_violation or not_null_violation or invalid_text_representation or unique_violation then
    raise exception 'Each item a name of 1 to 60 characters, a kind and whether it is on offer, each name once' using errcode = '22023';
  end;
  return jsonb_array_length(p_items);
end;
$$;

create function public.save_fnb_menu(p_venue_id uuid, p_items jsonb)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.save_fnb_menu(p_venue_id, p_items); $$;

revoke execute on function private.fnb_menu_file_items(jsonb) from public, anon, authenticated;
revoke execute on function private.save_fnb_menu(uuid, jsonb), public.save_fnb_menu(uuid, jsonb) from public, anon;
grant execute on function private.save_fnb_menu(uuid, jsonb), public.save_fnb_menu(uuid, jsonb) to authenticated;
