-- One person, one approval (B3 of the Fix Tracker; the 28 Oct audit): Aditya (103, an admin) makes no second admin
-- login, and the owner hears when Vikram (101, a super admin) grants one, and when a Floor login is made; a staff row with no login is no second super
-- admin for releasing a freeze; nobody changes their own member record's tier or feature overrides; a revoked staff
-- member reads their own shifts no more. 216 Nikhil and 217 Neel are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- An admin grants no role that moves money, approves twice or stops the venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.staff (venue_id, full_name, job_title, role, phone)
                    values ('00000000-0000-4000-8000-000000000001', 'Second Login', 'Floor manager', 'admin', '+919000000981') $$,
  '42501', null, 'an admin makes no second admin login');
select lives_ok($$ insert into public.staff (venue_id, full_name, job_title, role, phone)
                   values ('00000000-0000-4000-8000-000000000001', 'New Floor', 'Floor supervisor', 'floor', '+919000000982') $$,
  'but still adds a Floor member');
reset role;
select results_eq($$ select detail ->> 'role' from public.alert where kind = 'staff.role_granted' $$, $$ values ('floor'::text) $$,
  'and the owner hears of it, as Floor adds bonus chips (the owner, 9 Nov)');

-- A super admin grants one, and the owner hears of it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ insert into public.staff (venue_id, full_name, job_title, role, phone)
                   values ('00000000-0000-4000-8000-000000000001', 'Duty Manager', 'Duty manager', 'admin', '+919000000983') $$,
  'a super admin adds an admin');
reset role;
select results_eq($$ select detail ->> 'role' from public.alert where kind = 'staff.role_granted' order by 1 $$, $$ values ('admin'::text), ('floor') $$,
  'and the owner is told, with the role and no name');

-- Nobody changes their own number or name, which the own-record checks compare; the owner hears when a manager's row
-- changes number.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ update public.staff set phone = '+919000000984' where user_id = auth.uid() and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'RVOWN', null, 'an admin changes not their own number');
select throws_ok($$ update public.staff set full_name = 'Someone Else' where user_id = auth.uid() and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'RVOWN', null, 'nor their own name');
select lives_ok($$ update public.staff set job_title = 'Senior floor manager' where user_id = auth.uid() and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'but changes their own job title');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ update public.staff set phone = '+919000000985' where full_name = 'Duty Manager' and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'a super admin gives the new admin''s row another number');
reset role;
select is((select count(*)::integer from public.alert where kind = 'staff.role_granted'), 3, 'and the owner hears of that too');

-- A placeholder super admin with no login does not count among those able to release a freeze.
create temp table able as select private.engagers('00000000-0000-4000-8000-000000000001', null) as before;
insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'Placeholder', 'Owner', 'super_admin');
select is(private.engagers('00000000-0000-4000-8000-000000000001', null), (select before from able), 'a staff row with no login is no second super admin');

-- Nobody changes their own member record.
update public.member set user_id = '00000000-0000-4000-8000-000000000103' where id = '00000000-0000-4000-8000-000000000216';
update public.member set user_id = '00000000-0000-4000-8000-000000000101' where id = '00000000-0000-4000-8000-000000000217';
create temp table other_tier as
select t.id from public.tier t join public.member m on m.id = '00000000-0000-4000-8000-000000000216'
where t.venue_id = m.venue_id and t.id <> m.tier_id and not t.is_retired order by t.rank limit 1;
grant select on other_tier to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
                    (select id from other_tier), 'Upgrade myself', null) $$, 'RVOWN', null, 'an admin changes not their own tier');
select lives_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
                   (select t.id from public.tier t join public.member m on m.id = '00000000-0000-4000-8000-000000000213'
                    where t.venue_id = m.venue_id and t.id <> m.tier_id and not t.is_retired order by t.rank limit 1), 'Regular', null) $$,
  'but another member''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217',
                    (select f.key from public.feature f where f.is_gateable order by f.key limit 1), true, 'For myself', null) $$,
  'RVOWN', null, 'a super admin overrides no feature on their own record');
reset role;

-- A revoked staff member's own shifts.
insert into public.staff_shift (venue_id, staff_id, club_day, starts_at, ends_at, job_title)
select s.venue_id, s.id, current_date, now(), now() + interval '8 hours', 'Dealer' from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.staff_shift), 1, 'a dealer reads her own shift');
reset role;
insert into public.control_state (venue_id, level, staff_id, reason)
select s.venue_id, 'access_revoke', s.id, 'A lost phone' from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.staff_shift), 0, 'and none once her access is revoked');
reset role;

select * from finish();
rollback;
