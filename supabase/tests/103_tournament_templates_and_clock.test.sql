-- Tournament templates, blind structures and the server-side clock (#115, #116, #119; decisions 0200 to
-- 0202). 103 Aditya is an admin (tournaments.manage) at both venues, 106 Pema a dealer, 213 Mihir a
-- member; Elsewhere's cashier runs nothing at the club. A paired TV reads the clock only on its board.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.signals() returns integer language sql as $$
  select count(*)::integer from realtime.messages m
  where m.topic = 'tv:00000000-0000-4000-8000-000000000001' and m.event = 'tournament' and m.inserted_at >= now();
$$;
-- Moves a tournament's clock start back, as if that much time had run.
create function pg_temp.run_for(p_tournament uuid, p_run interval) returns void language sql as $$
  update public.tournament set clock_started_at = clock_started_at - p_run,
                               clock_paused_at = clock_paused_at - p_run
  where id = p_tournament;
$$;
create function pg_temp.clock(p_tournament uuid) returns table (level integer, is_break boolean, seconds_left integer)
language sql security definer as $$
  select c.level, c.is_break, c.seconds_left from public.tournament t
  cross join lateral private.tournament_clock_at(t.levels, private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now())) c
  where t.id = p_tournament;
$$;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');

-- A structure's shape (@rivr/domain structureProblem).
select results_eq(
  $$ select private.blind_levels_problem(l) from (values
       ('[]'::jsonb), ('{}'), ((select jsonb_agg('{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20}'::jsonb) from generate_series(1, 61))),
       ('[{"kind": "break", "minutes": 10}, {"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20}]'),
       ('[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20}, {"kind": "break", "minutes": 10}, {"kind": "break", "minutes": 5}]'),
       ('[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 121}]'),
       ('[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 2.5}]'),
       ('[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20, "colour": "red"}]'),
       ('[{"kind": "pause", "minutes": 20}]'),
       ('[{"kind": "level", "small_blind": 150, "big_blind": 100, "ante": 0, "minutes": 20}]'),
       ('[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": -1, "minutes": 20}]'),
       ('[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 100, "minutes": 20}, {"kind": "break", "minutes": 10}]')) v (l) $$,
  $$ values ('empty'), ('empty'), ('too_long'), ('break_first'), ('breaks_together'), ('minutes'), ('minutes'), ('shape'), ('shape'), ('blinds'),
            ('blinds'), (null::text) $$,
  'a structure the clock cannot run says why; one it can says nothing');

-- The seed: RIVR Sunday's template, and the opening-day tournament made from it.
select results_eq(
  $$ select t.format, t.buy_in_paise, t.fee_paise, t.starting_stack, t.last_registration_level, t.max_buys, t.places_paid, t.guarantee_paise,
            (select count(*)::integer from jsonb_array_elements(s.levels) l where l.value ->> 'kind' = 'level' and (l.value ->> 'minutes')::integer = 20)
     from public.tournament_template t join public.blind_structure s on s.id = t.blind_structure_id
     where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'RIVR Sunday' $$,
  $$ values ('re_entry', 1000000::bigint, 100000::bigint, 30000, 9, null::integer, 8, 50000000::bigint, 25) $$,
  'RIVR Sunday: ₹10,000 with ₹1,000 the fee, 30,000 chips, 20-minute levels, re-entry to level 9, top 8 paid, ₹5,00,000 guaranteed');
select results_eq(
  $$ select format, fee_paise, last_registration_level, places_paid, levels ->> 7 from public.tournament where id = '00000000-0000-4000-8000-0000000007a1' $$,
  $$ values ('re_entry', 100000::bigint, 9, 8, '{"ante": 800, "kind": "level", "minutes": 20, "big_blind": 800, "small_blind": 400}') $$,
  'the opening-day RIVR Sunday copies its template, level 7 at 400/800 ante 800');
select is((select count(*)::integer from public.tournament_template where venue_id = '00000000-0000-4000-8000-000000000002'), 4,
  'the practice venue has the templates and its sit and go');

-- Who sees templates and structures.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.tournament_template), 7, 'an admin sees both venues'' templates');
select is((select count(*)::integer from public.blind_structure), 4, 'and their structures');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.tournament_template union all select 1 from public.blind_structure $$, 'a dealer sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.tournament_template union all select 1 from public.blind_structure $$, 'nor does a member');
reset role;
set local role anon;
select throws_ok($$ select * from public.venue_tournaments('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'anyone signed out runs nothing');
select throws_ok($$ select public.start_tournament_clock('00000000-0000-4000-8000-0000000007a1') $$, '42501', null, 'nor starts a clock');
reset role;
select throws_ok($$ select private.tournament_purchase_refusal('entry', 're_entry', 9, null, false, null, 0, false, false) $$, '22023', null,
  'a purchase checked with a fact missing is a bug, never allowed');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select 1 from public.tournament_template where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'another venue''s admin sees none of the club''s');
select is_empty($$ select * from public.venue_tournaments('00000000-0000-4000-8000-000000000001') $$, 'nor its tournaments');
select throws_ok($$ select public.create_tournament('00000000-0000-4000-8000-0000000007c1', 'Theirs', now(), true) $$, '42501', null,
  'nor makes one from its template');
select throws_ok($$ select public.set_tournament_listing('00000000-0000-4000-8000-0000000007a1', 'Theirs', now(), false) $$, '42501', null,
  'nor lists one');
select throws_ok($$ select public.remove_tournament('00000000-0000-4000-8000-0000000007a1') $$, '42501', null, 'nor removes one');
select throws_ok($$ select public.save_blind_structure('00000000-0000-4000-8000-000000000001', 'Theirs', '[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20}]') $$,
  '42501', null, 'nor keeps a structure there');

-- Keeping structures and templates.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.save_blind_structure('00000000-0000-4000-8000-000000000001', 'Dealer''s', '[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20}]') $$,
  '42501', null, 'a dealer keeps no structures');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.save_blind_structure('00000000-0000-4000-8000-000000000001', '  Short  ',
  '[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 100, "minutes": 15}, {"kind": "break", "minutes": 5}, {"kind": "level", "small_blind": 100, "big_blind": 200, "ante": 200, "minutes": 15}]') $$,
  'an admin keeps a structure');
select throws_ok($$ select public.save_blind_structure('00000000-0000-4000-8000-000000000001', 'Short', '[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20}]') $$,
  '23505', null, 'a name once a venue');
select throws_ok($$ select public.save_blind_structure('00000000-0000-4000-8000-000000000001', 'Bad', '[{"kind": "break", "minutes": 5}]') $$,
  '22023', null, 'and levels the clock can run');
select throws_ok($$ select public.save_blind_structure('00000000-0000-4000-8000-000000000001', 'Elsewhere''s', '[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20}]',
  '00000000-0000-4000-8000-0000000007b3') $$, '42501', null, 'a structure is changed only at its own venue');

create function pg_temp.template(p_changes jsonb) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Short Stack', 'format', 're_entry', 'buy_in_paise', 500000, 'fee_paise', 50000, 'starting_stack', 20000,
    'blind_structure_id', (select id from public.blind_structure where name = 'Short' and venue_id = '00000000-0000-4000-8000-000000000001'),
    'last_registration_level', 2, 'max_buys', 2, 'places_paid', 3) || p_changes;
$$;
grant execute on function pg_temp.template(jsonb) to authenticated;
select lives_ok($$ select public.save_tournament_template('00000000-0000-4000-8000-000000000001', pg_temp.template('{}')) $$, 'an admin keeps a template');
select throws_ok($$ select public.save_blind_structure('00000000-0000-4000-8000-000000000001', 'Short',
  '[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 100, "minutes": 15}]',
  (select id from public.blind_structure where name = 'Short')) $$, '22023', null,
  'a structure keeps the levels its templates register to');
select throws_ok($$ select public.save_tournament_template('00000000-0000-4000-8000-000000000001', pg_temp.template('{"name": "Short 2", "fee_paise": 500000}')) $$,
  '22023', null, 'the fee is less than the buy-in');
select throws_ok($$ select public.save_tournament_template('00000000-0000-4000-8000-000000000001', pg_temp.template('{"name": "Short 2", "last_registration_level": 3}')) $$,
  '22023', null, 'registration ends at one of the structure''s levels');
select throws_ok($$ select public.save_tournament_template('00000000-0000-4000-8000-000000000001', pg_temp.template('{"name": "Short 2", "format": "freezeout"}')) $$,
  '22023', null, 'a freezeout has one buy, set as none');
select throws_ok($$ select public.save_tournament_template('00000000-0000-4000-8000-000000000001', pg_temp.template('{"name": "Short 2", "add_on_paise": 100000}')) $$,
  '22023', null, 'an add-on has a price, a fee and chips together');
select throws_ok($$ select public.save_tournament_template('00000000-0000-4000-8000-000000000001',
  pg_temp.template('{"name": "Short 2", "blind_structure_id": "00000000-0000-4000-8000-0000000007b3"}')) $$, '22023', null, 'on a structure of its own venue');
select throws_ok($$ select public.save_tournament_template('00000000-0000-4000-8000-000000000001', pg_temp.template('{"name": "Short 2", "buy_in_paise": "lots"}')) $$,
  '22023', null, 'with amounts that are numbers');

-- A tournament from the template, listed, and removed.
select lives_ok($$ select public.create_tournament((select id from public.tournament_template where name = 'Short Stack'), 'Test Short', now() + interval '1 hour', false) $$,
  'an admin makes a tournament from a template');
select results_eq($$ select format, buy_in_paise, fee_paise, max_buys, jsonb_array_length(levels), is_published from public.tournament where name = 'Test Short' $$,
  $$ values ('re_entry', 500000::bigint, 50000::bigint, 2, 3, false) $$, 'which copies the template and its levels');
select lives_ok($$ select public.set_tournament_listing((select id from public.tournament where name = 'Test Short'), 'Test Short', now() + interval '2 hours', true) $$,
  'and puts it on the calendar');
select throws_ok($$ select public.set_tournament_listing((select id from public.tournament where name = 'Test Short'), '', now(), true) $$, '22023', null, 'with a name');

-- The clock.
reset role;
create function pg_temp.short() returns uuid language sql as $$ select id from public.tournament where name = 'Test Short'; $$;
grant execute on function pg_temp.short(), pg_temp.clock(uuid) to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.move_tournament_level(pg_temp.short(), 1) $$, '22023', null, 'a clock not started does not move');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.start_tournament_clock(pg_temp.short()) $$, '42501', null, 'another venue''s admin starts no clock here');
reset role;
create temporary table signals_before on commit drop as select pg_temp.signals() as n;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.start_tournament_clock(pg_temp.short()) $$, 'an admin starts the clock');
select throws_ok($$ select public.start_tournament_clock(pg_temp.short()) $$, '22023', null, 'once');
reset role;
select is(pg_temp.signals(), (select n + 1 from signals_before), 'and the TVs are told');
select results_eq($$ select * from pg_temp.clock(pg_temp.short()) $$, $$ values (1, false, 900) $$, 'level 1, in full');
select pg_temp.run_for(pg_temp.short(), interval '16 minutes');
select results_eq($$ select * from pg_temp.clock(pg_temp.short()) $$, $$ values (1, true, 240) $$, 'sixteen minutes on, the break after level 1');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.pause_tournament_clock(pg_temp.short(), true) $$, 'the floor pauses it');
select lives_ok($$ select public.pause_tournament_clock(pg_temp.short(), true) $$, 'pausing again changes nothing');
reset role;
select pg_temp.run_for(pg_temp.short(), interval '10 minutes');
select results_eq($$ select * from pg_temp.clock(pg_temp.short()) $$, $$ values (1, true, 240) $$, 'ten minutes paused, the clock holds');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.pause_tournament_clock(pg_temp.short(), false) $$, 'and sets it running again');
reset role;
select results_eq($$ select * from pg_temp.clock(pg_temp.short()) $$, $$ values (1, true, 240) $$, 'where it stood');
select pg_temp.run_for(pg_temp.short(), interval '1 minute');
select results_eq($$ select * from pg_temp.clock(pg_temp.short()) $$, $$ values (1, true, 180) $$, 'and it runs on');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.move_tournament_level(pg_temp.short(), 1) $$, 'Next level');
select results_eq($$ select * from pg_temp.clock(pg_temp.short()) $$, $$ values (2, false, 900) $$, 'starts level 2 in full');
select throws_ok($$ select public.move_tournament_level(pg_temp.short(), 1) $$, '22023', null, 'and there is nothing after the last');
select throws_ok($$ select public.move_tournament_level(pg_temp.short(), 2) $$, '22023', null, 'the clock moves one stage at a time');
select lives_ok($$ select public.pause_tournament_clock(pg_temp.short(), true) $$, 'paused');
select lives_ok($$ select public.move_tournament_level(pg_temp.short(), -1) $$, 'Previous level');
select results_eq($$ select c.*, t.clock_paused_at is not null from pg_temp.clock(pg_temp.short()) c cross join public.tournament t where t.id = pg_temp.short() $$,
  $$ values (1, true, 300, true) $$, 'goes back to the start of the break, still paused');
select lives_ok($$ select public.move_tournament_level(pg_temp.short(), -1) $$, 'Previous level again');
select lives_ok($$ select public.move_tournament_level(pg_temp.short(), -1) $$, 'and again, at the first');
select results_eq($$ select * from pg_temp.clock(pg_temp.short()) $$, $$ values (1, false, 900) $$, 'stays at the start of level 1');
select lives_ok($$ select public.pause_tournament_clock(pg_temp.short(), false) $$, 'running again');
select results_eq($$ select name, is_paused, elapsed_seconds from public.venue_tournaments('00000000-0000-4000-8000-000000000001') limit 1 $$,
  $$ values ('Test Short', false, 0) $$, 'the console lists the running tournament first, with its clock');

-- The running tournament on Home, for members with tournament registration.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select name, elapsed_seconds, is_paused from public.live_tournament() $$, $$ values ('Test Short', 0, false) $$,
  'a member sees the running tournament on Home');
select throws_ok($$ select public.pause_tournament_clock(pg_temp.short(), true) $$, '42501', null, 'and cannot touch its clock');
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'tournaments.register', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.live_tournament() $$, 'without tournament registration, nothing');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.tournament where id = pg_temp.short() $$, 'nor reads the tournament itself');
reset role;
delete from public.member_feature_override where member_id = '00000000-0000-4000-8000-000000000213' and feature_key = 'tournaments.register';
update public.tournament set is_published = false where id = pg_temp.short();
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.live_tournament() $$, 'nor while it is off the calendar');
reset role;
update public.tournament set is_published = true where id = pg_temp.short();

-- The TV's clock, only on its board.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001031');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d103', '00000000-0000-4000-8000-000000000001', 'tv', 'Clock TV', '00000000-0000-4000-8000-00000000e103');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d103', '00000000-0000-4000-8000-000000000001', 'waitlist');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e103');
select is_empty($$ select * from public.tv_tournament_clock() $$, 'a TV on another board reads no clock');
reset role;
update public.tv_screen set mode = 'tournament_clock' where device_id = '00000000-0000-4000-8000-00000000d103';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e103');
select results_eq($$ select name, jsonb_array_length(levels), is_paused from public.tv_tournament_clock() $$,
  $$ values ('Test Short', 3, false) $$, 'on the tournament clock it reads the running tournament');
reset role;
-- A clock run past its last stage is left behind: nobody finished it.
select pg_temp.run_for(pg_temp.short(), interval '35 minutes');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e103');
select is_empty($$ select * from public.tv_tournament_clock() $$, 'a clock past its last stage is no longer shown');
reset role;

-- The practice venue runs its own clock.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.start_tournament_clock('00000000-0000-4000-8000-0000000007a3') $$, 'the practice sit and go starts');
select results_eq($$ select * from pg_temp.clock('00000000-0000-4000-8000-0000000007a3') $$, $$ values (1, false, 600) $$, 'at level 1');

-- Removing a tournament made by mistake.
select lives_ok($$ select public.remove_tournament(pg_temp.short()) $$, 'an admin removes a tournament nothing refers to');
select is_empty($$ select 1 from public.tournament where name = 'Test Short' $$, 'and it is gone');

-- A frozen venue keeps its clock as it is; the practice venue is not frozen with it.
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.pause_tournament_clock('00000000-0000-4000-8000-0000000007a1', true) $$, 'RVFRZ', null,
  'a freeze stops the clock''s controls');
select throws_ok($$ select public.create_tournament((select id from public.tournament_template where name = 'Short Stack'), 'Frozen', now(), true) $$,
  'RVFRZ', null, 'and making a tournament');
select lives_ok($$ select public.pause_tournament_clock('00000000-0000-4000-8000-0000000007a3', true) $$, 'the practice clock still pauses');
select throws_ok($$ select public.save_blind_structure('00000000-0000-4000-8000-000000000001', 'Frozen',
  '[{"kind": "level", "small_blind": 50, "big_blind": 100, "ante": 0, "minutes": 20}]') $$, 'RVFRZ', null, 'nor keeping structures');
select throws_ok($$ select public.set_tournament_listing('00000000-0000-4000-8000-0000000007a1', 'RIVR Sunday', now(), true) $$, 'RVFRZ', null,
  'nor listing a tournament');
select throws_ok($$ select public.remove_tournament('00000000-0000-4000-8000-0000000007a1') $$, 'RVFRZ', null, 'nor removing one');
reset role;

select * from finish();
rollback;
