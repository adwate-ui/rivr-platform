-- Deleting a stake (redesign RD-17). The super admin (101 Vikram) deletes a stake no table uses; one a table plays, or a
-- deleted table's history keeps, is refused. A host (111 Zoya) and another venue's admin delete none; nor does anyone at
-- the practice venue who is not its tables manager. Its settings stay, and a later stake takes another code.
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
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
-- A stake of the practice venue, read here: another venue's admin cannot see it to name it.
insert into ids select 'practice', id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000002' and code = 'nlh_50_100';

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'unused', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 200/400', 20000, 40000, null, 240);
insert into ids select 'played', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 500/1000', 50000, 100000, null, 240);
insert into ids select 'history', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 1000/2000', 100000, 200000, null, 240);
insert into ids select 'table', public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 9', (select id from ids where name = 'played'), 9, 5000000);
insert into ids select 'gone', public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 10', (select id from ids where name = 'history'), 9, 10000000);
select lives_ok($$ select public.delete_game_table((select id from ids where name = 'gone')) $$, 'a table of the third stake is deleted, its history kept');

-- Who may not.
select pg_temp.as_person('00000000-0000-4000-8000-000000000111');
select throws_ok($$ select public.delete_table_type((select id from ids where name = 'unused')) $$, '42501', 'Only the super admin sets up tables',
  'a host deletes no stake');
select throws_ok($$ select public.delete_table_type(gen_random_uuid()) $$, '42501', 'Only the super admin sets up tables',
  'nor learns whether a stake is there');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.delete_table_type((select id from ids where name = 'unused')) $$, '42501', 'Only the super admin sets up tables',
  'another venue''s admin deletes none here');
select throws_ok($$ select public.delete_table_type((select id from ids where name = 'practice')) $$, '42501', 'Only the super admin sets up tables',
  'nor at the practice venue');
select lives_ok($$ select public.delete_table_type(gen_random_uuid()) $$, 'and a stake that is not there is nothing to an admin of anywhere');
reset role;
select is((select count(*)::integer from public.table_type where id in (select id from ids)), 4, 'so every stake is still there');

-- A stake in use stays.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.delete_table_type((select id from ids where name = 'played')) $$, 'RVUSE', 'A table still uses that stake',
  'a stake a table plays is not deleted');
select throws_ok($$ select public.delete_table_type((select id from ids where name = 'history')) $$, 'RVUSE', 'A table still uses that stake',
  'nor one a deleted table''s history keeps');
select throws_ok($$ select public.delete_table_type((select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_100_200')) $$,
  'RVUSE', 'A table still uses that stake', 'nor the club''s 100/200, which four tables play');

-- A stake nothing uses goes, for good.
select lives_ok($$ select public.delete_table_type((select id from ids where name = 'unused')) $$, 'the super admin deletes the stake no table uses');
select lives_ok($$ select public.delete_table_type((select id from ids where name = 'unused')) $$, 'and again is nothing');
reset role;
select is_empty($$ select 1 from public.table_type where id = (select id from ids where name = 'unused') $$, 'it is gone');
select is((private.setting_at('00000000-0000-4000-8000-000000000001', 'call_time.minutes', '200_400', now()) ->> 'minutes')::integer, 240,
  'its call time setting stays under its code, as history');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'again', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 200/400', 20000, 40000);
reset role;
select is((select code from public.table_type where id = (select id from ids where name = 'again')), '200_400_2',
  'and a 200/400 made afterwards takes another code, so it inherits none of it');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'call_time.minutes', '200_400_2', now()), null, 'and has no call time until it is given one');

select is(has_function_privilege('anon', 'public.delete_table_type(uuid)', 'execute'), false, 'nobody signed out deletes a stake');

select * from finish();
rollback;
