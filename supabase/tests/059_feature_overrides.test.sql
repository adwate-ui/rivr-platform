-- Feature overrides on the member record (#61). Every tier has every gateable feature (bootstrap).
-- 101 is a super admin; 110 a membership manager (admin); 108 a host. Kabir Sethi (202) and Naina
-- Kapoor (203) are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Learn, the Academy and Events are off since #637 (decision 0284): this test of them turns them back on for every tier.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, k.key, true, 'locked', now() - interval '1 second'
from public.tier t cross join (values ('learn.library'), ('academy.booking'), ('events.book')) as k (key);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- Only a super admin; never written directly.
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'learn.library',
  false, 'Not yet') $$, '42501', null, 'a membership manager does not override features');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'learn.library', false, 'Direct') $$,
  '42501', null, 'nor does a super admin write one directly');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'core.kyc',
  false, 'Core') $$, '22023', null, 'a core feature is never overridden');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'learn.library',
  false, 'no') $$, '22023', null, 'a reason of three characters or more');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'learn.library',
  false, 'Past', (now() at time zone 'Asia/Kolkata')::date - 2) $$, '22023', null, 'a last day still to come');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', 'learn.library',
  false, 'Other venue') $$, 'RVNOM', null, 'a member of this venue');

-- Learn taken away from Kabir alone, then replaced, then lifted.
insert into ids select 'away', public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202',
  'learn.library', false, 'Sharing drills outside the club', (now() at time zone 'Asia/Kolkata')::date + 7);
reset role;
select ok(not private.has_feature('00000000-0000-4000-8000-000000000202', 'learn.library'), 'Kabir loses Learn');
select ok(private.has_feature('00000000-0000-4000-8000-000000000203', 'learn.library'), 'Naina keeps it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select feature_name, is_granted, reason, until, standing, staff_name
                     from public.member_feature_overrides('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$,
  $$ select 'Learn library'::text, false, 'Sharing drills outside the club'::text, (now() at time zone 'Asia/Kolkata')::date + 7, 'in_force'::text,
            (select full_name from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001') $$,
  'the super admin sees it: feature, taken away, why, the last day, in force, and who');
insert into ids select 'back', public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202',
  'learn.library', true, 'Sorted out with the owner');
select results_eq($$ select is_granted, standing from public.member_feature_overrides('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000202') order by is_granted $$,
  $$ values (false, 'replaced'::text), (true, 'in_force') $$, 'a new override replaces the one in force');
select throws_ok($$ select public.lift_feature_override('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'back'), 'ok') $$,
  '22023', null, 'a lift needs a reason of three characters or more');
select lives_ok($$ select public.lift_feature_override('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'back'), 'Settled for good') $$,
  'and one in force can be lifted, with a reason');
select throws_ok($$ select public.lift_feature_override('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'back'), 'Again') $$,
  'RVOVR', null, 'but only while it is in force');
select results_eq($$ select standing, lifted_by, lift_reason from public.member_feature_overrides('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000202') where is_granted $$,
  $$ select 'lifted'::text, (select full_name from public.staff where user_id = '00000000-0000-4000-8000-000000000101'
            and venue_id = '00000000-0000-4000-8000-000000000001'), 'Settled for good'::text $$, 'the lift keeps who and why');
reset role;
select ok(private.has_feature('00000000-0000-4000-8000-000000000202', 'learn.library'), 'lifted, his tier decides again');

-- Hidden from every other role; the member sees their own.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is_empty($$ select id from public.member_feature_override $$, 'a host sees no overrides');
select is_empty($$ select * from public.member_feature_overrides('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$,
  'nor through the record');
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select is_empty($$ select id from public.member_feature_override $$, 'nor does a membership manager');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is((select count(*)::integer from public.member_feature_override), 2, 'Kabir sees that his own exist');
select throws_ok($$ select reason from public.member_feature_override $$, '42501', null, 'but never why');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select is_empty($$ select id from public.member_feature_override $$, 'Naina sees none of his');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is_empty($$ select id from public.member_feature_override where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'the practice venue''s super admin sees no club override');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001';

-- Not while the venue is frozen.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'learn.library',
  false, 'Frozen') $$, 'RVFRZ', null, 'no override while the venue is frozen');
reset role;

select * from finish();
rollback;
