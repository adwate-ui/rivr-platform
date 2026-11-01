-- The live floor (#638): a table's opening and closing is kept as a run, and the floor (waitlist.manage: 103 Aditya) changes
-- a seated player's call time: adding to it, or, with the admin's override, cutting it. 211 Ishaan has finished his identity
-- check; 111 Zoya is a host (waitlist.manage, no override); 106 Pema is a dealer. Table 4 is closed (seed).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Another venue's admin, who reads nothing here (made first: a venue's settings start now).
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');

delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select is((select count(*)::integer from public.table_run r join public.game_table g on g.id = r.table_id
           where g.is_open and r.closed_at is null), (select count(*)::integer from public.game_table where is_open),
  'every open table has a run going');
select is((select count(*)::integer from public.table_run where table_id = pg_temp.t('Table 4')), 0, 'and a closed one has none');

-- Opening Table 4 starts a run, with who opened it; closing it ends the run.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_table_open(pg_temp.t('Table 4'), true) $$, 'the floor opens Table 4');
select results_eq($$ select closed_at is null, s.full_name from public.table_run r join public.staff s on s.id = r.opened_by_staff_id
                     where r.table_id = pg_temp.t('Table 4') $$, $$ values (true, 'Aditya Malhotra'::text) $$, 'a run starts, opened by Aditya');
select lives_ok($$ select public.set_table_open(pg_temp.t('Table 4'), false) $$, 'and closes it');
select results_eq($$ select closed_at is not null, closed_by_staff_id is not null from public.table_run where table_id = pg_temp.t('Table 4') $$,
  $$ values (true, true) $$, 'the run ends, with who closed it');
select lives_ok($$ select public.set_table_open(pg_temp.t('Table 4'), true) $$, 'opening it again');
select is((select count(*)::integer from public.table_run where table_id = pg_temp.t('Table 4')), 2, 'starts a second run');
reset role;
select throws_ok($$ insert into public.table_run (venue_id, table_id) values ('00000000-0000-4000-8000-000000000001', pg_temp.t('Table 4')) $$,
  '23505', null, 'a table has one run going at a time');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.table_run), 0, 'a dealer reads no runs');
reset role;

-- The floor changes Ishaan's call time; a dealer cannot.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Table 3'), 2, '9000000211');
select lives_ok($$ select public.set_seat_call_time((select id from ids), 240) $$, 'the floor gives Ishaan four hours of call time');
select is((select call_time_left from public.floor_seats('00000000-0000-4000-8000-000000000001') where full_name = 'Ishaan Verma'), 14400,
  'which the floor reads');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000111');
select throws_ok($$ select public.set_seat_call_time((select id from ids), 60) $$, '42501', null, 'a host cuts no call time: that is the admin''s override');
select lives_ok($$ select public.set_seat_call_time((select id from ids), 300) $$, 'but adds to it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_seat_call_time((select id from ids), 0) $$, 'an admin takes it to none');
select is((select call_time_left from public.floor_seats('00000000-0000-4000-8000-000000000001') where full_name = 'Ishaan Verma'), null::integer,
  'so he has no call time');
select throws_ok($$ select public.set_seat_call_time((select id from ids), 1441) $$, '22023', null, 'at most a day');
reset role;
update public.seat_session set call_time_minutes = 60, call_time_completed_at = now() where id = (select id from ids);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_seat_call_time((select id from ids), 120) $$, '22023', null,
  'and a call time played out is not changed, so he never comes to owe time');
reset role;
update public.seat_session set call_time_minutes = 60, call_time_completed_at = null, started_at = now() - interval '61 minutes'
where id = (select id from ids);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_seat_call_time((select id from ids), 120) $$, '22023', null,
  'nor one played out that the minute''s sweep has not marked yet');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.set_seat_call_time((select id from ids), 60) $$, '42501', null, 'a dealer changes no call time');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is((select count(*)::integer from public.table_run where venue_id = '00000000-0000-4000-8000-000000000001'), 0,
  'another venue''s admin reads none of the club''s runs');
select throws_ok($$ select public.set_seat_call_time((select id from ids), 300) $$, '42501', null, 'nor changes a call time here');
reset role;

select is(has_function_privilege('anon', 'public.set_seat_call_time(uuid, integer)', 'execute'), false, 'nobody signed out changes one');

select * from finish();
rollback;
