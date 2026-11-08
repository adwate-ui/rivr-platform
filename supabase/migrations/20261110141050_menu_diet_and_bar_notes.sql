-- The menu says what a dish is (audit 8 Nov, F-052): a veg, egg or non-veg mark and a short description on each item, set
-- with the item or from the menu's file; blank in a file leaves them as they are. And a note to the bar with an order, from
-- a fixed list: free text would outlive the member's erasure in the order, its KOT event and the audit log (#567).

alter table public.fnb_item
  add column diet text check (diet in ('veg', 'egg', 'non_veg')),
  add column description text check (description is null or length(btrim(description)) between 1 and 140);

-- A note's words for the KOT, from its comma-separated keys in the list's order; anything not on the list is dropped.
create function private.fnb_bar_note(p_keys text)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(w.words, ', ' order by w.position)
  from (values ('no_ice', 'No ice', 1), ('less_sugar', 'Less sugar', 2), ('less_spicy', 'Less spicy', 3), ('no_onion', 'No onion', 4), ('no_garlic', 'No garlic', 5))
       as w (key, words, position)
  where w.key = any (string_to_array(p_keys, ','));
$$;
revoke execute on function private.fnb_bar_note(text) from public, anon, authenticated;

-- As 20261105110000_fnb_age_every_source.sql made it, with a line's note from the list.
create or replace function private.record_fnb_order(p_session public.seat_session, p_lines jsonb, p_is_comp boolean, p_source text,
                                         p_staff_id uuid, p_device_id uuid)
returns table (order_id uuid, kot_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_lines jsonb;
  v_day date := private.club_day_now();
  v_number integer;
  v_id uuid;
begin
  perform private.assert_writable(p_session.venue_id, null, p_session.member_id);
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 20
     or exists (select 1 from jsonb_array_elements(p_lines) l
                where jsonb_typeof(l -> 'quantity') is distinct from 'number' or (l ->> 'quantity')::numeric not in (1, 2, 3, 4, 5, 6, 7, 8, 9)
                   or coalesce(l ->> 'item_id', '') !~ '^[0-9a-f-]{36}$' or length(coalesce(l ->> 'note', '')) > 120) then
    raise exception 'An order is 1 to 20 lines, each an item and a quantity of 1 to 9' using errcode = '22023';
  end if;
  select jsonb_agg(jsonb_build_object('item_id', i.id, 'name', i.name, 'kind', i.kind, 'quantity', (l.value ->> 'quantity')::integer,
                                      'note', private.fnb_bar_note(l.value ->> 'note')) order by l.ord)
  into v_lines
  from jsonb_array_elements(p_lines) with ordinality l (value, ord)
  join public.fnb_item i on i.id = (l.value ->> 'item_id')::uuid and i.venue_id = p_session.venue_id and i.is_available;
  if coalesce(jsonb_array_length(v_lines), 0) <> jsonb_array_length(p_lines) then
    raise exception 'That item is not on the menu now' using errcode = 'RVFNI';
  end if;
  if v_lines @> '[{"kind": "alcohol"}]' and not private.may_order_alcohol(p_session.member_id) then
    raise exception 'Alcohol is ordered at 21 or over' using errcode = 'RVAGE';
  end if;
  perform pg_advisory_xact_lock(hashtext('kot:' || p_session.venue_id::text));
  select coalesce(max(o.kot_number), 0) + 1 into v_number from public.fnb_order o where o.venue_id = p_session.venue_id and o.club_day = v_day;
  insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, kot_number, lines, is_comp, source,
                                placed_by_staff_id, placed_by_device_id)
  values (p_session.venue_id, p_session.visit_id, p_session.member_id, p_session.table_id, p_session.seat, v_day, v_number, v_lines,
          coalesce(p_is_comp, false), p_source, p_staff_id, p_device_id)
  returning id into v_id;
  perform private.emit(p_session.venue_id, 'fnb.ordered',
    jsonb_build_object('order_id', v_id, 'kot_number', v_number::text,
                       'table_name', (select g.name from public.game_table g where g.id = p_session.table_id), 'seat', p_session.seat,
                       'items', (select jsonb_agg(jsonb_build_object('name', x ->> 'name', 'quantity', (x ->> 'quantity')::integer, 'note', x -> 'note'))
                                 from jsonb_array_elements(v_lines) x),
                       'ordered_at', now(), 'is_comp', coalesce(p_is_comp, false)),
    'fnb.ordered:' || v_id);
  return query select v_id, v_number;
end;
$$;

drop function public.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid);
drop function private.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid);

-- As 20261101090100_food_service.sql made it, with the item's diet and description, set as given each time.
create function private.save_fnb_item(p_venue_id uuid, p_name text, p_kind public.fnb_item_kind, p_is_available boolean, p_position integer,
                                      p_item_id uuid default null, p_diet text default null, p_description text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.may_serve_fnb(p_venue_id) then
    raise exception 'Only staff who run F&B change the menu' using errcode = '42501';
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

create function public.save_fnb_item(p_venue_id uuid, p_name text, p_kind public.fnb_item_kind, p_is_available boolean, p_position integer,
                                     p_item_id uuid default null, p_diet text default null, p_description text default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_fnb_item(p_venue_id, p_name, p_kind, p_is_available, p_position, p_item_id, p_diet, p_description); $$;

revoke execute on function private.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid, text, text),
  public.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid, text, text) from public, anon;
grant execute on function private.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid, text, text),
  public.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid, text, text) to authenticated;

-- The file's items as rows, as 20261105000000_fnb_menu_from_a_file.sql made it, with diet and description; blank is null.
drop function private.fnb_menu_file_items(jsonb);
create function private.fnb_menu_file_items(p_items jsonb)
returns table (name text, kind public.fnb_item_kind, is_available boolean, diet text, description text, ordinality bigint)
language sql
stable
set search_path = ''
as $$
  select btrim(e.value ->> 'name'), (e.value ->> 'kind')::public.fnb_item_kind, (e.value ->> 'is_available')::boolean,
         e.value ->> 'diet', nullif(btrim(e.value ->> 'description'), ''), e.ordinality
  from jsonb_array_elements(p_items) with ordinality as e (value, ordinality);
$$;
revoke execute on function private.fnb_menu_file_items(jsonb) from public, anon, authenticated;

-- As 20261105000000_fnb_menu_from_a_file.sql made it, with diet and description.
create or replace function private.save_fnb_menu(p_venue_id uuid, p_items jsonb)
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

-- The menu, as 20261102030100_item_photos.sql made it, with each item's diet and description.
drop function public.my_fnb_menu();
drop function private.my_fnb_menu();
drop function public.fnb_menu(uuid);
drop function private.fnb_menu(uuid);

create function private.fnb_menu(p_venue_id uuid)
returns table (item_id uuid, name text, kind public.fnb_item_kind, photo_path text, diet text, description text)
language sql
stable
security definer
set search_path = ''
as $$
  with asker as (
    select private.current_member_id() as member_id,
           exists (select 1 from public.staff s where s.id = private.current_staff_id(p_venue_id)) as is_staff,
           exists (select 1 from public.device d where d.id = private.current_device_id() and d.venue_id = p_venue_id
                   and d.kind = 'dealer_tablet' and d.revoked_at is null) as is_tablet
  )
  select i.id, i.name, i.kind, i.photo_path, i.diet, i.description
  from public.fnb_item i cross join asker a
  where i.venue_id = p_venue_id and i.is_available
    and (a.is_staff or a.is_tablet
         or (exists (select 1 from public.member m where m.id = a.member_id and m.venue_id = p_venue_id)
             and private.has_feature(a.member_id, 'fnb.table_side')
             and (i.kind <> 'alcohol' or private.may_order_alcohol(a.member_id))))
  order by i.position, i.name;
$$;

create function private.my_fnb_menu()
returns table (item_id uuid, name text, kind public.fnb_item_kind, photo_path text, diet text, description text)
language sql
stable
security definer
set search_path = ''
as $$ select * from private.fnb_menu((select m.venue_id from public.member m where m.id = private.current_member_id())); $$;

create function public.fnb_menu(p_venue_id uuid)
returns table (item_id uuid, name text, kind public.fnb_item_kind, photo_path text, diet text, description text)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_menu(p_venue_id); $$;
create function public.my_fnb_menu()
returns table (item_id uuid, name text, kind public.fnb_item_kind, photo_path text, diet text, description text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_fnb_menu(); $$;

revoke execute on function private.fnb_menu(uuid), public.fnb_menu(uuid), private.my_fnb_menu(), public.my_fnb_menu() from public, anon;
grant execute on function private.fnb_menu(uuid), public.fnb_menu(uuid), private.my_fnb_menu(), public.my_fnb_menu() to authenticated;
