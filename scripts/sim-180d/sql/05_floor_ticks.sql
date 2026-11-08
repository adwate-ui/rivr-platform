-- 180-day simulation: the floor's ten-minute steps. SIMULATION ONLY.

-- Walk-ins sign up on their phone at the door, as they arrive.
create table sim.walk_in (n int not null, idx int not null, arrive_at timestamptz not null, done boolean not null default false,
  primary key (n, idx));
grant all on sim.walk_in to public;

create function sim.arrivals_tick(p_t timestamptz) returns void language plpgsql as $$
declare
  w record;
  v_member uuid;
begin
  for w in select * from sim.walk_in where n = sim.day() and not done and arrive_at <= p_t order by arrive_at loop
    update sim.walk_in set done = true where n = w.n and idx = w.idx;
    v_member := sim.sign_up(w.n, w.idx, 'walk_in', 'walk_in');
    if v_member is null then continue; end if;
    insert into sim.plan (member_id, arrive_at, leave_at, walk_in_idx)
    values (v_member, w.arrive_at, least(w.arrive_at + interval '150 minutes', sim.ist(w.n, '03:50')), w.idx);
    perform sim.arrive(v_member);
  end loop;
  for w in select member_id from sim.plan where state = 'planned' and join_at <= p_t and entry_id is null order by join_at loop
    perform sim.join(w.member_id);
  end loop;
  for w in select member_id from sim.plan where state in ('planned', 'joined') and arrive_at <= p_t order by arrive_at loop
    perform sim.arrive(w.member_id);
  end loop;
end $$;

-- The floor: requests from phones, the desk's late identity checks, top-ups, Add time, then seating.
create function sim.floor_tick(p_t timestamptz) returns void language plpgsql as $$
declare
  f uuid := sim.floor();
  w record;
begin
  perform sim.settle_plan();
  for w in select e.id, e.member_id from public.waitlist_entry e
           where e.venue_id = sim.venue() and e.status = 'waiting' and e.approved_at is null order by e.joined_at loop
    if random() < 0.96 then
      perform sim.try(f, 'floor.approve_request', format('select public.approve_waitlist_request(%L)', w.id));
    else
      -- Declined (the wrong table, say): the member asks the floor, who adds them at once.
      perform sim.try(f, 'floor.decline_request', format('select public.decline_waitlist_request(%L)', w.id));
      update sim.plan set entry_id = null where member_id = w.member_id;
      if (select state from sim.plan where member_id = w.member_id) = 'arrived' then perform sim.join(w.member_id); end if;
    end if;
  end loop;
  for w in select pl.member_id from sim.plan pl join sim.persona p using (member_id)
           where pl.state = 'arrived' and not p.verified and not pl.desk_tried and pl.arrive_at < p_t - interval '20 minutes' loop
    update sim.plan set desk_tried = true where member_id = w.member_id;
    perform sim.desk_check(w.member_id);
  end loop;
  for w in select s.id, s.top_up_started_at from public.seat_session s
           where s.venue_id = sim.venue() and s.ended_at is null and s.top_up_requested_at is not null loop
    perform sim.try(f, case when w.top_up_started_at is null then 'floor.top_up_in_hand' else 'floor.top_up_done' end,
      format('select public.set_top_up(p_session_id => %L, p_in_progress => %L)', w.id, w.top_up_started_at is null));
  end loop;
  for w in select r.id from public.call_time_request r where r.venue_id = sim.venue() and r.status = 'pending' loop
    perform sim.try(f, 'floor.decide_add_time', format('select public.decide_call_time_request(p_request_id => %L, p_is_approved => %L)',
      w.id, random() < 0.85));
  end loop;
  perform sim.seat_tick();
  perform sim.open_more_tables();
end $$;

-- Each open table's free seats go to the first approved place of a member in the room; the rest walk straight in.
create function sim.seat_tick() returns void language plpgsql as $$
declare
  t record;
  w record;
  s int;
  v_tried uuid[] := '{}';
begin
  for t in select x.table_id from sim.tbl x join public.game_table g on g.id = x.table_id where g.is_open order by x.name loop
    loop
      s := sim.free_seat(t.table_id);
      exit when s is null;
      select e.id, e.member_id into w from public.waitlist_entry e join sim.plan pl on pl.member_id = e.member_id
      where e.table_id = t.table_id and e.status = 'waiting' and e.approved_at is not null and e.called_at is null
        and pl.state = 'arrived' and e.id <> all (v_tried)
        -- The board marks a place that waits for the desk's identity check; the floor seats the next one.
        and (select p.verified from sim.persona p where p.member_id = e.member_id)
      order by e.joined_at limit 1;
      exit when w.id is null;
      v_tried := v_tried || w.id;
      perform sim.seat(w.member_id, w.id, t.table_id, s);
    end loop;
  end loop;
  -- One in ten members in the room never asked for a place: the floor seats them straight in at a free seat.
  for w in select pl.member_id from sim.plan pl join sim.persona p using (member_id) where pl.state = 'arrived' and pl.entry_id is null and p.verified loop
    select x.table_id into t from sim.tbl x join public.game_table g on g.id = x.table_id
    where g.is_open and x.type_code <> 'private_room' and sim.free_seat(x.table_id) is not null order by x.name limit 1;
    if t.table_id is not null then perform sim.seat(w.member_id, null, t.table_id, sim.free_seat(t.table_id)); end if;
  end loop;
end $$;

-- A long list at a stake opens the next closed table at it.
create function sim.open_more_tables() returns void language plpgsql as $$
declare
  t record;
begin
  for t in select x.table_id from sim.tbl x join public.game_table g on g.id = x.table_id
           where not g.is_open and x.type_code <> 'private_room'
             and (select count(*) from public.waitlist_entry e join public.game_table o on o.id = e.table_id
                  where e.status = 'waiting' and o.table_type_id = g.table_type_id) >= 6
           order by x.name limit 1 loop
    perform sim.try(sim.floor(), 'floor.open_table', format('select public.set_table_open(p_table_id => %L, p_is_open => true)', t.table_id));
  end loop;
end $$;

-- Seated members: leave on time (the floor marks the leaving list first), ask for a top-up, ask for more time, move.
create function sim.players_tick(p_t timestamptz) returns void language plpgsql as $$
declare
  s record;
  r jsonb;
begin
  for s in select pl.*, p.user_id from sim.plan pl join sim.persona p using (member_id) where pl.state = 'seated' order by p.number loop
    if s.leave_at <= p_t then
      perform sim.depart(s.member_id);
      continue;
    end if;
    if not s.leaving_set and s.leave_at - p_t <= interval '20 minutes' and random() < 0.6 then
      perform sim.try(sim.floor(), 'floor.set_leaving', format('select public.set_leaving(p_session_id => %L, p_is_leaving => true)', s.session_id));
      update sim.plan set leaving_set = true where member_id = s.member_id;
    end if;
    if random() < 0.03 then
      perform sim.try(s.user_id, 'member.request_top_up', 'select public.request_top_up()');
    end if;
    if not s.asked_time and random() < 0.03 then
      -- Add time is offered only on a seat with a call time; the member picks the first length the app offers.
      r := sim.try(s.user_id, 'member.read_seat', 'select add_time_choices, call_time_minutes from public.my_seat()');
      if coalesce((r -> 'r' ->> 'call_time_minutes')::int, 0) > 0 and (r -> 'r' -> 'add_time_choices' ->> 0) is not null then
        perform sim.try(s.user_id, 'member.add_time', format('select public.request_call_time(p_idempotency_key => %L, p_minutes => %s)',
          sim.uid('time:' || s.session_id), (r -> 'r' -> 'add_time_choices' ->> 0)::int));
        update sim.plan set asked_time = true where member_id = s.member_id;
      end if;
    end if;
    if random() < 0.004 then perform sim.move(s.member_id); end if;
  end loop;
end $$;

-- The floor moves a player to a free seat at another open table at the same stake (balancing tables).
create function sim.move(p_member uuid) returns void language plpgsql as $$
declare
  pl sim.plan := (select x from sim.plan x where x.member_id = p_member);
  v_to uuid;
begin
  select x.table_id into v_to from sim.tbl x join public.game_table g on g.id = x.table_id
  where g.is_open and x.table_id <> pl.table_id and x.type_code = (select type_code from sim.tbl where table_id = pl.table_id)
    and sim.free_seat(x.table_id) is not null order by x.name limit 1;
  if v_to is null then return; end if;
  if sim.ok(sim.try(sim.floor(), 'floor.move_seat', format('select public.move_seat(p_session_id => %L, p_table_id => %L, p_seat => %s)',
       pl.session_id, v_to, sim.free_seat(v_to)))) then
    update sim.plan set table_id = v_to where member_id = p_member;
  end if;
end $$;

-- Leaving the table: a third leave from the phone. With call time still owed that only puts them on the leaving
-- list, so the floor ends the seat, as it does for everyone else.
create function sim.leave_table(p_member uuid) returns void language plpgsql as $$
declare
  pl sim.plan := (select x from sim.plan x where x.member_id = p_member);
  r jsonb;
begin
  if random() < 0.35 then
    r := sim.try((sim.persona_row(p_member)).user_id, 'member.leave_seat', 'select public.leave_my_seat()');
  end if;
  if r is null or sim.val(r) is distinct from 'left' then
    perform sim.try(sim.floor(), 'floor.end_seat', format('select public.end_seat(p_session_id => %L, p_reason => %L)', pl.session_id, 'left'));
  end if;
end $$;

-- Out through the door: the kiosk for half the verified members, else the desk. A member who still owes call
-- time is refused; the floor lets them leave early with a reason, and the desk checks them out.
create function sim.check_out(p_member uuid) returns void language plpgsql as $$
declare
  p sim.persona := sim.persona_row(p_member);
  v_sql text := format('select public.check_out_by_phone(%L, %L)', sim.venue(), p.phone);
  r jsonb;
begin
  if p.verified and random() < 0.5 and sim.kiosk_scan(p_member) is not null then return; end if;
  r := sim.try(sim.who('desk'), 'door.check_out_by_phone', v_sql);
  if r ->> 'state' = 'RVCTS' then
    perform sim.try(sim.floor(), 'floor.let_leave_early', format('select public.let_leave_early(p_member_id => %L, p_reason => %L, p_venue_id => %L)',
      p_member, 'Had to leave early: a family call', sim.venue()));
    perform sim.try(sim.who('desk'), 'door.check_out_after_early', v_sql);
  end if;
end $$;

create function sim.depart(p_member uuid) returns void language plpgsql as $$
declare
  pl sim.plan := (select x from sim.plan x where x.member_id = p_member);
begin
  if pl.state = 'seated' then
    perform sim.leave_table(p_member);
  elsif pl.entry_id is not null then
    perform sim.try((sim.persona_row(p_member)).user_id, 'member.leave_waitlist', format('select public.leave_waitlist(%L)', pl.entry_id));
  end if;
  if pl.state in ('seated', 'arrived') then perform sim.check_out(p_member); end if;
  update sim.plan set state = 'gone' where member_id = p_member;
end $$;

-- Waiting members whose evening is over go home; members still seated at close are stood up as the club closes.
create function sim.leavers_tick(p_t timestamptz) returns void language plpgsql as $$
declare
  w record;
begin
  for w in select member_id from sim.plan where state in ('joined', 'arrived') and leave_at <= p_t loop
    perform sim.depart(w.member_id);
  end loop;
end $$;
