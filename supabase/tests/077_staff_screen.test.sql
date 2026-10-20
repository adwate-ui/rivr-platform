-- The Staff screen (#28, decision 0073): a manager adds and changes staff whose role they could give,
-- with a job title separate from the role; a number is on a venue's list once; nobody changes their own
-- role or turns themselves off; a venue keeps two super admins able to release a freeze. 150 Ayesha is a floor manager (admin), 151 Manoj a cashier, 101
-- Vikram and 102 Meera super admins.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- An admin adds a host whose job title is a floor supervisor's: access follows the role, rosters the title.
select pg_temp.as_person('00000000-0000-4000-8000-000000000150');
select lives_ok($$ insert into public.staff (venue_id, full_name, job_title, role, phone)
                   values ('00000000-0000-4000-8000-000000000001', 'Test Supervisor', 'Floor supervisor', 'host', '+919000000901') $$,
  'an admin adds a host with the job title floor supervisor');
select results_eq($$ select job_title, role::text from public.staff where full_name = 'Test Supervisor' $$,
  $$ values ('Floor supervisor'::text, 'host'::text) $$, 'the job title and the role are kept apart');
select throws_ok($$ insert into public.staff (venue_id, full_name, job_title, role, phone)
                   values ('00000000-0000-4000-8000-000000000001', 'Again', 'Host', 'host', '+919000000901') $$,
  '23505', null, 'a number already on the list is not added again, which would lock its owner out at sign-in');
select throws_ok($$ insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'No', 'Cashier', 'cashier') $$,
  '42501', null, 'an admin can''t add a cashier, whose cage permissions they don''t hold');
select throws_ok($$ insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'No', 'Owner', 'super_admin') $$,
  '42501', null, 'nor a super admin');

update public.staff set job_title = 'Host', is_active = false where full_name = 'Test Supervisor';
select results_eq($$ select job_title, is_active from public.staff where full_name = 'Test Supervisor' $$,
  $$ values ('Host'::text, false) $$, 'an admin changes a host''s job title and turns them off');
select throws_ok($$ update public.staff set role = 'super_admin' where full_name = 'Test Supervisor' $$,
  '42501', null, 'but can''t make them a super admin');

select throws_ok($$ update public.staff set role = 'host' where id = (select id from public.staff where user_id = auth.uid() and venue_id = '00000000-0000-4000-8000-000000000001') $$,
  'RVOWN', 'Staff do not change their own role or turn themselves off', 'nobody changes their own role');
select throws_ok($$ update public.staff set is_active = false where id = (select id from public.staff where user_id = auth.uid() and venue_id = '00000000-0000-4000-8000-000000000001') $$,
  'RVOWN', null, 'nor turns themselves off');
select lives_ok($$ update public.staff set job_title = 'Senior floor manager' where user_id = auth.uid() and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'but may change their own job title');

-- A cashier manages no staff.
select pg_temp.as_person('00000000-0000-4000-8000-000000000151');
select throws_ok($$ insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'No', 'Host', 'host') $$,
  '42501', null, 'a cashier adds nobody');
update public.staff set job_title = 'Changed' where full_name = 'Test Supervisor';
select is((select job_title from public.staff where full_name = 'Test Supervisor'), 'Host', 'and changes nobody');

-- The last super admins: the kill switch's floor of two able to release a freeze.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ update public.staff set role = 'admin' where user_id = '00000000-0000-4000-8000-000000000102' and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'a super admin makes another an admin while others remain');
reset role;
select set_config('request.jwt.claims', '', true);
-- Two left, 101 and 113, one of the others with their access revoked: they can't release a freeze.
update public.staff set is_active = false
where venue_id = '00000000-0000-4000-8000-000000000001' and role = 'super_admin'
  and user_id not in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-000000000114');
insert into public.control_state (venue_id, level, staff_id, reason, engaged_by_staff_id)
select s.venue_id, 'access_revoke', s.id, 'A lost phone', (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = s.venue_id)
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000114' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000113' and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'RVLCK', 'That would leave fewer than two super admins able to release a venue freeze',
  'two super admins able to release a freeze stay; one whose access is revoked doesn''t count');
select pg_temp.as_person('00000000-0000-4000-8000-000000000113');
select throws_ok($$ update public.staff set role = 'admin' where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'RVLCK', null, 'and stay super admins');
select lives_ok($$ update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000102' and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'other staff changes still go through');
reset role;

select * from finish();
rollback;
