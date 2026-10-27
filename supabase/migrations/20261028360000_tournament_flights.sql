-- Multi-flight events with a Day 2 (#117; decision 0251; question #489, answered "as recommended" on 27 Oct). An
-- event is a Day 2 tournament and its Day 1 flights (1A, 1B...), each played as a tournament of its own. When a
-- flight's play ends, the floor bags it: each player left has their chips counted and goes through to Day 2, and
-- one who goes through in two flights keeps the bigger stack. Every other player of the flights is placed below
-- Day 2's field by their best run (private.tournament_day_two_field, the twin of @rivr/domain dayTwoField). All the
-- flights' buys form the event's one prize pool; Day 2 takes no buys of its own and pays, and earns League points,
-- at its finish, by the event's places: a player out on Day 1 wins only when the payouts reach their place.

-- The Day 2 a flight's players go through to: another tournament at the venue. A flight has no bounty and is no
-- satellite. What each player left in a flight bagged, and the flight run each Day 2 player came from.
alter table public.tournament
  add column day_two_id uuid,
  add constraint tournament_day_two_fkey foreign key (day_two_id, venue_id) references public.tournament (id, venue_id),
  add constraint tournament_flight check (day_two_id is null or (day_two_id <> id and bounty_paise is null and satellite_target_id is null));
create index tournament_day_two_idx on public.tournament (day_two_id, venue_id);
alter table public.tournament_entry
  add column bagged_chips bigint check (bagged_chips > 0),
  add column flight_entry_id uuid,
  add constraint tournament_entry_flight_entry_fkey foreign key (flight_entry_id, venue_id) references public.tournament_entry (id, venue_id);
create index tournament_entry_flight_entry_idx on public.tournament_entry (flight_entry_id, venue_id);

-- A member's export gives them whole (decision 0240).
insert into private.member_export_column (table_name, column_name, kind) values
  ('tournament_entry', 'bagged_chips', 'owed'), ('tournament_entry', 'flight_entry_id', 'owed');

-- Day 2's field from its flights' runs (jsonb, in the order they were made: {"member", "chips"} for a bag, or
-- {"member", "place", "runs"} for a run out in that place of a flight of that many runs): each player's chosen run
-- by its index from 0, whether it goes through, and for those out their rank, 1 the best. 22023 for a bag of no
-- chips, a place outside its flight or a run with no player. The twin of @rivr/domain dayTwoField (golden
-- tournamentSeating.json).
create function private.tournament_day_two_field(p_runs jsonb)
returns table (run_index integer, goes_through boolean, out_rank integer)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_runs) is distinct from 'array' or exists (
       select 1 from jsonb_array_elements(p_runs) r (run)
       where coalesce(run ->> 'member', '') = ''
          or (coalesce(run ->> 'chips', '') = '') = (coalesce(run ->> 'place', '') = '')
          or (coalesce(run ->> 'chips', '') <> '' and run ->> 'chips' !~ '^[1-9][0-9]{0,11}$')
          or (coalesce(run ->> 'place', '') <> ''
              and (run ->> 'place' !~ '^[1-9][0-9]{0,5}$' or coalesce(run ->> 'runs', '') !~ '^[1-9][0-9]{0,5}$'
                   or (run ->> 'place')::integer > (run ->> 'runs')::integer))) then
    raise exception 'Each run a player''s, bagged with chips above nothing or out in a place of its flight' using errcode = '22023';
  end if;
  return query
    with runs as (
      select (r.n - 1)::integer as idx, r.run ->> 'member' as player, (r.run ->> 'chips')::bigint as chips,
             (r.run ->> 'runs')::integer - (r.run ->> 'place')::integer as outlasted, (r.run ->> 'runs')::integer as flight_runs
      from jsonb_array_elements(p_runs) with ordinality r (run, n)
    ),
    best as (
      select distinct on (u.player) u.idx, u.chips is not null as is_bag, u.outlasted, u.flight_runs
      from runs u
      order by u.player, u.chips is not null desc, u.chips desc nulls last, u.outlasted desc, u.flight_runs, u.idx
    )
    select b.idx, b.is_bag,
           case when not b.is_bag then (row_number() over (partition by b.is_bag order by b.outlasted desc, b.flight_runs, b.idx))::integer end
    from best b
    order by b.is_bag desc, 3, b.idx;
end;
$$;

-- As 20261027120100_tournament_bounties_and_prizes.sql left it, with Day 2: its field is its flights', so their
-- buys make its pool and its entries, and its chips are those its players bagged.
create or replace function private.tournament_counts(p_tournament_id uuid)
returns table (entries integer, re_entries integer, players_left integer, chips_in_play bigint, pool_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where p.kind in ('entry', 're_entry'))::integer, count(*) filter (where p.kind = 're_entry')::integer,
         (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament_id and e.status = 'seated'),
         (coalesce(sum(p.chips) filter (where p.tournament_id = p_tournament_id), 0)
          + coalesce((select sum(f.bagged_chips) from public.tournament_entry d join public.tournament_entry f on f.id = d.flight_entry_id
                      where d.tournament_id = p_tournament_id and d.status <> 'refunded'), 0))::bigint,
         (coalesce(sum(p.price_paise - p.fee_paise), 0)
          - count(*) filter (where p.kind in ('entry', 're_entry')) * coalesce((select t.bounty_paise from public.tournament t where t.id = p_tournament_id), 0))::bigint
  from public.tournament_purchase p join public.tournament_entry e on e.id = p.entry_id
  where (p.tournament_id = p_tournament_id or p.tournament_id in (select f.id from public.tournament f where f.day_two_id = p_tournament_id))
    and e.status <> 'refunded';
$$;

-- As 20261026235200_tournament_entries.sql left it, with Day 2: its players come only from its flights (day_two).
create or replace function private.tournament_buy_refusal(p_tournament public.tournament, p_member_id uuid, p_purchase text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- A refunded run never sat: it counts for nothing.
  with latest as (
    select e.id, e.status from public.tournament_entry e where e.tournament_id = p_tournament.id and e.member_id = p_member_id
      and e.status <> 'refunded'
    order by e.entry_number desc limit 1
  )
  select case when exists (select 1 from public.tournament f where f.day_two_id = p_tournament.id) then 'day_two'
              else private.tournament_purchase_refusal(
    p_purchase, p_tournament.format, p_tournament.last_registration_level, p_tournament.max_buys, p_tournament.add_on_paise is not null,
    private.tournament_level_now(p_tournament),
    (select count(*)::integer from public.tournament_purchase p join public.tournament_entry e on e.id = p.entry_id
     where p.tournament_id = p_tournament.id and p.member_id = p_member_id and e.status <> 'refunded' and p.kind in ('entry', 're_entry', 'rebuy')),
    coalesce((select l.status in ('seated', 'alternate') from latest l), false),
    exists (select 1 from latest l join public.tournament_purchase p on p.entry_id = l.id where p.kind = 'add_on')) end;
$$;

-- Makes a tournament a Day 1 flight of p_day_two_id, or an ordinary one again (null), for tournaments.manage
-- before anyone has entered it or its clock has started. The Day 2 is another tournament at the venue with levels,
-- not started, nobody's entered it but from its flights, and it is neither a flight nor a satellite; neither has a
-- bounty. Refusals: 42501; 22023 any of those; RVFRZ.
create function private.set_tournament_flight(p_flight_id uuid, p_day_two_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_flight_id);
  v_day_two public.tournament;
begin
  perform private.assert_runs_tournaments(v_venue_id);
  perform private.assert_writable(v_venue_id);
  perform 1 from public.tournament t where t.id = p_flight_id for update;
  select * into v_day_two from public.tournament t where t.id = p_day_two_id for update;
  if (select t.clock_started_at from public.tournament t where t.id = p_flight_id) is not null or p_day_two_id = p_flight_id
     or exists (select 1 from public.tournament_entry e where e.tournament_id = p_flight_id and e.status <> 'refunded')
     or exists (select 1 from public.tournament f where f.day_two_id = p_flight_id)
     or (p_day_two_id is not null
         and (v_day_two.levels is null or v_day_two.clock_started_at is not null or v_day_two.day_two_id is not null
              or v_day_two.satellite_target_id is not null or v_day_two.bounty_paise is not null
              or exists (select 1 from public.tournament_entry e where e.tournament_id = p_day_two_id and e.status <> 'refunded'
                         and e.flight_entry_id is null))) then
    raise exception 'Before anyone enters, a flight of a Day 2 not yet started, neither a flight nor a satellite' using errcode = '22023';
  end if;
  begin
    update public.tournament set day_two_id = p_day_two_id where id = p_flight_id;
  exception when check_violation or foreign_key_violation then
    raise exception 'A flight, neither a satellite nor with a bounty, of a tournament at this venue' using errcode = '22023';
  end;
end;
$$;

-- Day 2's field from its bagged flights: each player of them gets one Day 2 entry, from their chosen run. Those who
-- go through are seated at random (RVTRN room_full when the Day 2 room has no seat: the floor makes it bigger first);
-- a seat already taken is kept. Those out are busted in order, the worst first, so Day 2's busts all place above
-- them. Called as each flight is bagged, before Day 2 starts, so the whole field is worked again each time.
create function private.seat_day_two(p_day_two public.tournament)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_runs uuid[];
  v_out integer;
  v_pick record;
  v_run public.tournament_entry;
  v_entry public.tournament_entry;
begin
  -- Every bagged flight's runs, in the order they were made: a bag, or out in its place of the flight's runs.
  select array_agg(e.id order by e.created_at, e.id) into v_runs
  from public.tournament_entry e join public.tournament f on f.id = e.tournament_id
  where f.day_two_id = p_day_two.id and f.finished_at is not null and e.status in ('seated', 'busted');
  v_out := (select count(*)::integer from private.tournament_day_two_field(private.flight_runs(v_runs)) d where not d.goes_through);
  for v_pick in select d.run_index, d.goes_through, d.out_rank from private.tournament_day_two_field(private.flight_runs(v_runs)) d loop
    v_run := (select e from public.tournament_entry e where e.id = v_runs[v_pick.run_index + 1]);
    v_entry := (select e from public.tournament_entry e where e.tournament_id = p_day_two.id and e.member_id = v_run.member_id);
    if v_entry.id is null then
      insert into public.tournament_entry (venue_id, tournament_id, member_id, entry_number, status, flight_entry_id, busted_at, bust_order)
      values (p_day_two.venue_id, p_day_two.id, v_run.member_id, 1, case when v_pick.goes_through then 'alternate' else 'busted' end, v_run.id,
              case when not v_pick.goes_through then v_run.busted_at end, case when not v_pick.goes_through then v_out - v_pick.out_rank + 1 end)
      returning * into v_entry;
    elsif v_pick.goes_through then
      update public.tournament_entry
      set flight_entry_id = v_run.id, status = case when status = 'seated' then 'seated' else 'alternate' end,
          busted_at = null, bust_order = null
      where id = v_entry.id
      returning * into v_entry;
    else
      update public.tournament_entry set flight_entry_id = v_run.id, busted_at = v_run.busted_at, bust_order = v_out - v_pick.out_rank + 1
      where id = v_entry.id;
    end if;
    if v_pick.goes_through and v_entry.status = 'alternate' and not private.seat_tournament_entry(v_entry.id) then
      raise exception 'Every seat of Day 2 is taken' using errcode = 'RVTRN', hint = 'room_full';
    end if;
  end loop;
end;
$$;

-- The runs given, as private.tournament_day_two_field takes them: a bag with its chips, or out in its place of its flight's runs.
create function private.flight_runs(p_runs uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(case when e.status = 'seated' then jsonb_build_object('member', e.member_id, 'chips', e.bagged_chips)
                                 else jsonb_build_object('member', e.member_id, 'place', e.place,
                                                         'runs', (select count(*) from public.tournament_entry r
                                                                  where r.tournament_id = e.tournament_id and r.status <> 'refunded')) end
                            order by u.n), '[]')
  from unnest(p_runs) with ordinality u (id, n) join public.tournament_entry e on e.id = u.id;
$$;

-- Bags a Day 1 flight, for tournaments.manage, once (a replay changes nothing): p_stacks gives each player left's
-- chips ({"<entry id>": chips}, no more than were bought in the flight). Each goes through to Day 2; each run out
-- keeps its place in the flight; the flight takes no more buys or busts; Day 2's field is worked again. Refusals:
-- 42501, also with a player left who is the caller's own member record; 22023 not a flight under way, a Day 2
-- already started, or not the chips of each player left; RVTRN alternates_waiting, room_full; RVFRZ.
create function private.bag_tournament_flight(p_flight_id uuid, p_stacks jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_flight public.tournament := (select t from public.tournament t where t.id = p_flight_id);
  v_day_two public.tournament;
  v_left integer;
begin
  perform private.assert_runs_tournaments(v_flight.venue_id);
  perform 1 from public.tournament t where t.id = p_flight_id for update;
  v_flight := (select t from public.tournament t where t.id = p_flight_id);
  if v_flight.finished_at is not null then
    return;
  end if;
  perform private.assert_writable(v_flight.venue_id);
  select * into v_day_two from public.tournament t where t.id = v_flight.day_two_id for update;
  if v_flight.day_two_id is null or v_flight.clock_started_at is null or v_day_two.clock_started_at is not null then
    raise exception 'A flight under way, bagged before its Day 2 starts' using errcode = '22023';
  end if;
  if exists (select 1 from public.tournament_entry e where e.tournament_id = p_flight_id and e.status = 'alternate') then
    raise exception 'Refund the alternates who never sat first' using errcode = 'RVTRN', hint = 'alternates_waiting';
  end if;
  v_left := (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_flight_id and e.status = 'seated');
  if jsonb_typeof(p_stacks) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_stacks)) <> v_left
     or exists (select 1 from public.tournament_entry e where e.tournament_id = p_flight_id and e.status = 'seated'
                and coalesce(p_stacks ->> e.id::text, '') !~ '^[1-9][0-9]{0,11}$')
     or coalesce((select sum((s.value)::text::bigint) from jsonb_each(p_stacks) s), 0)
        > (select c.chips_in_play from private.tournament_counts(p_flight_id) c) then
    raise exception 'The chips of each player left, a whole number above nothing, no more than were bought' using errcode = '22023';
  end if;
  if exists (select 1 from public.tournament_entry e where e.tournament_id = p_flight_id and e.status = 'seated'
             and coalesce(private.is_own_kyc_check(e.member_id), false)) then
    raise exception 'Staff never bag a flight they are still playing' using errcode = '42501';
  end if;
  update public.tournament_entry e set bagged_chips = (p_stacks ->> e.id::text)::bigint
  where e.tournament_id = p_flight_id and e.status = 'seated';
  update public.tournament_entry e set place = p.place from private.tournament_places(p_flight_id) p where p.entry_id = e.id and e.status = 'busted';
  update public.tournament set finished_at = now(), overlay_paise = 0 where id = p_flight_id;
  perform private.seat_day_two(v_day_two);
end;
$$;

-- As 20261028350000_tournament_satellites.sql left it, a flight never finished: it is bagged.
create or replace function private.tournament_finishers(p_tournament public.tournament, p_method text, p_stacks jsonb)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_left integer := (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated');
  v_most_left integer := 1;
  -- A deal, or a satellite finished with more than one left: the chips of each player left are counted.
  v_is_counted boolean := p_method is not null or v_left > 1;
begin
  if p_tournament.clock_started_at is null or p_method not in ('icm', 'chip_chop') or p_tournament.day_two_id is not null
     or (p_tournament.satellite_target_id is not null and p_method is not null) then
    raise exception 'A tournament under way, played out or by ICM or chip-chop (a satellite is played out, a flight bagged)' using errcode = '22023';
  end if;
  if p_tournament.payout_shares is null and p_tournament.satellite_target_id is null then
    raise exception 'Set each paid place''s share of the pool first' using errcode = 'RVTRN', hint = 'payouts_unset';
  end if;
  if exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'alternate') then
    raise exception 'Refund the alternates who never sat first' using errcode = 'RVTRN', hint = 'alternates_waiting';
  end if;
  if p_tournament.satellite_target_id is not null then
    if coalesce((private.setting_at(p_tournament.venue_id, 'tds.config', '', now()) ->> 'enabled')::boolean, false) then
      raise exception 'A satellite finishes while TDS is switched off, until question #517 is answered'
        using errcode = 'RVTRN', hint = 'tds_switched_on';
    end if;
    v_most_left := greatest((select s.seats from private.tournament_satellite_result(p_tournament) s), 1);
  end if;
  if (p_method is null and v_left > v_most_left) or (p_method is not null and v_left not between 2 and 9)
     or not exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status in ('seated', 'busted')) then
    raise exception 'Played out with one player left (no more than the seats in a satellite), or a deal among two to nine'
      using errcode = 'RVTRN', hint = 'players_left';
  end if;
  if v_is_counted and (jsonb_typeof(p_stacks) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_stacks)) <> v_left
     or exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated'
                and coalesce(p_stacks ->> e.id::text, '') !~ '^[1-9][0-9]{0,11}$')
     or (select sum((s.value)::text::bigint) from jsonb_each(p_stacks) s) > (select c.chips_in_play from private.tournament_counts(p_tournament.id) c)) then
    raise exception 'The chips of each player left, a whole number above nothing, no more than were bought' using errcode = '22023';
  end if;
  if exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated'
             and coalesce(private.is_own_kyc_check(e.member_id), false)) then
    raise exception 'Staff never finish a tournament they are still playing' using errcode = '42501';
  end if;
  return array(select e.id from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated'
               order by case when v_is_counted then (p_stacks ->> e.id::text)::bigint else 0 end desc, e.created_at, e.id);
end;
$$;

create function public.set_tournament_flight(p_flight_id uuid, p_day_two_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_tournament_flight(p_flight_id, p_day_two_id); $$;
create function public.bag_tournament_flight(p_flight_id uuid, p_stacks jsonb)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.bag_tournament_flight(p_flight_id, p_stacks); $$;

revoke execute on function private.tournament_day_two_field(jsonb), private.set_tournament_flight(uuid, uuid),
  private.seat_day_two(public.tournament), private.flight_runs(uuid[]), private.bag_tournament_flight(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function private.set_tournament_flight(uuid, uuid), private.bag_tournament_flight(uuid, jsonb) to authenticated;
revoke execute on function public.set_tournament_flight(uuid, uuid), public.bag_tournament_flight(uuid, jsonb) from public, anon;
grant execute on function public.set_tournament_flight(uuid, uuid), public.bag_tournament_flight(uuid, jsonb) to authenticated;

-- The tournament gains its Day 2 and an entry its bag; the practice venue's seed keeps them (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
