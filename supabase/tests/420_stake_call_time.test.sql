-- A stake's call time (redesign RD-16). The super admin (101 Vikram) adds a stake with the call time he types, or with none;
-- a stake with none is given to no table until it has one. Existing stakes keep theirs. Tables setup reads each stake's call
-- time: staff of the venue only (104 Sana, a cashier at the club and the practice venue), never a member (201 Arjun) or
-- another venue's admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.call_time(p_code text) returns integer language sql as $$
  select (private.setting_at('00000000-0000-4000-8000-000000000001', 'call_time.minutes', p_code, now()) ->> 'minutes')::integer;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- Existing stakes keep theirs.
select is(pg_temp.call_time('nlh_50_100'), 180, 'the seeded 50/100 keeps its three hours');
select ok(pg_temp.call_time('private_room') > 0, 'and the Private Room its own');

-- A stake with the call time typed, and one with none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'timed', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 200/400', 20000, 40000, null, 240);
insert into ids select 'untimed', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 500/1000', 50000, 100000);
reset role;
select is(pg_temp.call_time('200_400'), 240, 'a new stake has the call time typed for it, not three hours');
select is(pg_temp.call_time('500_1000'), null, 'and one sent with none has none: nothing is assumed');
select is((select reason from public.setting where venue_id = '00000000-0000-4000-8000-000000000001' and key = 'call_time.minutes' and subject = '200_400'),
  'Set with the stake in Tables setup (RD-16)', 'the setting says where it was set');

-- No table plays a stake that has no call time.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 9', (select id from ids where name = 'untimed'), 9, 5000000) $$,
  'RVNCT', 'Give the stake a call time before a table plays it', 'a stake with no call time is given to no new table');
select throws_ok($$ select public.set_game_table((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 4'),
                    'Table 4', (select id from ids where name = 'untimed'), 9) $$,
  'RVNCT', 'Give the stake a call time before a table plays it', 'nor to a table that has another');
select lives_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 9', (select id from ids where name = 'timed'), 9, 2000000) $$,
  'a stake with a call time is');

-- Its call time, changed with the stake; left out, kept.
select throws_ok($$ select public.set_table_type((select id from ids where name = 'untimed'), 'NLH 500/1000', 50000, 100000, null, 0) $$,
  '22023', 'A stake''s call time is 1 to 1,440 minutes', 'a call time of nothing is refused');
select throws_ok($$ select public.set_table_type((select id from ids where name = 'untimed'), 'NLH 500/1000', 50000, 100000, null, 1441) $$,
  '22023', 'A stake''s call time is 1 to 1,440 minutes', 'and one longer than a day');
select throws_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 1000/2000', 100000, 200000, null, -5) $$,
  '22023', 'A stake''s call time is 1 to 1,440 minutes', 'for a new stake too');
select lives_ok($$ select public.set_table_type((select id from ids where name = 'untimed'), 'NLH 500/1000', 50000, 100000, null, 300) $$,
  'the admin gives the stake five hours');
select lives_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 10', (select id from ids where name = 'untimed'), 9, 5000000) $$,
  'and a table may now play it');
select lives_ok($$ select public.set_table_type((select id from ids where name = 'untimed'), 'NLH 500/1000', 50000, 100000, null, 360) $$,
  'a second change in the same moment replaces the first');
select lives_ok($$ select public.set_table_type((select id from ids where name = 'untimed'), 'High 500/1000', 50000, 100000) $$,
  'a change that leaves the call time out, as an older console sends it');
reset role;
select is(pg_temp.call_time('500_1000'), 360, 'keeps the stake''s six hours');
select is((select name from public.table_type where id = (select id from ids where name = 'untimed')), 'High 500/1000', 'and still renames it');
select is((select count(*)::integer from public.setting where venue_id = '00000000-0000-4000-8000-000000000001' and key = 'call_time.minutes' and subject = '200_400'),
  1, 'a stake saved with the call time it already has writes no second setting');

-- A new stake never takes a code a setting is still kept under. (Signed out, as a migration: nobody signed in backdates a setting.)
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'call_time.minutes', '300_600', '{"minutes": 600}', '-infinity', 'Left by a stake since deleted');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'fresh', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 300/600', 30000, 60000);
reset role;
select is((select code from public.table_type where id = (select id from ids where name = 'fresh')), '300_600_2',
  'a new 300/600 is coded past the settings kept under 300_600');
select is(pg_temp.call_time('300_600_2'), null, 'so it inherits no call time');
-- Any setting keeps a code, not only call time and rake: a rakeback rate left under 400_800.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'rakeback.rate', '400_800', '{"basis_points": 1000, "expires_days": 30}', '-infinity', 'Left by a stake since deleted');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'no_rakeback', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 400/800', 40000, 80000);
reset role;
select is((select code from public.table_type where id = (select id from ids where name = 'no_rakeback')), '400_800_2',
  'a new 400/800 is coded past a rakeback rate kept under 400_800');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'rakeback.rate', '400_800_2', now()), null, 'so it inherits no rakeback');

-- Blinds have a ceiling, refused as any other blind that does not fit, never as a number too big to hold.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'Too big', 5000, 1000005000) $$,
  '22023', 'A blind or straddle is at most 1,00,00,000', 'a big blind above ₹1,00,00,000 is refused');
select throws_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'Far too big', 5000, 100000000000000000) $$,
  '22023', 'A blind or straddle is at most 1,00,00,000', 'and one a hundred of which no bigint holds');
select throws_ok($$ select public.set_table_type((select id from ids where name = 'timed'), 'NLH 200/400', 20000, 40000, 1000005000) $$,
  '22023', 'A blind or straddle is at most 1,00,00,000', 'a straddle too');
select lives_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'The ceiling', 500000000, 1000000000) $$, 'a big blind of exactly ₹1,00,00,000 is taken');
reset role;

-- A stake's call time is set with the stake in Tables setup, so whoever sets up tables writes it as well as staff who
-- change settings (the owner, 25 Nov: the floor sets up tables, and changes no settings). An admin (103 Aditya) is given
-- the one without the other here.
select ok(exists (select 1 from public.role_permission where role = 'floor' and permission = 'tables.manage')
          and not exists (select 1 from public.role_permission where role = 'floor' and permission = 'settings.manage'),
  'the floor sets up tables and changes no settings');
select set_config('request.jwt.claims', '', true);
delete from public.role_permission where role = 'admin' and permission = 'settings.manage';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 700/1400', 70000, 140000, null, 180) $$,
  'an admin who sets up tables adds a stake with a call time, without changing settings');
select lives_ok($$ select public.set_table_type((select id from ids where name = 'timed'), 'NLH 200/400', 20000, 40000, null, 300) $$,
  'and changes a stake''s call time');
select lives_ok($$ select public.set_table_type((select id from ids where name = 'timed'), 'NLH 200/400 late', 20000, 40000, null, 240) $$,
  'the same admin renames the stake, its call time sent as it stands');
insert into ids select 'by_admin', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 600/1200', 60000, 120000);
reset role;
select is(pg_temp.call_time('200_400'), 240, 'so the stake keeps its four hours');
select is(pg_temp.call_time('600_1200'), null, 'and the stake they add without a call time has none');

-- Who reads the stakes' call times.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select t.code, c.call_time_minutes from public.stake_call_times('00000000-0000-4000-8000-000000000001') c
                     join public.table_type t on t.id = c.table_type_id where t.code in ('200_400', '500_1000', '300_600_2', 'nlh_50_100') order by t.code $$,
  $$ values ('200_400'::text, 240), ('300_600_2', 0), ('500_1000', 360), ('nlh_50_100', 180) $$,
  'staff of the club read each stake''s call time, 0 for a stake with none');
select is((select count(*)::integer from public.stake_call_times('00000000-0000-4000-8000-000000000002')), 3,
  'and staff of the practice venue its three stakes'', apart from the club''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.stake_call_times('00000000-0000-4000-8000-000000000001') $$, 'a member reads none');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select * from public.stake_call_times('00000000-0000-4000-8000-000000000001') $$, 'nor another venue''s admin');
select throws_ok($$ select public.set_table_type((select id from ids where name = 'timed'), 'Theirs', 20000, 40000, null, 60) $$, '42501', null,
  'who changes no call time here either');
reset role;
select is(pg_temp.call_time('200_400'), 240, 'so it stays four hours');

select is(has_function_privilege('anon', 'public.stake_call_times(uuid)', 'execute'), false, 'nobody signed out reads call times');
select is(has_function_privilege('anon', 'public.add_table_type(uuid, text, bigint, bigint, bigint, integer)', 'execute'), false, 'or adds a stake');
select is(has_function_privilege('authenticated', 'private.set_stake_call_time(uuid, text, integer)', 'execute'), false,
  'and the call time is set only through the stake');

select * from finish();
rollback;
