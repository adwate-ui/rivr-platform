-- A member's visits and points on their record (8 Nov audit, I-71). 103 Aditya reads members, 106 Pema is a dealer and
-- does not, 213 Mihir is a member, 216 Kunal another.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.staff_id() returns uuid language sql as $$
  select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and full_name = 'Aditya Malhotra';
$$;

delete from public.early_departure where member_id = '00000000-0000-4000-8000-000000000213';
delete from public.seat_session where member_id = '00000000-0000-4000-8000-000000000213';
delete from public.visit where member_id = '00000000-0000-4000-8000-000000000213';

-- One visit at two tables, its call time met; one that left early, owing it; one with a departure withdrawn; and one with no seat.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000a3851', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '6 days', now() - interval '6 days' + interval '6 hours', 'door'),
  ('00000000-0000-4000-8000-0000000a3852', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '5 days', now() - interval '5 days' + interval '2 hours', 'door'),
  ('00000000-0000-4000-8000-0000000a3853', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '4 days', now() - interval '4 days' + interval '2 hours', 'door'),
  ('00000000-0000-4000-8000-0000000a3854', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'door');
-- And tonight's, still playing, owing call time not yet met.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a3855', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '1 hour');
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at) values
  ('00000000-0000-4000-8000-0000000b3855', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3855', pg_temp.table_id('Table 2'), 9, now() - interval '30 minutes');
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, ended_at, end_reason) values
  ('00000000-0000-4000-8000-0000000b3851', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3851', pg_temp.table_id('Table 3'), 5, now() - interval '6 days', now() - interval '6 days' + interval '3 hours', 'left'),
  ('00000000-0000-4000-8000-0000000b3852', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3851', pg_temp.table_id('Table 1'), 7, now() - interval '6 days' + interval '3 hours', now() - interval '6 days' + interval '5 hours', 'left'),
  ('00000000-0000-4000-8000-0000000b3853', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3852', pg_temp.table_id('Table 1'), 2, now() - interval '5 days', now() - interval '5 days' + interval '1 hour', 'left'),
  ('00000000-0000-4000-8000-0000000b3854', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3853', pg_temp.table_id('Table 1'), 2, now() - interval '4 days', now() - interval '4 days' + interval '1 hour', 'left');
update public.seat_session set call_time_minutes = 0, call_time_completed_at = null where member_id = '00000000-0000-4000-8000-000000000213';
update public.seat_session set call_time_minutes = 120, call_time_completed_at = started_at + interval '2 hours' where id = '00000000-0000-4000-8000-0000000b3851';
update public.seat_session set call_time_minutes = 180 where id in ('00000000-0000-4000-8000-0000000b3853', '00000000-0000-4000-8000-0000000b3854', '00000000-0000-4000-8000-0000000b3855');
-- A floor move took the second visit's seat from Table 2 to Table 1: the session now says Table 1 alone.
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b3853', pg_temp.table_id('Table 2'), 4, pg_temp.table_id('Table 1'), 2);
insert into public.early_departure (id, venue_id, member_id, visit_id, session_id, shortfall_seconds, reason, overridden_by_staff_id) values
  ('00000000-0000-4000-8000-0000000c3851', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3852', '00000000-0000-4000-8000-0000000b3853', 7200, 'Family call', pg_temp.staff_id()),
  ('00000000-0000-4000-8000-0000000c3852', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3853', '00000000-0000-4000-8000-0000000b3854', 7200, 'By mistake', pg_temp.staff_id());
insert into public.early_departure_withdrawal (venue_id, early_departure_id, withdrawn_by_staff_id, reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c3852', pg_temp.staff_id(), 'Recorded by mistake');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select visit_id, tables, minutes_played, call_time_met, left_early from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$,
  $$ values ('00000000-0000-4000-8000-0000000a3855'::uuid, 'Table 2'::text, 30, null::boolean, false),
            ('00000000-0000-4000-8000-0000000a3854', null, 0, null, false),
            ('00000000-0000-4000-8000-0000000a3853', 'Table 1', 60, false, false),
            ('00000000-0000-4000-8000-0000000a3852', 'Table 1, Table 2', 60, false, true),
            ('00000000-0000-4000-8000-0000000a3851', 'Table 1, Table 3', 300, true, false) $$,
  'newest first: every table, a floor move''s too; time played; call time met, owed, none owed or still running; left early unless withdrawn');
select is((select count(*)::integer from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 2)), 2, 'as many as are asked for');
select is((select max(visit_id::text) from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 1)), '00000000-0000-4000-8000-0000000a3855', 'the newest first');

select lives_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000213', 300, false, 'For coming back', gen_random_uuid()) $$, 'staff give points by hand');
select results_eq($$ select kind, points, reason, staff_name from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 1) $$,
  $$ values ('earned'::text, 300::bigint, 'For coming back'::text, 'Aditya Malhotra'::text) $$, 'the points history says what, why and who');

select is_empty($$ select 1 from public.member_visits('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000213') $$, 'not read through another venue');
select is_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000213') $$, 'nor the points');

-- Once erased, the reasons go with the rest, as a free-text reason can name the person.
reset role;
insert into public.member (id, venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000b97', '00000000-0000-4000-8000-000000000001', 'Erased Esha', '+919000000857');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000b97', 100, false, 'For Esha and her cousin', gen_random_uuid()) $$, 'points are given');
select isnt_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b97') $$, 'and read');
reset role;
update public.member set erased_at = now(), full_name = 'Erased member', phone = null, user_id = null where id = '00000000-0000-4000-8000-000000000b97';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b97') $$, 'none once she is erased');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'a dealer reads no visits');
select is_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'nor points');
reset role;
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000211', 'Practice Admin', 'Admin', 'admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is_empty($$ select 1 from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'an investor read no visits');
select is_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'an investor read no points');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is_empty($$ select 1 from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'marketing read no visits');
select is_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'marketing read no points');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');
select is_empty($$ select 1 from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'the service staff read no visits');
select is_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'the service staff read no points');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'another venues admin read no visits');
select is_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'another venues admin read no points');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'nor another member');
select is_empty($$ select 1 from public.member_points_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'nor another member''s points');
reset role;
select ok(not has_function_privilege('anon', 'public.member_visits(uuid, uuid, integer)', 'execute'), 'nobody signed out reads visits');
select ok(not has_function_privilege('anon', 'public.member_points_history(uuid, uuid, integer)', 'execute'), 'nor points');

select * from finish();
rollback;
