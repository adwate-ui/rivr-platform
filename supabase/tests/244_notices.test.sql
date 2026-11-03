-- Notices (decision 0298): staff with settings.manage put up a line for members' Home and end it; members of the club
-- read only their club's notices in force; others cannot write them. 102 Meera is a super admin; 108 Karan a host;
-- 201 Arjun a member; Elsewhere's member reads none of RIVR's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated', '919000000997', now(), now());
insert into public.member (venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e3', 'Elsewhere Member', '+919000000997');

select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
create temp table posted as select public.post_notice('00000000-0000-4000-8000-000000000001', '  We''re launching soon.  ') as id;
grant select on posted to authenticated;
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', '   ') $$, '22023', null, 'a notice says something');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', repeat('x', 501)) $$, '22023', null,
  'in at most 500 characters (decision 0424)');
select results_eq($$ select body from public.venue_notices('00000000-0000-4000-8000-000000000001') where notice_id = (select id from posted) $$,
  $$ values ('We''re launching soon.'::text) $$, 'staff see it, trimmed');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', 'Mine') $$, '42501', null, 'a host puts up none');
select throws_ok($$ select public.end_notice((select id from posted)) $$, '42501', null, 'nor ends one');
select is((select count(*)::integer from public.venue_notices('00000000-0000-4000-8000-000000000001')), 0, 'nor reads the list');

select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select body from public.my_notices() where notice_id = (select id from posted) $$,
  $$ values ('We''re launching soon.'::text) $$, 'Arjun reads it on Home');
select throws_ok($$ select count(*) from public.notice $$, '42501', null, 'but not the table itself');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', 'Mine') $$, '42501', null, 'and puts up none');

select pg_temp.as_person('00000000-0000-4000-8000-0000000000e3');
select is((select count(*)::integer from public.my_notices()), 0, 'another club''s member reads none of RIVR''s');

-- Ended, it leaves Home.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
-- It must have started before it can end: move it a minute back, as time would.
reset role;
update public.notice set starts_at = now() - interval '1 minute' where id = (select id from posted);
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select lives_ok($$ select public.end_notice((select id from posted)) $$, 'Meera ends it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.my_notices() where notice_id = (select id from posted)), 0, 'and it is gone from Home');

select * from finish();
rollback;
