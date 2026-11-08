-- 180-day simulation: the floor's night. SIMULATION ONLY.
-- Who comes tonight, the door, the per-table waitlists, the floor's approvals and seating (with bonus chips),
-- top-ups, Add time after call time, moves, the leaving list, leaving and the door on the way out.
-- Every action is a real person's, through sim.try; randomness is seeded per night, so a run repeats.

-- Tonight's plan for each member who comes: when they join (from home or at the club), arrive and leave.
create table sim.plan (
  member_id uuid primary key, join_at timestamptz, arrive_at timestamptz not null, leave_at timestamptz not null,
  state text not null default 'planned',  -- planned, joined, arrived, seated, gone
  entry_id uuid, session_id uuid, table_id uuid, via text, leaving_set boolean not null default false,
  asked_time boolean not null default false, walk_in_idx int, desk_tried boolean not null default false);
grant all on sim.plan to public;

-- The floor manager on duty: the two floor staff take alternate nights; a removed one is replaced by the other.
create function sim.floor() returns uuid language sql stable as $$
  select coalesce(
    (select s.user_id from sim.staff s join public.staff x on x.id = s.staff_id
     where s.key = case when sim.day() % 2 = 0 then 'floor1' else 'floor2' end and x.is_active),
    (select s.user_id from sim.staff s join public.staff x on x.id = s.staff_id where s.key in ('floor1', 'floor2') and x.is_active limit 1),
    sim.who('admin')) $$;

-- How likely each kind of member is to come tonight, relative to the others.
create function sim.weight(p_persona text, p_weekend boolean, p_event boolean, p_day int) returns float8 language sql immutable as $$
  select case p_persona
    when 'grinder' then 5 when 'regular' then 3
    when 'casual' then case when p_weekend then 2 else 0.7 end
    when 'walk_in' then 0.6
    when 'event' then case when p_event then 4 else 0.3 end
    else case when p_day between 120 and 135 then 1 else 0.05 end end::float8 $$;

-- A free seat at a table: nobody sits in it and nobody called holds it.
create function sim.free_seat(p_table uuid) returns int language sql stable as $$
  select s from generate_series(1, (select seats from public.game_table where id = p_table)) s
  where not exists (select 1 from public.seat_session x where x.table_id = p_table and x.seat = s and x.ended_at is null)
    and not exists (select 1 from public.waitlist_entry w where w.call_table_id = p_table and w.call_seat = s
                    and w.status = 'waiting' and w.called_at is not null)
  order by s limit 1 $$;

-- Who comes tonight: a weighted draw (Efraimidis-Spirakis) to the calendar's number, then each one's hours.
create function sim.plan_night(d int) returns void language plpgsql as $$
declare
  n sim.night := (select x from sim.night x where x.n = d);
  v_weekend boolean := extract(isodow from n.date) in (5, 6);
  v_event boolean := cardinality(n.events) > 0;
  p record;
  a timestamptz;
begin
  delete from sim.plan;
  perform setseed(((d * 7919) % 10000) / 10000.0);
  for p in
    select x.member_id, x.persona from (
      select sp.member_id, sp.persona, random() ^ (1.0 / sim.weight(sp.persona, v_weekend, v_event, d)) as k
      from sim.persona sp
      where not sp.erased and sp.joined_night < d and (sp.excluded_until is null or sp.excluded_until <= n.date)
        and sp.source <> 'staff') x
    order by x.k desc limit greatest(n.expected - (select count(*) from sim.joiner j where j.n = d and j.source = 'walk_in'), 0)
  loop
    a := sim.ist(d, '18:15') + random() * interval '390 minutes';
    insert into sim.plan (member_id, join_at, arrive_at, leave_at)
    values (p.member_id, case when random() < 0.3 then a - random() * interval '50 minutes' end, a,
            least(a + case p.persona when 'grinder' then interval '240 minutes' when 'casual' then interval '100 minutes'
                                       else interval '160 minutes' end * (0.6 + random() * 0.8), sim.ist(d, '03:50')));
  end loop;
end $$;

-- The table a member asks for: an open table at their stake with the shortest list, else any open table.
create function sim.table_for(p_member uuid) returns uuid language sql stable as $$
  with pref as (select (array['nlh_100_200', 'nlh_100_200', 'nlh_50_100'])[1 + (number % 3)::int] as code
                from sim.persona where member_id = p_member)
  select t.table_id from sim.tbl t join public.game_table g on g.id = t.table_id, pref
  where g.is_open and t.type_code <> 'private_room'
  order by (t.type_code = pref.code) desc,
           (select count(*) from public.waitlist_entry e where e.table_id = t.table_id and e.status = 'waiting'), t.name
  limit 1 $$;

-- The member asks for a place: three in four from the phone (the floor approves), the rest at the floor.
create function sim.join(p_member uuid) returns void language plpgsql as $$
declare
  p sim.persona := sim.persona_row(p_member);
  v_table uuid := sim.table_for(p_member);
  r jsonb;
begin
  if v_table is null then return; end if;
  if random() < 0.75 then
    r := sim.try(p.user_id, 'member.join_waitlist', format('select public.join_waitlist_at(p_table_id => %L, p_idempotency_key => %L)',
      v_table, sim.uid('wl:' || sim_clock.now() || ':' || p_member)));
    -- The app asks for the selfie first: the member takes it, and joins again.
    if r ->> 'state' = 'RVKYC' and not p.selfie_taken and sim.selfie(p_member) then
      r := sim.try(p.user_id, 'member.join_waitlist_after_selfie', format('select public.join_waitlist_at(p_table_id => %L, p_idempotency_key => %L)',
        v_table, sim.uid('wl:' || sim_clock.now() || ':' || p_member)));
    end if;
  else
    r := sim.try(sim.floor(), 'floor.add_to_waitlist', format(
      'select public.add_to_waitlist(p_idempotency_key => %L, p_phone => %L, p_table_id => %L)',
      sim.uid('floor-wl:' || sim_clock.now() || ':' || p_member), p.phone, v_table));
  end if;
  if sim.ok(r) then
    update sim.plan set entry_id = sim.val(r)::uuid, state = case when state = 'planned' then 'joined' else state end
    where member_id = p_member;
  elsif r ->> 'state' = 'RVKYC' and (select state from sim.plan where member_id = p_member) = 'arrived' then
    -- Turned away for their identity check while at the club: they go home.
    perform sim.event('turned_away_identity', jsonb_build_object('member', p.number,
      'kyc', (select status from public.kyc_record where member_id = p_member)));
    perform sim.depart(p_member);
  end if;
end $$;

-- At the door: a verified member scans their card at the kiosk (six in ten) or the desk checks them in by phone.
-- A first-time member takes the selfie if they have not, and the desk checks their identity, mostly at once.
create function sim.arrive(p_member uuid) returns void language plpgsql as $$
declare
  p sim.persona := sim.persona_row(p_member);
  v_way text := 'desk';
begin
  if not p.selfie_taken then perform sim.selfie(p_member); end if;
  if p.verified and random() < 0.6 and sim.kiosk_scan(p_member) is not null then
    v_way := 'kiosk';
  else
    perform sim.desk_check_in(p_member);
  end if;
  update sim.plan set state = case when state in ('planned', 'joined') then 'arrived' else state end, via = v_way where member_id = p_member;
  if not p.verified and random() < 0.8 then
    update sim.plan set desk_tried = true where member_id = p_member;
    perform sim.desk_check(p_member);
  end if;
  if (select entry_id from sim.plan where member_id = p_member) is null then perform sim.join(p_member); end if;
end $$;

-- Bonus chips the floor redeems as it seats a member who holds some: half the time, up to 500, in whole 50s.
create function sim.bonus_to_redeem(p_member uuid) returns int language plpgsql as $$
declare
  r jsonb := sim.try(sim.floor(), 'floor.read_bonus_chips', format('select bonus_paise from public.member_bonus(%L, %L)', p_member, sim.venue()));
  v_chips int := coalesce((sim.val(r))::bigint / 100, 0);
begin
  if v_chips < 50 or random() < 0.5 then return 0; end if;
  return (least(v_chips, 500) / 50) * 50;
end $$;

-- Seat a member at a seat: from their place on the list, or straight in when they have none.
create function sim.seat(p_member uuid, p_entry uuid, p_table uuid, p_seat int) returns boolean language plpgsql as $$
declare
  v_bonus int := sim.bonus_to_redeem(p_member);
  v_stay interval := (select leave_at from sim.plan where member_id = p_member) - sim_clock.now();
  -- The call time the member agrees as they sit: the longest the floor offers that fits their evening (none if
  -- none fits); one in ten agrees to more than they then play, and asks to leave early.
  v_minutes int := case when random() < 0.1 then 180
                        else coalesce((select max(m) from unnest(array[180, 240, 300]) m where m * interval '1 minute' <= v_stay), 0) end;
  r jsonb;
begin
  if p_entry is not null then
    r := sim.try(sim.floor(), 'floor.seat_from_waitlist', format(
      'select public.assign_from_waitlist(p_entry_id => %L, p_table_id => %L, p_seat => %s, p_call_minutes => %s, p_bonus_chips => %s)',
      p_entry, p_table, p_seat, v_minutes, v_bonus));
  else
    r := sim.try(sim.floor(), 'floor.seat_member', format(
      'select public.seat_member(p_table_id => %L, p_seat => %s, p_phone => %L, p_call_minutes => %s, p_bonus_chips => %s)',
      p_table, p_seat, (sim.persona_row(p_member)).phone, v_minutes, v_bonus));
  end if;
  if not sim.ok(r) then return false; end if;
  update sim.plan set state = 'seated', table_id = p_table,
    session_id = (select id from public.seat_session where member_id = p_member and ended_at is null order by started_at desc limit 1)
  where member_id = p_member;
  update sim.persona set visits = visits + 1 where member_id = p_member;
  return true;
end $$;
