-- Limits and breaks (#56). 211 Ishaan has finished the identity check (seed); 212 Vihaan is a member
-- the floor sets a break for; 201 Arjun is another member; 103 Aditya is the floor (members.manage,
-- waitlist.manage); 106 Pema is a dealer. A break takes the member off every waitlist, closes them,
-- and is never shortened.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.as_person(text), pg_temp.type_id(text) to authenticated;

-- The session reminder.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select lives_ok($$ select public.set_session_reminder(4) $$, 'a member sets a 4-hour session reminder');
select results_eq($$ select break_until, session_reminder_hours from public.my_restrictions() $$,
  $$ values (null::timestamptz, 4::smallint) $$, 'and sees it, with no break');
select throws_ok($$ select public.set_session_reminder(5) $$, '22023', null, 'a reminder is 4, 6 or 8 hours');
select lives_ok($$ select public.set_session_reminder(null) $$, 'or none');
select is((select session_reminder_hours from public.my_restrictions()), null::smallint, 'none it is');

-- A break takes the member off every waitlist and closes them.
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'Ishaan joins 100/200');
select isnt(public.join_waitlist(pg_temp.type_id('nlh_50_100'), gen_random_uuid()), null, 'and 50/100');
create temp table first_break as select public.take_break(7) as until;
grant select on first_break to authenticated;
select ok((select until from first_break) between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days',
  'a 7-day break runs seven days from now');
select is((select break_until from public.my_restrictions()), (select until from first_break), 'Profile shows when it ends');
select is_empty($$ select * from public.my_waitlist() $$, 'and both places are gone');
select throws_ok($$ select public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()) $$,
  'RVBRK', null, 'a member on a break cannot join a waitlist');
select is(public.take_break(1), (select until from first_break), 'a shorter break changes nothing: a break is never shortened');
select throws_ok($$ select public.take_break(2) $$, '22023', null, 'a break is 24 hours, 7 days or 30 days');
select throws_ok($$ update public.self_exclusion set ends_at = now() + interval '1 minute' $$, '42501', null,
  'the member cannot change a break');
reset role;
select results_eq($$ select left_reason, count(*)::integer from public.waitlist_entry
                     where member_id = '00000000-0000-4000-8000-000000000211' group by left_reason $$,
  $$ values ('break'::text, 2) $$, 'each place says the break ended it');
select throws_ok($$ delete from public.self_exclusion $$, null, null, 'nor does anyone remove one');
select is((select count(*)::integer from public.outbox_event where event_type = 'member.break_started'), 1, 'member.break_started is emitted once');

-- The floor cannot add a member on a break, and sets breaks with a reason.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_to_waitlist(pg_temp.type_id('nlh_50_100'), '9000000211', gen_random_uuid()) $$,
  'RVBRK', null, 'the floor cannot add a member on a break');
select isnt(public.set_member_break('00000000-0000-4000-8000-000000000212', 30, 'Asked at the front desk'), null,
  'the floor sets a 30-day break with a reason');
select throws_ok($$ select public.set_member_break('00000000-0000-4000-8000-000000000201', 30, 'no') $$, '22023', null, 'not without a reason');
select throws_ok($$ select public.set_member_break('00000000-0000-4000-8000-000000000201', 0, 'Asked at the desk') $$, '22023', null,
  'nor for no time');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.set_member_break('00000000-0000-4000-8000-000000000201', 30, 'Asked at the desk') $$, '42501', null,
  'a dealer does not set breaks');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.set_member_break('00000000-0000-4000-8000-000000000201', 30, 'Asked at the desk') $$, '42501', null,
  'nor does a member, for another');

-- Who sees breaks: the member their own, staff who read members the venue's.
select is((select count(*)::integer from public.self_exclusion), 1, 'a member sees only their own break');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.self_exclusion $$, 'another member sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.self_exclusion), 2, 'the floor sees the venue''s breaks');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.self_exclusion $$, 'a dealer sees none');
reset role;
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.self_exclusion $$, 'staff at the practice venue only see none of the club''s');
reset role;
set local role anon;
select throws_ok($$ select public.take_break(1) $$, '42501', null, 'nobody signed out takes a break');
reset role;

select * from finish();
rollback;
