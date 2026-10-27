-- Multi-flight events with a Day 2 (#117; decision 0251; question #489): two Weeknight Turbo flights (₹3,000 with a
-- ₹300 fee, 15,000 chips) of one Day 2. Flight 1A: Kunal and then Ritika are out, Mihir and Yash bag. Flight 1B:
-- Mihir is out, Yash bags more than in 1A and Ritika goes through. Day 2 plays the three through, Kunal placed
-- below them, and pays the event's one pool by its places, Kunal's included. 213 Mihir, 214 Yash, 215 Ritika and
-- 216 Kunal are members; 103 Aditya an admin (tournaments.manage); Elsewhere's admin runs nothing at the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.fund(p_member uuid, p_paise bigint) returns uuid language sql as $$
  select private.post_ledger_transaction(m.venue_id, 'deposit', 'test-fund:' || p_member, jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = m.venue_id and a.code = 'venue.bank' and a.member_id is null),
                       'amount', p_paise::text),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member and a.code = 'member.cash'),
                       'amount', (-p_paise)::text)), null, 'Test deposit')
  from public.member m where m.id = p_member;
$$;
create function pg_temp.balance(p_code text) returns bigint language sql security definer as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is null;
$$;
create function pg_temp.named(p_name text) returns uuid language sql security definer as $$ select id from public.tournament where name = p_name; $$;
create function pg_temp.run(p_name text, p_member uuid) returns uuid language sql security definer as $$
  select id from public.tournament_entry where tournament_id = pg_temp.named(p_name) and member_id = p_member order by entry_number desc limit 1;
$$;
grant execute on function pg_temp.named(text), pg_temp.run(text, uuid), pg_temp.balance(text) to authenticated;
create function pg_temp.enter(p_name text, p_member text, p_key text) returns uuid language sql as $$
  select pg_temp.as_person(p_member);
  select public.register_tournament_entry(pg_temp.named(p_name), 'entry', p_key::uuid);
$$;
grant execute on function pg_temp.enter(text, text, text) to authenticated;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');
select pg_temp.fund('00000000-0000-4000-8000-000000000213', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000214', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000215', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000216', 5000000);
create temporary table before on commit drop as select pg_temp.balance('venue.tournament_pool') as pool;
grant select on before to authenticated;

-- The event: Day 2 and its flights 1A, 1B and 1C, made from the Weeknight Turbo; Day 2's room a table of two.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Event Day 2', now(), true);
select public.set_tournament_room(pg_temp.named('Event Day 2'), 1, 2);
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Flight 1A', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Flight 1B', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Flight 1C', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'Flight Knockout', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Entered Turbo', now(), true);
select pg_temp.enter('Entered Turbo', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-00000000f600');
select throws_ok($$ select public.set_tournament_flight(pg_temp.named('Flight 1A'), pg_temp.named('Event Day 2')) $$, '42501', null,
  'a member makes no flight');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.set_tournament_flight(pg_temp.named('Flight 1A'), pg_temp.named('Event Day 2')) $$, '42501', null,
  'nor does another venue''s admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_tournament_flight(pg_temp.named('Flight 1A'), pg_temp.named('Flight 1A')) $$, '22023', null,
  'a flight is never its own Day 2');
select throws_ok($$ select public.set_tournament_flight(pg_temp.named('Flight Knockout'), pg_temp.named('Event Day 2')) $$, '22023', null,
  'a bounty tournament is no flight');
select throws_ok($$ select public.set_tournament_flight(pg_temp.named('Flight 1C'), pg_temp.named('Entered Turbo')) $$, '22023', null,
  'nor is a tournament players entered directly a Day 2');
select lives_ok($$ select public.set_tournament_flight(pg_temp.named('Flight 1A'), pg_temp.named('Event Day 2')) $$, 'Flight 1A of the event');
select lives_ok($$ select public.set_tournament_flight(pg_temp.named('Flight 1B'), pg_temp.named('Event Day 2')) $$, 'and Flight 1B');
select public.set_tournament_flight(pg_temp.named('Flight 1C'), pg_temp.named('Event Day 2'));
select throws_ok($$ select public.set_tournament_flight(pg_temp.named('Event Day 2'), pg_temp.named('Entered Turbo')) $$, '22023', null,
  'a Day 2 is no flight');
-- Four places at 40, 30, 20 and 10%, set before anyone is out in the money.
select public.set_tournament_payouts(pg_temp.named('Event Day 2'), array[4000, 3000, 2000, 1000]);
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.register_tournament_entry(pg_temp.named('Event Day 2'), 'entry', '00000000-0000-4000-8000-00000000f601') $$,
  'RVTRN', null, 'Day 2 takes no entries of its own');

-- Flight 1A: four enter; Kunal is out fourth and Ritika third; Mihir and Yash bag 20,000 and 25,000.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.start_tournament_clock(pg_temp.named('Flight 1A'));
select pg_temp.enter('Flight 1A', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-00000000f611');
select pg_temp.enter('Flight 1A', '00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-00000000f612');
select pg_temp.enter('Flight 1A', '00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-00000000f613');
select pg_temp.enter('Flight 1A', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-00000000f614');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.bust_tournament_entry(pg_temp.run('Flight 1A', '00000000-0000-4000-8000-000000000216'));
select public.bust_tournament_entry(pg_temp.run('Flight 1A', '00000000-0000-4000-8000-000000000215'));
select throws_ok($$ select public.finish_tournament(pg_temp.named('Flight 1A')) $$, '22023', null, 'a flight is bagged, not finished');
select throws_ok(format($$ select public.bag_tournament_flight(%L, %L) $$, pg_temp.named('Flight 1A'),
                        jsonb_build_object(pg_temp.run('Flight 1A', '00000000-0000-4000-8000-000000000213'), 20000)), '22023', null,
  'every player left gives their chips');
select throws_ok(format($$ select public.bag_tournament_flight(%L, %L) $$, pg_temp.named('Flight 1A'),
                        jsonb_build_object(pg_temp.run('Flight 1A', '00000000-0000-4000-8000-000000000213'), 40000,
                                           pg_temp.run('Flight 1A', '00000000-0000-4000-8000-000000000214'), 25000)), '22023', null,
  'no more than were bought');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok(format($$ select public.bag_tournament_flight(%L, %L) $$, pg_temp.named('Flight 1A'), '{}'), '42501', null,
  'another venue''s admin bags nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok(format($$ select public.bag_tournament_flight(%L, %L) $$, pg_temp.named('Flight 1A'),
                       jsonb_build_object(pg_temp.run('Flight 1A', '00000000-0000-4000-8000-000000000213'), 20000,
                                          pg_temp.run('Flight 1A', '00000000-0000-4000-8000-000000000214'), 25000)), 'the floor bags Flight 1A');
select lives_ok($$ select public.bag_tournament_flight(pg_temp.named('Flight 1A'), '{}') $$, 'bagging it again changes nothing');
select results_eq($$ select m.full_name, e.status, f.bagged_chips from public.tournament_entry e join public.member m on m.id = e.member_id
                     join public.tournament_entry f on f.id = e.flight_entry_id where e.tournament_id = pg_temp.named('Event Day 2') order by m.full_name $$,
  $$ values ('Kunal Mehra'::text, 'busted'::text, null::bigint), ('Mihir Shah', 'seated', 20000), ('Ritika Das', 'busted', null), ('Yash Gupta', 'seated', 25000) $$,
  'Mihir and Yash go through with their bags; Ritika and Kunal are out on Day 1');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.register_tournament_entry(pg_temp.named('Flight 1A'), 'entry', '00000000-0000-4000-8000-00000000f615') $$,
  'RVTRN', null, 'a bagged flight takes no more entries');

-- Flight 1B: Mihir, Yash and Ritika enter; Mihir is out; Yash bags 30,000 and Ritika 15,000. Day 2's table of two has
-- no seat for Ritika until the floor adds one.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.start_tournament_clock(pg_temp.named('Flight 1B'));
select public.start_tournament_clock(pg_temp.named('Flight 1C'));
select pg_temp.enter('Flight 1B', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-00000000f621');
select pg_temp.enter('Flight 1B', '00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-00000000f622');
select pg_temp.enter('Flight 1B', '00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-00000000f623');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.bust_tournament_entry(pg_temp.run('Flight 1B', '00000000-0000-4000-8000-000000000213'));
create temporary table bags_1b on commit drop as
  select jsonb_build_object(pg_temp.run('Flight 1B', '00000000-0000-4000-8000-000000000214'), 30000,
                            pg_temp.run('Flight 1B', '00000000-0000-4000-8000-000000000215'), 15000) as stacks;
grant select on bags_1b to authenticated;
select throws_ok($$ select public.bag_tournament_flight(pg_temp.named('Flight 1B'), (select stacks from bags_1b)) $$, 'RVTRN', null,
  'with no seat for Ritika on Day 2, the flight waits');
select public.set_tournament_room(pg_temp.named('Event Day 2'), 1, 3);
select lives_ok($$ select public.bag_tournament_flight(pg_temp.named('Flight 1B'), (select stacks from bags_1b)) $$,
  'with a third seat, the floor bags Flight 1B');
select results_eq($$ select m.full_name, e.status, f.bagged_chips from public.tournament_entry e join public.member m on m.id = e.member_id
                     join public.tournament_entry f on f.id = e.flight_entry_id where e.tournament_id = pg_temp.named('Event Day 2') order by m.full_name $$,
  $$ values ('Kunal Mehra'::text, 'busted'::text, null::bigint), ('Mihir Shah', 'seated', 20000), ('Ritika Das', 'seated', 15000), ('Yash Gupta', 'seated', 30000) $$,
  'Yash keeps his bigger bag, Mihir his 1A one, and Ritika goes through from 1B');
select results_eq($$ select entries, players_left, chips_in_play, pool_paise from public.venue_tournaments('00000000-0000-4000-8000-000000000001')
                     where id = pg_temp.named('Event Day 2') $$,
  $$ values (7, 3, 65000::bigint, 1890000::bigint) $$, 'Day 2 counts the flights'' seven entries, its three players'' 65,000 chips and one ₹18,900 pool');

-- Day 2: Ritika is out third and Mihir second; Yash wins. Kunal, out on Day 1, is fourth, and the payouts reach him.
select public.start_tournament_clock(pg_temp.named('Event Day 2'));
select throws_ok($$ select public.bag_tournament_flight(pg_temp.named('Flight 1C'), '{}') $$, '22023', null,
  'once Day 2 starts, no flight is bagged into it');
select is(public.bust_tournament_entry(pg_temp.run('Event Day 2', '00000000-0000-4000-8000-000000000215')), 3, 'Ritika is out third on Day 2');
select is(public.bust_tournament_entry(pg_temp.run('Event Day 2', '00000000-0000-4000-8000-000000000213')), 2, 'and Mihir second');
select lives_ok($$ select public.finish_tournament(pg_temp.named('Event Day 2')) $$, 'Yash wins the event');
-- ₹18,900 at 40, 30, 20 and 10% in ₹50 chips: ₹7,650 (the ₹100 left over to first), ₹5,650, ₹3,750 and ₹1,850.
select results_eq($$ select p.place, p.full_name, p.prize_paise from public.tournament_payouts(pg_temp.named('Event Day 2')) p $$,
  $$ values (1, 'Yash Gupta'::text, 765000::bigint), (2, 'Mihir Shah', 565000), (3, 'Ritika Das', 375000), (4, 'Kunal Mehra', 185000) $$,
  'the event''s pool is paid by its places, Kunal''s from Day 1 included');
select results_eq($$ select m.full_name, f.place from public.league_finish f join public.member m on m.id = f.member_id
                     where f.tournament_id = pg_temp.named('Event Day 2') order by f.place $$,
  $$ values ('Yash Gupta'::text, 1), ('Mihir Shah', 2), ('Ritika Das', 3), ('Kunal Mehra', 4) $$, 'each player''s League finish is the event''s');
select is_empty($$ select 1 from public.league_finish where tournament_id in (pg_temp.named('Flight 1A'), pg_temp.named('Flight 1B')) $$,
  'and the flights earn none of their own');
reset role;
select is(pg_temp.balance('venue.tournament_pool') - (select pool from before), -270000::bigint,
  'the flights'' buys are paid out whole (the Entered Turbo''s ₹2,700 waits in its own pool)');

select * from finish();
rollback;
