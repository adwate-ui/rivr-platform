-- 180-day simulation: one club night, 18:00 to 04:00 IST in sixty ten-minute steps. SIMULATION ONLY.
-- bin/night.ts calls open_night, then each step (running the message consumers after it), then close_night and morning.

-- A host who also plays: on night 5 their own login signs up as a member (one login, staff and member).
create function sim.staff_plays() returns void language plpgsql as $$
declare
  v_host uuid := sim.who('host');
  r jsonb := sim.try(v_host, 'staff.signs_up_as_member', format('select public.sign_up(%L, ''{}''::jsonb)', (select full_name from sim.staff where key = 'host')));
begin
  if not sim.ok(r) then return; end if;
  insert into sim.persona (member_id, user_id, phone, number, full_name, persona, source, joined_night)
  select m.id, v_host, m.phone, m.member_number, m.full_name, 'regular', 'staff', sim.day() from public.member m where m.id = sim.val(r)::uuid;
end $$;

create function sim.open_night(d int) returns void language plpgsql as $$
declare
  t record;
  v_open int := least(5, greatest(3, ceil((select expected from sim.night where n = d) / 14.0)::int));
begin
  update sim.config set v = d::text where k = 'day';
  perform setseed(((d * 104729) % 10000) / 10000.0);
  perform sim.goto(sim.ist(d, '12:00'));
  perform sim.joiners_tick(d);
  perform sim.feedback_tick(d);
  perform sim.events_day(d);
  if d = 5 then perform sim.staff_plays(); end if;
  perform sim.goto(sim.ist(d, '17:30'));
  perform sim.roster_tick(d);
  perform sim.notice_tick(d);
  perform sim.plan_night(d);
  for t in select x.table_id from sim.tbl x where x.type_code <> 'private_room' order by x.name limit v_open loop
    perform sim.try(sim.floor(), 'floor.open_table', format('select public.set_table_open(p_table_id => %L, p_is_open => true)', t.table_id));
  end loop;
end $$;

create function sim.step(d int, i int) returns void language plpgsql as $$
declare
  v_t timestamptz := sim.ist(d, '18:00') + i * interval '10 minutes';
begin
  perform sim.goto(v_t);
  perform sim.arrivals_tick(v_t);
  perform sim.floor_tick(v_t);
  perform sim.players_tick(v_t);
  perform sim.leavers_tick(v_t);
  perform sim.orders_tick(v_t);
  perform sim.service_tick(v_t);
  perform sim.rewards_tick();
  perform sim.spins_tick();
  if i % 6 = 0 then perform sim.by_hand_tick(d); perform sim.host_tick(); end if;
  if i = 12 then perform sim.interest_tick(d); end if;
end $$;

-- 04:00: every member still seated or waiting goes home through the door, every order is closed, every table shut.
create function sim.close_night(d int) returns void language plpgsql as $$
declare
  w record;
begin
  perform sim.goto(sim.ist(d, '04:00'));
  for w in select member_id from sim.plan where state in ('joined', 'arrived', 'seated') loop
    perform sim.depart(w.member_id);
  end loop;
  for w in select id, accepted_at from public.fnb_order where venue_id = sim.venue() and cancelled_at is null and delivered_at is null loop
    perform sim.try(sim.who('service'), 'service.close_order', case when w.accepted_at is null
      then format('select public.cancel_fnb_order(p_order_id => %L, p_reason => %L)', w.id, 'Kitchen closed')
      else format('select public.deliver_fnb_order(%L)', w.id) end);
  end loop;
  for w in select x.table_id from sim.tbl x join public.game_table g on g.id = x.table_id where g.is_open loop
    perform sim.try(sim.floor(), 'floor.close_table', format('select public.set_table_open(p_table_id => %L, p_is_open => false)', w.table_id));
  end loop;
  -- The checks run now, still inside the club day (the points cap is per club day); the month checks every 30 nights.
  perform sim.check_invariants(d, case when d % 30 = 0 then 'month' else 'night' end);
end $$;

-- The morning jobs run on the virtual clock up to 06:30 IST.
create function sim.morning(d int) returns void language plpgsql as $$
begin
  perform sim.goto(sim.ist(d + 1, '06:30'));
end $$;

-- A whole night without the message consumers (for quick checks by hand).
create function sim.night(d int) returns void language plpgsql as $$
begin
  perform sim.open_night(d);
  for i in 0..59 loop perform sim.step(d, i); end loop;
  perform sim.close_night(d);
  perform sim.morning(d);
end $$;
