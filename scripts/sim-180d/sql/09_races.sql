-- 180-day simulation: two people acting at the same moment. SIMULATION ONLY.
-- sim.race_plan picks someone to race over and returns the two statements; src/night/runner.ts sends them in two
-- sessions at once. Each race is recorded in sim.race, and the R checks in 11_invariants.sql judge the outcome.

create table sim.race (id bigserial primary key, day int not null, at timestamptz not null, kind text not null, subject jsonb not null);
grant all on sim.race to public;
grant all on sim.race_id_seq to public;

-- A statement that acts as p_actor, on one line (the runner reads the pair as one tab-separated row).
create function sim.as_actor(p_actor uuid, p_action text, p_sql text) returns text language sql immutable as $$
  select format('select sim.try(%L::uuid, %L, %L)', p_actor, p_action, p_sql) $$;

create function sim.race_seat() returns table (a text, b text) language plpgsql as $$
declare
  w record;
  v_seats int[];
  v_sql text := 'select public.assign_from_waitlist(p_entry_id => %L, p_table_id => %L, p_seat => %s, p_call_minutes => 180, p_bonus_chips => 0)';
begin
  select e.id, e.member_id, e.table_id into w from public.waitlist_entry e join sim.plan pl using (member_id) join sim.persona p using (member_id)
  where e.status = 'waiting' and e.approved_at is not null and e.called_at is null and pl.state = 'arrived' and p.verified
  order by e.joined_at limit 1;
  if w.id is null then return; end if;
  select array_agg(s order by s) into v_seats from generate_series(1, (select seats from public.game_table where id = w.table_id)) s
  where not exists (select 1 from public.seat_session x where x.table_id = w.table_id and x.seat = s and x.ended_at is null);
  if coalesce(cardinality(v_seats), 0) < 2 then return; end if;
  insert into sim.race (day, at, kind, subject) values (sim.day(), sim_clock.now(), 'seat_same_member', jsonb_build_object('member', w.member_id, 'entry', w.id));
  a := sim.as_actor(sim.floor(), 'race.seat_same_member', format(v_sql, w.id, w.table_id, v_seats[1]));
  b := sim.as_actor(sim.who('admin'), 'race.seat_same_member', format(v_sql, w.id, w.table_id, v_seats[2]));
  return next;
end $$;

-- A seated member, for the double taps.
create function sim.seated_member() returns sim.persona language sql stable as $$
  select p.* from sim.persona p join sim.plan pl using (member_id) where pl.state = 'seated' order by p.number limit 1 $$;

create function sim.race_plan(p_kind text) returns table (a text, b text) language plpgsql as $$
declare
  p sim.persona := sim.seated_member();
  v_key uuid := gen_random_uuid();
  v_sql text;
  w record;
begin
  if p_kind = 'seat_same_member' then return query select * from sim.race_seat(); return; end if;
  if p_kind = 'approve_vs_leave' then
    select e.id, e.member_id, pe.user_id into w from public.waitlist_entry e join sim.persona pe using (member_id)
    where e.venue_id = sim.venue() and e.status = 'waiting' and e.approved_at is null order by e.joined_at limit 1;
    if w.id is null then return; end if;
    insert into sim.race (day, at, kind, subject) values (sim.day(), sim_clock.now(), p_kind, jsonb_build_object('member', w.member_id, 'entry', w.id));
    a := sim.as_actor(sim.floor(), 'race.approve', format('select public.approve_waitlist_request(%L)', w.id));
    b := sim.as_actor(w.user_id, 'race.leave', format('select public.leave_waitlist(%L)', w.id));
    return next;
    return;
  end if;
  if p_kind = 'double_redeem' then
    select x.* into p from sim.persona x join sim.plan pl using (member_id)
      join public.ledger_balance b on b.member_id = x.member_id and b.code = 'member.points'
    where pl.state = 'seated' and b.natural_balance >= (select min(points) from public.reward_item where venue_id = sim.venue() and is_live)
    order by x.number limit 1;
  end if;
  if p.member_id is null then return; end if;
  v_sql := case p_kind
    when 'double_order' then format('select order_id from public.place_fnb_order(p_lines => %L::jsonb, p_idempotency_key => %L)', sim.order_lines(p.user_id), v_key)
    when 'double_top_up' then 'select public.request_top_up()'
    when 'double_redeem' then (select format('select public.redeem_reward(p_item_id => %L, p_points => %s, p_idempotency_key => %L)', i.id, i.points, v_key)
                               from public.reward_item i where i.venue_id = sim.venue() and i.is_live and i.points is not null order by i.points limit 1)
  end;
  if v_sql is null then return; end if;
  insert into sim.race (day, at, kind, subject) values (sim.day(), sim_clock.now(), p_kind, jsonb_build_object('member', p.member_id, 'key', v_key));
  a := sim.as_actor(p.user_id, 'race.' || p_kind, v_sql);
  b := a;
  return next;
end $$;

-- After a race, the harness's plan follows what the database now says: seated if a seat session is open,
-- and no place if the member left the list.
create function sim.settle_plan() returns void language sql as $$
  update sim.plan pl set state = 'seated', table_id = s.table_id, session_id = s.id
  from public.seat_session s where s.member_id = pl.member_id and s.ended_at is null and pl.state in ('joined', 'arrived');
  update sim.plan pl set entry_id = null
  where pl.state in ('joined', 'arrived') and pl.entry_id is not null
    and not exists (select 1 from public.waitlist_entry e where e.id = pl.entry_id and e.status = 'waiting');
$$;
