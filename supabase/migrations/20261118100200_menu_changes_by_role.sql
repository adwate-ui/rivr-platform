-- Who changes the food and drink menu (redesign of 15 Nov 2026, RD-33; the owner, 15 Nov): staff who serve food and drink
-- hide an item and show it again, and nothing else; only staff who run it (fnb.manage: super admins and admins) add an
-- item, change one, upload the menu or delete an item. Until now anyone who served could do all of it but delete, which
-- nobody could.
--
-- A deleted item stays on past orders: an order keeps its own lines (fnb_order.lines), with each item's name as it was.

-- As 20261110141050_menu_diet_and_bar_notes.sql made it, for staff who run F&B alone.
create or replace function private.save_fnb_item(p_venue_id uuid, p_name text, p_kind public.fnb_item_kind, p_is_available boolean, p_position integer,
                                                 p_item_id uuid default null, p_diet text default null, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'fnb.manage'), false) then
    raise exception 'Only staff who run F&B add or change an item' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if p_item_id is null then
    insert into public.fnb_item (venue_id, name, kind, is_available, position, diet, description)
    values (p_venue_id, trim(p_name), p_kind, coalesce(p_is_available, true), coalesce(p_position, 1), p_diet, nullif(trim(p_description), ''))
    returning id into v_id;
  else
    update public.fnb_item i set name = trim(p_name), kind = p_kind, is_available = coalesce(p_is_available, i.is_available),
                                 position = coalesce(p_position, i.position), diet = p_diet, description = nullif(trim(p_description), '')
    where i.id = p_item_id and i.venue_id = p_venue_id
    returning id into v_id;
    if v_id is null then
      raise exception 'No such item at this venue' using errcode = '22023';
    end if;
  end if;
  return v_id;
end;
$$;

-- As 20261110141050_menu_diet_and_bar_notes.sql left it, for staff who run F&B alone.
create or replace function private.save_fnb_menu(p_venue_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last integer;
begin
  if not coalesce(private.has_permission(p_venue_id, 'fnb.manage'), false) then
    raise exception 'Only staff who run F&B upload the menu' using errcode = '42501';
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
    update public.fnb_item i set kind = f.kind, is_available = coalesce(f.is_available, i.is_available),
                                 diet = coalesce(f.diet, i.diet), description = coalesce(f.description, i.description)
    from private.fnb_menu_file_items(p_items) f
    where i.venue_id = p_venue_id and lower(i.name) = lower(f.name)
      and (i.kind, i.is_available, i.diet, i.description)
          is distinct from (f.kind, coalesce(f.is_available, i.is_available), coalesce(f.diet, i.diet), coalesce(f.description, i.description));
    insert into public.fnb_item (venue_id, name, kind, is_available, position, diet, description)
    select p_venue_id, f.name, f.kind, coalesce(f.is_available, true), least(v_last + f.ordinality, 999), f.diet, f.description
    from private.fnb_menu_file_items(p_items) f
    where not exists (select 1 from public.fnb_item i where i.venue_id = p_venue_id and lower(i.name) = lower(f.name));
  exception when check_violation or not_null_violation or invalid_text_representation or unique_violation then
    raise exception 'Each item a name of 1 to 60 characters, a kind and whether it is on offer, each name once' using errcode = '22023';
  end;
  return jsonb_array_length(p_items);
end;
$$;

-- An item hidden from the menu, or shown on it again: all that staff who serve change. The item's venue is its own.
create function private.set_fnb_item_available(p_item_id uuid, p_is_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  select i.venue_id into v_venue_id from public.fnb_item i where i.id = p_item_id;
  if v_venue_id is null or not private.may_serve_fnb(v_venue_id) then
    raise exception 'Only staff who run or serve F&B hide an item' using errcode = '42501';
  end if;
  if p_is_available is null then
    raise exception 'On the menu or off it' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id);
  update public.fnb_item i set is_available = p_is_available where i.id = p_item_id and i.is_available is distinct from p_is_available;
end;
$$;

create function public.set_fnb_item_available(p_item_id uuid, p_is_available boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_fnb_item_available(p_item_id, p_is_available); $$;

-- An item deleted from the menu, by staff who run F&B. Orders that had it keep their lines.
create function private.delete_fnb_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  select i.venue_id into v_venue_id from public.fnb_item i where i.id = p_item_id;
  if v_venue_id is null or not coalesce(private.has_permission(v_venue_id, 'fnb.manage'), false) then
    raise exception 'Only staff who run F&B delete an item' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id);
  delete from public.fnb_item i where i.id = p_item_id;
end;
$$;

create function public.delete_fnb_item(p_item_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.delete_fnb_item(p_item_id); $$;

revoke execute on function private.set_fnb_item_available(uuid, boolean), public.set_fnb_item_available(uuid, boolean),
  private.delete_fnb_item(uuid), public.delete_fnb_item(uuid) from public, anon;
grant execute on function private.set_fnb_item_available(uuid, boolean), public.set_fnb_item_available(uuid, boolean),
  private.delete_fnb_item(uuid), public.delete_fnb_item(uuid) to authenticated;
