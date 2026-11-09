-- Activity and Past controls (8 Nov audit, I-75, F-034), for super admins alone: who did what, about whom, why and when, filtered and
-- read a page at a time, and never a row's before or after. Forty days ago, so the seed's rows stay out of the day read.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table day as select private.club_day_of(now()) - 40 as d;
grant select on day to authenticated;
create function pg_temp.at(p_time text) returns timestamptz language sql as $$
  select ((select d from day)::timestamp + p_time::interval) at time zone 'Asia/Kolkata';
$$;
grant execute on function pg_temp.at(text) to authenticated;
create function pg_temp.staff_of(p_user text) returns uuid language sql as $$
  select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and user_id = p_user::uuid;
$$;

-- A tablet's own login, which is nobody's.
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000d3871', 'authenticated', 'authenticated', '+919000003871', now(), now());
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-0000000d3872', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet of Table 7', '00000000-0000-4000-8000-0000000d3871');

insert into public.audit_log (venue_id, occurred_at, actor_user_id, device_id, action, entity, entity_id, before, after, reason) values
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('12:00'), '00000000-0000-4000-8000-000000000101', null, 'bonus.give', 'member',
   '00000000-0000-4000-8000-000000000213', null, '{"pan": "ABCDE1234F", "chips": 1500}', 'Welcome back'),
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('13:00'), null, null, 'update', 'waitlist_entry', '00000000-0000-4000-8000-0000000e3871',
   '{"member_id": "00000000-0000-4000-8000-000000000213"}', '{"member_id": "00000000-0000-4000-8000-000000000213"}', null),
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('14:00'), '00000000-0000-4000-8000-000000000211', null, 'update', 'member',
   '00000000-0000-4000-8000-000000000211', null, null, null),
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('15:00'), '00000000-0000-4000-8000-0000000d3871', '00000000-0000-4000-8000-0000000d3872', 'insert', 'hand', 'not-a-uuid', null, '{"member_id": "not-a-uuid"}', null),
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('16:00'), '00000000-0000-4000-8000-000000000101', null, 'export.table', 'table', 'Members', null, null, null),
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('17:00'), '00000000-0000-4000-8000-000000000103', null, 'update', 'staff',
   pg_temp.staff_of('00000000-0000-4000-8000-000000000106')::text, null, null, 'New job title'),
  -- 05:59 the next morning is still this club day, and 06:00 is the next one.
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('29:59'), '00000000-0000-4000-8000-000000000103', null, 'delete', 'chip_denomination', 'c1', null, null, null),
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('30:00'), '00000000-0000-4000-8000-000000000103', null, 'delete', 'chip_denomination', 'c2', null, null, null);

-- Twenty days before, more rows than one read gives.
insert into public.audit_log (venue_id, occurred_at, action, entity, entity_id)
select '00000000-0000-4000-8000-000000000001'::uuid, pg_temp.at('-468:00'), 'update', 'visit', 'v' || n from generate_series(1, 205) n;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq(
  $$ select who, is_system, action, entity, kind, about, reason, amount
     from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$,
  $$ values ('Aditya Malhotra'::text, false, 'delete'::text, 'chip_denomination'::text, 'other'::text, null::text, null::text, null::bigint),
            ('Aditya Malhotra', false, 'update', 'staff', 'staff', 'Pema Lepcha', 'New job title', null),
            ('Vikram Rao', false, 'export.table', 'table', 'exports', 'Members', null, null),
            ('Tablet of Table 7', false, 'insert', 'hand', 'floor', null, null, null),
            ('Ishaan Verma', false, 'update', 'member', 'members', 'Ishaan Verma', null, null),
            (null, true, 'update', 'waitlist_entry', 'floor', 'Mihir Shah', null, null),
            ('Vikram Rao', false, 'bonus.give', 'member', 'bonus_chips', 'Mihir Shah', 'Welcome back', 1500) $$,
  'newest first, the club day''s rows only: staff, a member, a device or the system; about a member, a staff member or a table');
-- A revoked tablet loses its login, and keeps its name here.
reset role;
update public.device set auth_user_id = null where id = '00000000-0000-4000-8000-0000000d3872';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select who from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_kind => 'floor', p_limit => 1) $$,
  $$ values ('Tablet of Table 7'::text) $$, 'a device keeps its name once its login has gone');
select ok(pg_get_function_result('public.activity_log(uuid, date, date, text, text, timestamptz, bigint, integer)'::regprocedure) !~ '\m(before|after)\M',
          'never a row''s before or after');

select results_eq($$ select action from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_who => 'vikram') $$,
  $$ values ('export.table'::text), ('bonus.give') $$, 'by part of a name, in any case');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_who => 'nobody at all') $$,
  'and nobody by that name is nothing');
select results_eq($$ select action from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_kind => 'floor') $$,
  $$ values ('insert'::text), ('update') $$, 'by kind');
select is((select count(*)::integer from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day) + 1, (select d from day) + 1, p_kind => 'other')
           where entity = 'chip_denomination'), 1, '06:00 starts the next club day');
select results_eq($$ select entity from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_limit => 2) $$,
  $$ values ('chip_denomination'::text), ('staff') $$, 'as many as are asked for');
select results_eq(
  $$ select entity from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_limit => 2,
       p_before => pg_temp.at('17:00'), p_before_id => (select max(id) from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_kind => 'staff'))) $$,
  $$ values ('table'::text), ('hand') $$, 'the next page starts after the last row');
select is((select count(*)::integer from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day) - 20, (select d from day) - 20, p_limit => 100000)), 200,
          'never more than 200 at once, of 205');

-- Once erased, a member's name goes from the screen, and the words written about them.
reset role;
insert into public.audit_log (venue_id, occurred_at, actor_user_id, action, entity, entity_id, after, reason) values
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('11:00'), '00000000-0000-4000-8000-000000000101', 'points.grant', 'member', '00000000-0000-4000-8000-000000000213', '{"points": 500}', 'For his wife''s birthday'),
  ('00000000-0000-4000-8000-000000000001', pg_temp.at('10:00'), '00000000-0000-4000-8000-000000000101', 'member.erase', 'member', '00000000-0000-4000-8000-000000000213', null, 'Asked to be erased');
update public.member set erased_at = now(), full_name = 'Erased member', phone = null, user_id = null where id = '00000000-0000-4000-8000-000000000213';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select about, reason from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_kind => 'bonus_chips') $$,
  $$ values (null::text, null::text) $$, 'an erased member is not named, nor what was written about them');
select results_eq($$ select action, about, reason, amount from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_kind => 'points') $$,
  $$ values ('points.grant'::text, null::text, null::text, 500::bigint) $$, 'a points line loses its reason too, and keeps how many');
select results_eq($$ select reason from public.activity_log('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day), p_kind => 'members') where action = 'member.erase' $$,
  $$ values ('Asked to be erased'::text) $$, 'the erasure keeps its own reason');

-- Points by hand are in the log, once each for a repeated request; as bonus chips by hand are, with the staff member and the reason.
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select public.grant_points('00000000-0000-4000-8000-000000000216', 500, false, 'Welcome back', '00000000-0000-4000-8000-0000000f3871');
select public.grant_points('00000000-0000-4000-8000-000000000216', 500, false, 'Welcome back', '00000000-0000-4000-8000-0000000f3871');
select public.grant_points('00000000-0000-4000-8000-000000000216', 200, true, 'Until his test', '00000000-0000-4000-8000-0000000f3872');
select public.unlock_points('00000000-0000-4000-8000-000000000216', 100, 'Test passed', '00000000-0000-4000-8000-0000000f3873');
select public.unlock_points('00000000-0000-4000-8000-000000000216', 100, 'Test passed', '00000000-0000-4000-8000-0000000f3873');
select results_eq($$ select who, action, kind, about, reason, amount from public.activity_log('00000000-0000-4000-8000-000000000001', p_who => 'Vikram', p_kind => 'points', p_limit => 3) $$,
  $$ values ('Vikram Rao'::text, 'points.unlock'::text, 'points'::text, 'Kunal Mehra'::text, 'Test passed'::text, 100::bigint),
            ('Vikram Rao', 'points.lock', 'points', 'Kunal Mehra', 'Until his test', 200),
            ('Vikram Rao', 'points.grant', 'points', 'Kunal Mehra', 'Welcome back', 500) $$,
  'giving, locking and releasing points by hand, a repeat of a request once');

-- Past controls: released ones only, latest first, a freeze with both who released it.
reset role;
insert into public.control_state (venue_id, level, reason, engaged_at, engaged_by_staff_id, released_at, released_by_staff_id, release_second_staff_id, release_reason) values
  ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Drill', now() - interval '6 days', pg_temp.staff_of('00000000-0000-4000-8000-000000000101'),
   now() - interval '5 days', pg_temp.staff_of('00000000-0000-4000-8000-000000000135'), pg_temp.staff_of('00000000-0000-4000-8000-000000000136'), 'Drill over');
insert into public.control_state (venue_id, level, member_id, reason, engaged_at, engaged_by_staff_id, released_at, released_by_staff_id, release_reason) values
  ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000216', 'Dispute', now() - interval '3 days', pg_temp.staff_of('00000000-0000-4000-8000-000000000101'),
   now() - interval '2 days', pg_temp.staff_of('00000000-0000-4000-8000-000000000135'), 'Settled'),
  ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000213', 'About an erased member', now() - interval '2 days', pg_temp.staff_of('00000000-0000-4000-8000-000000000101'),
   now() - interval '1 day', pg_temp.staff_of('00000000-0000-4000-8000-000000000135'), 'Closed');
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id) values
  ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000211', 'Still on', pg_temp.staff_of('00000000-0000-4000-8000-000000000101'));

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq(
  $$ select level::text, member_name, reason, engaged_by, released_by, release_second, release_reason from public.past_controls('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('member_freeze'::text, null::text, ''::text, 'Vikram Rao'::text, 'Neha Kulkarni'::text, null::text, null::text),
            ('member_freeze', 'Kunal Mehra', 'Dispute', 'Vikram Rao', 'Neha Kulkarni', null, 'Settled'),
            ('venue_freeze', null, 'Drill', 'Vikram Rao', 'Neha Kulkarni', 'Arvind Rao', 'Drill over') $$,
  'what was released, latest first, by whom and why, an erased member''s words gone; not what is still on');
select is_empty($$ select 1 from public.past_controls('00000000-0000-4000-8000-000000000002') $$, 'nothing from the practice venue');

-- Every other role is refused: an admin and a dealer, an investor (who holds audit.read), marketing, service, a member, signed out.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001') $$, 'an admin reads no activity');
select is_empty($$ select 1 from public.past_controls('00000000-0000-4000-8000-000000000001') $$, 'and no past controls');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001') $$, 'an investor, who holds audit.read, reads no activity');
select is_empty($$ select 1 from public.past_controls('00000000-0000-4000-8000-000000000001') $$, 'and no past controls');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001') $$, 'marketing reads none');
select is_empty($$ select 1 from public.past_controls('00000000-0000-4000-8000-000000000001') $$, 'and no past controls');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001') $$, 'service staff read none');
select is_empty($$ select 1 from public.past_controls('00000000-0000-4000-8000-000000000001') $$, 'and no past controls');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001') $$, 'a dealer reads none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001') $$, 'a member reads none');
select is_empty($$ select 1 from public.past_controls('00000000-0000-4000-8000-000000000001') $$, 'and no past controls');

-- A super admin of another venue alone reads that venue's log, and nothing of this one.
reset role;
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000216', 'Practice Owner', 'Owner', 'super_admin');
insert into public.audit_log (venue_id, occurred_at, actor_user_id, action, entity, entity_id) values
  ('00000000-0000-4000-8000-000000000002', pg_temp.at('12:00'), '00000000-0000-4000-8000-000000000216', 'practice.reset', 'venue', 'practice');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001') $$, 'another venue''s super admin reads none of this one');
select is_empty($$ select 1 from public.past_controls('00000000-0000-4000-8000-000000000001') $$, 'and no past controls of it');
select results_eq($$ select who, action from public.activity_log('00000000-0000-4000-8000-000000000002', (select d from day), (select d from day)) $$,
  $$ values ('Practice Owner'::text, 'practice.reset'::text) $$, 'but reads their own');

reset role;
select ok(not has_function_privilege('anon', 'public.activity_log(uuid, date, date, text, text, timestamptz, bigint, integer)', 'execute'), 'nobody signed out runs it');
select ok(not has_function_privilege('anon', 'public.past_controls(uuid)', 'execute'), 'nor the past controls');
select ok(not has_function_privilege('authenticated', 'private.uuid_or_null(text)', 'execute'), 'the helpers are the definer''s alone');
select ok(not has_function_privilege('authenticated', 'private.activity_kind(text, text)', 'execute'), 'both of them');

select * from finish();
rollback;
