-- 180-day simulation: food and drink. SIMULATION ONLY.
-- Members order from the phone; the floor and F&B staff order for a seat from the console; F&B staff accept,
-- send the KOT, carry it out and deliver, and void a few with a reason. A double tap reuses the request id.

-- One or two items from what the member's phone shows them, as order lines.
create function sim.order_lines(p_user uuid) returns jsonb language plpgsql as $$
declare
  r jsonb := sim.try(p_user, 'member.read_menu', 'select coalesce(jsonb_agg(item_id), ''[]''::jsonb) from public.my_fnb_menu()');
  v_items jsonb := coalesce(sim.val(r)::jsonb, '[]'::jsonb);
  v_count int := jsonb_array_length(v_items);
begin
  if v_count = 0 then return null; end if;
  return jsonb_build_array(jsonb_build_object('item_id', v_items ->> floor(random() * v_count)::int, 'quantity', 1 + floor(random() * 2)::int,
    'note', case when random() < 0.2 then 'Less ice' end));
end $$;

-- A seated member orders from the phone; one order in twenty is tapped twice (the same request id).
create function sim.order_from_phone(p_member uuid) returns void language plpgsql as $$
declare
  p sim.persona := sim.persona_row(p_member);
  v_lines jsonb := sim.order_lines(p.user_id);
  v_key uuid := sim.uid('order:' || sim_clock.now() || ':' || p_member);
  v_sql text;
begin
  if v_lines is null then return; end if;
  v_sql := format('select order_id from public.place_fnb_order(p_lines => %L::jsonb, p_idempotency_key => %L)', v_lines, v_key);
  perform sim.try(p.user_id, 'member.order', v_sql);
  if random() < 0.05 then perform sim.try(p.user_id, 'member.order_double_tap', v_sql); end if;
end $$;

-- The floor (or F&B staff) orders for a seat from the console.
create function sim.order_from_console(p_member uuid) returns void language plpgsql as $$
declare
  s record;
  v_actor uuid := case when random() < 0.5 then sim.floor() else sim.who('service') end;
  v_lines jsonb := sim.order_lines((sim.persona_row(p_member)).user_id);
begin
  select table_id, seat into s from public.seat_session where member_id = p_member and ended_at is null limit 1;
  if s.table_id is null or v_lines is null then return; end if;
  perform sim.try(v_actor, 'staff.order_for_seat', format(
    'select order_id from public.console_fnb_order(p_venue_id => %L, p_table_id => %L, p_seat => %s, p_lines => %L::jsonb, p_is_comp => false, p_idempotency_key => %L)',
    sim.venue(), s.table_id, s.seat, v_lines, sim.uid('console-order:' || sim_clock.now() || ':' || p_member)));
end $$;

-- F&B staff move each open order one step: accept, send the KOT, on its way, delivered. One in thirty is voided.
create function sim.service_tick(p_t timestamptz) returns void language plpgsql as $$
declare
  o record;
  v uuid := sim.who('service');
begin
  for o in select * from public.fnb_order where venue_id = sim.venue() and cancelled_at is null and delivered_at is null order by created_at loop
    if o.accepted_at is null and random() < 0.03 then
      perform sim.try(v, 'service.void_order', format('select public.cancel_fnb_order(p_order_id => %L, p_reason => %L)', o.id, 'Out of stock tonight'));
    elsif o.accepted_at is null then
      perform sim.try(v, 'service.accept_order', format('select public.accept_fnb_order(%L)', o.id));
    elsif o.kot_sent_at is null then
      perform sim.try(v, 'service.send_kot', format('select public.mark_kot_sent(%L)', o.id));
    elsif o.on_way_at is null then
      perform sim.try(v, 'service.on_its_way', format('select public.send_fnb_order_on_way(%L)', o.id));
    else
      perform sim.try(v, 'service.deliver', format('select public.deliver_fnb_order(%L)', o.id));
    end if;
  end loop;
end $$;

-- Seated members order now and then; the floor orders for some.
create function sim.orders_tick(p_t timestamptz) returns void language plpgsql as $$
declare
  s record;
begin
  for s in select member_id from sim.plan where state = 'seated' order by member_id loop
    if random() < 0.025 then perform sim.order_from_phone(s.member_id);
    elsif random() < 0.006 then perform sim.order_from_console(s.member_id);
    end if;
  end loop;
end $$;
