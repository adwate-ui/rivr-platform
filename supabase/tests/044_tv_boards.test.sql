-- TV boards (#65): a paired TV reads its own venue's waitlist board while it shows it (players as
-- first name and initial, in the floor's order, every stake) and its jackpot with tonight's high
-- hand; nobody else reads them; the database broadcasts on the venue's private topic when what a
-- board shows changes, and only the venue's TVs may hear it. The seed has Kabir Sethi, Naina Kapoor
-- and Rohan Bhatia waiting for 100/200, nobody for 50/100, and a main pool of ₹3,42,600, in both venues,
-- and tonight's high hand (56_floor.sql).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
-- The broadcasts on a topic since the test began, as the database owner sees them.
create function pg_temp.signals(p_topic text, p_event text) returns integer language sql as $$
  select count(*)::integer from realtime.messages m where m.topic = p_topic and m.event = p_event and m.inserted_at >= now();
$$;
grant execute on function pg_temp.as_person(text) to authenticated, anon;

-- The seed's high hand (56_floor.sql), where it was played after 06:00 IST today, and the practice venue's stakes.
create temp table seed_high_hand on commit drop as
select h.venue_id, c.category from public.high_hand_claim c join public.hand h on h.id = c.hand_id
where h.idempotency_key = 'seed:high-hand' and h.played_at >= private.tonight_began(now());
create temp table practice_types on commit drop as
select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000002';
grant select on seed_high_hand, practice_types to authenticated;

-- A paired TV at the club and one at the practice venue, both on the waitlist board, and a tablet.
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
  ('00000000-0000-4000-8000-00000000d202', '00000000-0000-4000-8000-000000000002', 'waitlist');
-- The club's stakes, as the database owner sees them (a TV reads no table directly).
create temporary table stakes on commit drop as
select id, code from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on stakes to authenticated;

select is(private.first_name_and_initial('Arjun Mehta'), 'Arjun M.', 'a player is a first name and initial');
select is(private.first_name_and_initial('  Rahul  Kumar Sharma '), 'Rahul S.', 'the initial of the last name');
select is(private.first_name_and_initial('Arjun.Mehta'), 'Arjun M.', 'a dot splits names as a space does');
select is(private.first_name_and_initial(E'\tArjun-Mehta\n'), 'Arjun M.', 'and so does a hyphen, with tabs and new lines trimmed');
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
  $$ select 34260000::bigint, (select category from seed_high_hand where venue_id = '00000000-0000-4000-8000-000000000001') $$,
  'the jackpot is ₹3,42,600, with the seed''s high hand when it was played tonight');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e202');
select results_eq($$ select display_name from public.tv_waitlist_board() where place is not null order by place $$,
  $$ values ('Kabir S.'::text), ('Naina K.'), ('Rohan B.') $$, 'the practice TV shows the practice venue''s own list');
select is_empty($$ select * from public.tv_waitlist_board() where table_type_id not in (select id from practice_types) $$, 'and none of the club''s');
select results_eq($$ select main_paise from public.tv_jackpot() $$, $$ values (34260000::bigint) $$, 'and the practice venue''s own jackpot');
reset role;
update public.tv_screen set mode = 'jackpot' where device_id = '00000000-0000-4000-8000-00000000d201';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e201');
select is_empty($$ select * from public.tv_waitlist_board() $$, 'a TV showing the jackpot reads no names');
select results_eq($$ select main_paise from public.tv_jackpot() $$, $$ values (34260000::bigint) $$, 'only its jackpot');
reset role;
update public.tv_screen set mode = 'waitlist' where device_id = '00000000-0000-4000-8000-00000000d201';

-- A venue with nothing on its floor yet: an empty jackpot and no high hand tonight. Operations create venues signed out.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f4', 'New room', 'new-room', false, 'New room', 'Elsewhere', 'NEW');
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e204', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000204');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d204', '00000000-0000-4000-8000-0000000000f4', 'tv', 'New TV', '00000000-0000-4000-8000-00000000e204');
insert into public.tv_screen (device_id, venue_id, mode) values ('00000000-0000-4000-8000-00000000d204', '00000000-0000-4000-8000-0000000000f4', 'jackpot');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e204');
select results_eq($$ select main_paise, high_hand_category from public.tv_jackpot() $$, $$ values (0::bigint, null::public.high_hand_category) $$,
  'a new venue''s TV shows an empty jackpot, with no high hand yet tonight');
reset role;

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

-- Broadcasts: when what a board shows changes, and only then.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, idempotency_key)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', id, gen_random_uuid() from stakes where code = 'nlh_50_100';
select is(pg_temp.signals('tv:00000000-0000-4000-8000-000000000001', 'waitlist'), 1, 'joining the waitlist tells the venue''s TVs');
update public.waitlist_entry set updated_at = now() where member_id = '00000000-0000-4000-8000-000000000201';
select is(pg_temp.signals('tv:00000000-0000-4000-8000-000000000001', 'waitlist'), 1, 'a change the board does not show tells them nothing');
update public.game_table set is_open = not is_open where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1';
select is(pg_temp.signals('tv:00000000-0000-4000-8000-000000000001', 'waitlist'), 2, 'a table opening or closing does, for the count of tables open');
select set_config('request.jwt.claims', '', true);
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'test', 'tv-signal-rake',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.chips_outstanding'), 'amount', '5000'),
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.rake'), 'amount', '-5000')),
  'promotions', 'Test');
select is(pg_temp.signals('tv:00000000-0000-4000-8000-000000000001', 'jackpot'), 0, 'rake alone does not touch the jackpot');
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'test', 'tv-signal-drop',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.chips_outstanding'), 'amount', '5000'),
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.jackpot.main'), 'amount', '-5000')),
  'promotions', 'Test');
select is(pg_temp.signals('tv:00000000-0000-4000-8000-000000000001', 'jackpot'), 1, 'a drop into the main pool tells the TVs');
select is((select count(*)::int from realtime.messages where topic like 'tv:00000000-0000-4000-8000-000000000002' and inserted_at >= now()), 0,
  'and nothing reaches the practice venue''s topic');
select ok((select bool_and(payload - 'event' - 'id' - 'type' = jsonb_build_object('board', event)) from realtime.messages
           where topic like 'tv:%' and inserted_at >= now()), 'a message names its board and nothing else');

-- Who hears a topic.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e201');
select set_config('realtime.topic', 'tv:00000000-0000-4000-8000-000000000001', true);
select ok((select count(*) > 0 from realtime.messages where extension = 'broadcast'), 'the bar TV hears its venue''s topic');
select set_config('realtime.topic', 'tv:00000000-0000-4000-8000-000000000002', true);
select is_empty($$ select * from realtime.messages $$, 'but not the practice venue''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select set_config('realtime.topic', 'tv:00000000-0000-4000-8000-000000000001', true);
select is_empty($$ select * from realtime.messages $$, 'a member hears no TV topic');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from realtime.messages $$, 'nor does staff');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e201');
select results_eq($$ select place, display_name from public.tv_waitlist_board() where table_type_id = (select id from stakes where code = 'nlh_50_100') $$,
  $$ values (1, 'Arjun M.'::text) $$, 'and the board reads the list as it is now');
reset role;

select * from finish();
rollback;
