-- Tables setup (#642): the super admin (tables.manage: 101 Vikram; an admin, 103 Aditya, holds it too) adds a stake with three
-- hours of call time, adds a table of it, closed, last on the floor, and changes its seats and stake. A host (111 Zoya,
-- floor work only) sets up nothing; another venue's admin nothing here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Another venue's admin (made first: a venue's settings start now).
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
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'plo', public.add_table_type('00000000-0000-4000-8000-000000000001', 'PLO 200/400', 20000, 40000);
insert into ids select 'straddle', public.add_table_type('00000000-0000-4000-8000-000000000001', 'Straddle 200/400', 20000, 40000, 80000);
select throws_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'Odd', 12345, 40000) $$, '22023', null,
  'blinds are whole ₹50 chips');
select throws_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'Upside down', 40000, 20000) $$, '22023', null,
  'the big blind above the small');
select throws_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'Low straddle', 20000, 40000, 40000) $$, '22023', null,
  'a straddle above the big blind');
select throws_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'Odd straddle', 20000, 40000, 81000) $$, '22023', null,
  'in whole ₹50 chips');
reset role;
select results_eq($$ select code, game, small_blind_paise, big_blind_paise, straddle_paise from public.table_type
                     where id in (select id from ids where name in ('plo', 'straddle')) order by code $$,
  $$ values ('200_400'::text, null::text, 20000::bigint, 40000::bigint, null::bigint), ('200_400_2'::text, null::text, 20000::bigint, 40000::bigint, 80000::bigint) $$,
  'the super admin adds stakes with no game, coded by their blinds, one with a straddle (decision 0299)');
select is((private.setting_at('00000000-0000-4000-8000-000000000001', 'call_time.minutes', '200_400', now()) ->> 'minutes')::integer, 180,
  'with three hours of call time');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'table', public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 9', (select id from ids where name = 'plo'), 8);
select throws_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 9', (select id from ids where name = 'plo'), 8) $$,
  '22023', null, 'a table''s name is its own');
select throws_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 10', (select id from ids where name = 'plo'), 11) $$,
  '22023', null, 'and it has 2 to 10 seats');
reset role;
select results_eq($$ select name, seats, is_open, position = (select max(position) from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001')
                     from public.game_table where id = (select id from ids where name = 'table') $$,
  $$ values ('Table 9'::text, 8, false, true) $$, 'the new table has its 8 seats, closed, last on the floor');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_game_table((select id from ids where name = 'table'), 'Table 9', (select id from ids where name = 'plo'), 6) $$,
  'an admin sets it to 6 seats');
select lives_ok($$ select public.set_table_type((select id from ids where name = 'plo'), 'PLO 250/500', 25000, 50000) $$, 'and changes the stake''s blinds');
select lives_ok($$ select public.set_table_type((select id from ids where name = 'straddle'), 'Straddle 200/400', 20000, 40000, 100000) $$,
  'and another''s straddle');
select lives_ok($$ select public.set_table_type((select id from ids where name = 'straddle'), 'Straddle 200/400', 20000, 40000) $$,
  'then takes it off');
reset role;
select results_eq($$ select g.seats, t.name, t.small_blind_paise, t.big_blind_paise from public.game_table g join public.table_type t on t.id = g.table_type_id
                     where g.id = (select id from ids where name = 'table') $$,
  $$ values (6, 'PLO 250/500'::text, 25000::bigint, 50000::bigint) $$, 'the table plays 250/500 on 6 seats');
select is((select straddle_paise from public.table_type where id = (select id from ids where name = 'straddle')), null::bigint, 'no straddle once taken off');

-- A table with a player keeps its stake until they move.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 2,
  '9000000211'), null, 'the floor seats Ishaan at Table 3');
select throws_ok($$ select public.set_game_table((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'),
                    'Table 3', (select id from ids where name = 'plo'), 9) $$, 'RVSTD', null, 'so Table 3''s stake stays while he plays');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000111');
select throws_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 11', (select id from ids where name = 'plo'), 8) $$,
  '42501', null, 'a host adds no table');
select lives_ok($$ update public.game_table set seats = 4 where id = (select id from ids where name = 'table') $$,
  'and her change by the API reaches no row');
reset role;
select is((select seats from public.game_table where id = (select id from ids where name = 'table')), 6, 'so it keeps its 6 seats');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.add_table_type('00000000-0000-4000-8000-000000000001', 'Theirs', 5000, 10000) $$, '42501', null,
  'another venue''s admin adds no stake here');
reset role;

select is(has_function_privilege('anon', 'public.add_game_table(uuid, text, uuid, integer, text)', 'execute'), false, 'nobody signed out adds a table');

select * from finish();
rollback;
