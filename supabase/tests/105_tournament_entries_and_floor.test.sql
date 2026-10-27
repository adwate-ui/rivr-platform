-- Tournament registration, seating and bust-outs (#118, #120; decisions 0203, 0204). 213 Mihir, 214 Yash
-- and 215 Ritika are members with their identity checks done; 103 Aditya an admin (tournaments.manage)
-- and 104 Sana a cashier at both venues; Elsewhere's admin and cashier run nothing at the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- A member's wallet cash paid in from the bank, as a deposit would.
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
create function pg_temp.sunday() returns uuid language sql as $$ select id from public.tournament where name = 'Test Sunday'; $$;
create function pg_temp.entry(p_member uuid) returns uuid language sql security definer as $$
  select id from public.tournament_entry where tournament_id = pg_temp.sunday() and member_id = p_member order by entry_number desc limit 1;
$$;
grant execute on function pg_temp.sunday(), pg_temp.entry(uuid), pg_temp.balance(text) to authenticated;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated', '919000000997', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e3', 'Elsewhere Cashier', 'Cashier', 'cashier');

select results_eq($$ select code, kind::text, is_players_money from public.ledger_account
                     where venue_id = '00000000-0000-4000-8000-0000000000e1' and code like 'venue.tournament%' order by code $$,
  $$ values ('venue.tournament_fees'::text, 'revenue'::text, false), ('venue.tournament_overlay', 'expense', false), ('venue.tournament_pool', 'liability', true),
            ('venue.tournament_tickets', 'liability', true) $$,
  'a new venue opens with the tournament accounts: the pool and the satellite tickets held are players'' money');

-- A RIVR Sunday in a room of one table of two seats, shown to members.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.create_tournament('00000000-0000-4000-8000-0000000007c1', 'Test Sunday', now() + interval '1 hour', true) $$, 'a tournament');
select lives_ok($$ select public.set_tournament_room(pg_temp.sunday(), 1, 2) $$, 'in a room of one table of two seats');
select throws_ok($$ select public.set_tournament_room(pg_temp.sunday(), 31, 2) $$, '22023', null, 'no more than thirty tables');
reset role;
select pg_temp.fund('00000000-0000-4000-8000-000000000213', 2500000);
select pg_temp.fund('00000000-0000-4000-8000-000000000215', 1000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000216', 500000);

-- From the app: the wallet pays, the fee goes to revenue, the rest to the pool, and a seat at random.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select offer, my_status from public.my_tournament() where id = pg_temp.sunday() $$, $$ values ('entry'::text, null::text) $$,
  'Home offers Mihir an entry');
select lives_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'entry', '00000000-0000-4000-8000-00000000f001') $$,
  'Mihir registers from the app');
select results_eq($$ select status, table_number from public.tournament_entry where member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values ('seated'::text, 1) $$, 'and is seated at the only table');
select is((select count(*)::integer from public.tournament_purchase where member_id = '00000000-0000-4000-8000-000000000213'), 1, 'one buy');
select lives_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'entry', '00000000-0000-4000-8000-00000000f001') $$,
  'the same request again changes nothing');
select throws_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'rebuy', '00000000-0000-4000-8000-00000000f001') $$, '22023', null,
  'nor does its id buy anything else');
select throws_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'entry', '00000000-0000-4000-8000-00000000f002') $$, 'RVTRN', null,
  'a second entry is refused by the rules');
select results_eq($$ select my_status, offer from public.my_tournament() where id = pg_temp.sunday() $$, $$ values ('seated'::text, null::text) $$,
  'Home shows Mihir seated, with nothing more to buy');
reset role;
select is(private.wallet_cash('00000000-0000-4000-8000-000000000213'), 1500000::bigint, 'Mihir''s wallet paid ₹10,000');
select is(pg_temp.balance('venue.tournament_pool'), -900000::bigint, '₹9,000 is in the prize pool');
select is(pg_temp.balance('venue.tournament_fees'), -100000::bigint, 'and ₹1,000 is the club''s fee');

-- Not enough cash, or no tournament registration.
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select throws_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'entry', '00000000-0000-4000-8000-00000000f003') $$, 'RVSHT', null,
  'Kunal''s ₹5,000 does not buy a ₹10,000 entry');
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'tournaments.register', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select throws_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'entry', '00000000-0000-4000-8000-00000000f004') $$, '42501', null,
  'without tournament registration, nothing');
select is_empty($$ select * from public.my_tournament() $$, 'and Home shows no tournament');
select is_empty($$ select 1 from public.tournament_entry $$, 'a member sees no one else''s entries');

-- At the cage: cash for Yash, into the drawer, the last seat.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.cage_tournament_entry(pg_temp.sunday(), '00000000-0000-4000-8000-000000000214', 'entry', '00000000-0000-4000-8000-00000000f005') $$,
  '42501', null, 'an admin takes no cash');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e3');
select throws_ok($$ select public.cage_tournament_entry(pg_temp.sunday(), '00000000-0000-4000-8000-000000000214', 'entry', '00000000-0000-4000-8000-00000000f005') $$,
  '42501', null, 'nor does another venue''s cashier');
reset role;
create temporary table drawer_before on commit drop as select pg_temp.balance('venue.cash_drawer') as paise;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select public.cage_tournament_entry(pg_temp.sunday(), '00000000-0000-4000-8000-000000000214', 'entry', '00000000-0000-4000-8000-00000000f005') $$,
  'the cashier takes Yash''s entry in cash');
reset role;
select is(pg_temp.balance('venue.cash_drawer') - (select paise from drawer_before), 1000000::bigint, '₹10,000 into the drawer');
select is(pg_temp.balance('venue.tournament_pool'), -1800000::bigint, 'and ₹9,000 more in the pool');

-- The room is full: Ritika is an alternate, and every entry is announced.
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select lives_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'entry', '00000000-0000-4000-8000-00000000f006') $$, 'Ritika registers');
select results_eq($$ select my_status, my_table from public.my_tournament() where id = pg_temp.sunday() $$, $$ values ('alternate'::text, null::integer) $$,
  'with every seat taken, she is an alternate');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'tournament.entered' and payload ->> 'tournament_id' = pg_temp.sunday()::text), 3,
  'tournament.entered for each entry');
select results_eq($$ select entries, re_entries, players_left, chips_in_play, pool_paise from private.tournament_counts(pg_temp.sunday()) $$,
  $$ values (3, 0, 2, 90000::bigint, 2700000::bigint) $$, 'three entries, two players at the table, 90,000 chips, ₹27,000 in the pool');

-- A bust: Mihir is first out; Ritika takes his seat; Mihir re-enters and waits.
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.bust_tournament_entry(pg_temp.entry('00000000-0000-4000-8000-000000000213')) $$, '42501', null,
  'another venue''s admin records no bust here');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.bust_tournament_entry(pg_temp.entry('00000000-0000-4000-8000-000000000213')), 3, 'Mihir is the first out of three runs: third');
select throws_ok($$ select public.bust_tournament_entry(pg_temp.entry('00000000-0000-4000-8000-000000000213')) $$, '22023', null, 'once');
select results_eq($$ select status from public.tournament_seating(pg_temp.sunday()) where full_name = 'Ritika Das' $$, $$ values ('seated'::text) $$,
  'the oldest alternate takes the seat');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select my_status, offer from public.my_tournament() where id = pg_temp.sunday() $$, $$ values ('busted'::text, 're_entry'::text) $$,
  'Home offers Mihir a re-entry');
select lives_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 're_entry', '00000000-0000-4000-8000-00000000f007') $$, 'he re-enters');
reset role;
select results_eq($$ select entry_number, status from public.tournament_entry where member_id = '00000000-0000-4000-8000-000000000213' order by entry_number $$,
  $$ values (1, 'busted'::text), (2, 'alternate') $$, 'a second entry, waiting for a seat');

-- Refunding the waiting re-entry pays the wallet back and leaves it out of the field.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.refund_tournament_alternate(pg_temp.entry('00000000-0000-4000-8000-000000000213')) $$, 'the floor refunds the alternate');
select throws_ok($$ select public.refund_tournament_alternate(pg_temp.entry('00000000-0000-4000-8000-000000000214')) $$, '42501', null,
  'but not a cash buy, which the cage refunds');
reset role;
select is(private.wallet_cash('00000000-0000-4000-8000-000000000213'), 1500000::bigint, 'Mihir has his ₹10,000 back');
select results_eq($$ select entries, re_entries, players_left, pool_paise from private.tournament_counts(pg_temp.sunday()) $$,
  $$ values (3, 0, 2, 2700000::bigint) $$, 'and the refunded re-entry is no part of the field');
select results_eq($$ select place from private.tournament_seating(pg_temp.sunday()) where status = 'busted' $$, $$ values (3) $$,
  'Mihir''s first run is third of the three runs left');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select my_status, offer from public.my_tournament() where id = pg_temp.sunday() $$, $$ values ('busted'::text, 're_entry'::text) $$,
  'with the refunded run counting for nothing, Home offers the re-entry again');
reset role;

-- Asking from elsewhere: a member of another club, an unpublished tournament, or no one signed in.
update public.tournament set is_published = false where id = pg_temp.sunday();
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select throws_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'rebuy', '00000000-0000-4000-8000-00000000f011') $$, '42501', null,
  'an unpublished tournament sells nothing in the app');
reset role;
update public.tournament set is_published = true where id = pg_temp.sunday();
set local role anon;
select throws_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 'entry', '00000000-0000-4000-8000-00000000f012') $$, '42501', null,
  'no one signed out buys');
reset role;

-- Balancing: a second table opens, the prompt moves one player there.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_tournament_room(pg_temp.sunday(), 2, 2) $$, 'a second table');
select results_eq($$ select from_table, to_table from public.tournament_balance(pg_temp.sunday()) $$, $$ values (1, 2) $$,
  'two at table 1 and none at table 2: move one');
select throws_ok($$ select public.move_tournament_entry(pg_temp.entry('00000000-0000-4000-8000-000000000214'), 1) $$, '22023', null,
  'not to the table they are at');
select lives_ok($$ select public.move_tournament_entry(pg_temp.entry('00000000-0000-4000-8000-000000000214'), 2) $$, 'Yash moves');
select is_empty($$ select * from public.tournament_balance(pg_temp.sunday()) $$, 'and the tables are balanced');
select throws_ok($$ select public.set_tournament_room(pg_temp.sunday(), 1, 2) $$, '22023', null, 'a table with a player stays');

-- Registration closes after level 9.
select lives_ok($$ select public.start_tournament_clock(pg_temp.sunday()) $$, 'the clock starts');
reset role;
update public.tournament set clock_started_at = now() - interval '206 minutes' where id = pg_temp.sunday();
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 're_entry', '00000000-0000-4000-8000-00000000f008') $$, 'RVTRN', null,
  'at level 10, registration has closed');
reset role;

-- The kill switch stops registration; the practice venue registers on its own.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'tournament_registration', 'Test', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
update public.tournament set clock_started_at = null where id = pg_temp.sunday();
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.register_tournament_entry(pg_temp.sunday(), 're_entry', '00000000-0000-4000-8000-00000000f009') $$, 'RVKIL', null,
  'with tournament registration switched off, nothing is sold');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select public.cage_tournament_entry('00000000-0000-4000-8000-0000000007a3', '00000000-0000-4000-8000-000000000270', 'entry',
  '00000000-0000-4000-8000-00000000f010') $$, 'the practice sit and go takes its own Kabir''s cash');
reset role;

select * from finish();
rollback;
