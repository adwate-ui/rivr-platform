-- TV boards (#65): a paired TV reads its own venue's waitlist board (players as first name and
-- initial, in the floor's order, every stake) and its jackpot with tonight's high hand; nobody else
-- reads them; tv_signal moves when the waitlist, the main pool or a high hand changes, and only the
-- venue's TVs and staff see it. The seed has Kabir Sethi, Naina Kapoor and Rohan Bhatia waiting for
-- 100/200, nobody for 50/100, and a main pool of ₹3,42,600.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated, anon;

-- A paired TV at the club and one at the practice venue, and a dealer tablet.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000201'),
  ('00000000-0000-4000-8000-00000000e202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000202'),
  ('00000000-0000-4000-8000-00000000e203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000203');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d201', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e201'),
  ('00000000-0000-4000-8000-00000000d202', '00000000-0000-4000-8000-000000000002', 'tv', 'Practice TV', '00000000-0000-4000-8000-00000000e202'),
  ('00000000-0000-4000-8000-00000000d203', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet', '00000000-0000-4000-8000-00000000e203');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d201', '00000000-0000-4000-8000-000000000001', 'waitlist'),
  ('00000000-0000-4000-8000-00000000d202', '00000000-0000-4000-8000-000000000002', 'jackpot');
-- The club's stakes, as the database owner sees them (a TV reads no table directly).
create temporary table stakes on commit drop as
select id, code from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on stakes to authenticated;

select is(private.first_name_and_initial('Arjun Mehta'), 'Arjun M.', 'a player is a first name and initial');
select is(private.first_name_and_initial('  Rahul  Kumar Sharma '), 'Rahul S.', 'the initial of the last name');
select is(private.first_name_and_initial('Cher'), 'Cher', 'a single name stays whole');

-- The waitlist board.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e201');
select results_eq($$ select place, display_name from public.tv_waitlist_board() where table_type_id = (select id from stakes where code = 'nlh_100_200') $$,
  $$ values (1, 'Kabir S.'::text), (2, 'Naina K.'::text), (3, 'Rohan B.'::text) $$,
  'the bar TV shows 100/200''s list in order, each as a first name and initial');
select ok((select count(*) = 1 and bool_and(place is null) from public.tv_waitlist_board() b
           where b.table_type_id = (select id from stakes where code = 'nlh_50_100')),
  'a stake nobody waits for is on the board, empty');
select ok(not exists (select 1 from public.tv_waitlist_board() b where b.display_name in ('Kabir Sethi', 'Naina Kapoor', 'Rohan Bhatia')),
  'and no full name reaches the TV');
select is((select count(distinct table_type_id)::int from public.tv_waitlist_board()), (select count(*)::int from stakes),
  'every stake at the venue, and only that venue''s');
select results_eq($$ select main_paise, high_hand_category from public.tv_jackpot() $$,
  $$ values (34260000::bigint, null::public.high_hand_category) $$, 'the jackpot is ₹3,42,600, with no high hand yet tonight');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e202');
select is_empty($$ select * from public.tv_waitlist_board() where place is not null $$, 'the practice TV shows the practice venue''s empty lists');
select results_eq($$ select main_paise from public.tv_jackpot() $$, $$ values (0::bigint) $$, 'and the practice venue''s own jackpot');

-- Nobody else reads the boards.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e203');
select is_empty($$ select * from public.tv_waitlist_board() $$, 'a dealer tablet reads no TV board');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.tv_waitlist_board() $$, 'nor does staff, who use the console''s board');
select is_empty($$ select * from public.tv_jackpot() $$, 'nor the TV jackpot');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is_empty($$ select * from public.tv_waitlist_board() $$, 'nor a member waiting on it');
reset role;
set local role anon;
select throws_ok($$ select * from public.tv_waitlist_board() $$, '42501', null, 'and a signed-out caller is refused');
reset role;

-- Signals: the waitlist and the main pool move them.
delete from public.tv_signal;
insert into public.waitlist_entry (venue_id, member_id, table_type_id, idempotency_key)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', id, gen_random_uuid() from stakes where code = 'nlh_50_100';
select ok(exists (select 1 from public.tv_signal where venue_id = '00000000-0000-4000-8000-000000000001' and board = 'waitlist'),
  'joining the waitlist tells the venue''s TVs');
select set_config('request.jwt.claims', '', true);
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'test', 'tv-signal-test',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.chips_outstanding'), 'amount', '5000'),
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.jackpot.main'), 'amount', '-5000')),
  'promotions', 'Test');
select ok(exists (select 1 from public.tv_signal where venue_id = '00000000-0000-4000-8000-000000000001' and board = 'jackpot'),
  'a drop into the main pool tells them too');
select ok(not exists (select 1 from public.tv_signal where venue_id = '00000000-0000-4000-8000-000000000002'), 'and not the practice venue''s');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e201');
select is((select count(*)::int from public.tv_signal), 2, 'the bar TV sees its venue''s signals');
select results_eq($$ select place, display_name from public.tv_waitlist_board() where table_type_id = (select id from stakes where code = 'nlh_50_100') $$,
  $$ values (1, 'Arjun M.'::text) $$, 'and the board reads the list as it is now');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e202');
select is_empty($$ select * from public.tv_signal $$, 'the practice TV sees none of the club''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.tv_signal $$, 'nor does a member');
reset role;

select * from finish();
rollback;
