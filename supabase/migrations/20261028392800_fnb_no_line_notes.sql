-- F&B keeps no line notes (#567): no screen sets one, and a member's free text would outlive their erasure in the
-- order, its KOT event and the audit log. A line's note is always null. As before (20261028391700_fnb_orders.sql).
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
                                      'note', null) order by l.ord)
  into v_lines
  from jsonb_array_elements(p_lines) with ordinality l (value, ord)
  join public.fnb_item i on i.id = (l.value ->> 'item_id')::uuid and i.venue_id = p_session.venue_id and i.is_available;
  if coalesce(jsonb_array_length(v_lines), 0) <> jsonb_array_length(p_lines) then
    raise exception 'That item is not on the menu now' using errcode = 'RVFNI';
  end if;
  if p_source = 'app' and v_lines @> '[{"kind": "alcohol"}]' and not private.may_order_alcohol(p_session.member_id) then
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
