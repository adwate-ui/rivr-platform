-- The hours leaderboard on the TVs (the owner, 12 Nov; decision 0581; #907). Seats in October 2025, before the seed's own: the
-- board at 23:00 IST on Wednesday 8 Oct counts tonight from 06:00 that day, this week from Monday 6 Oct, this month from 1 Oct,
-- or all time, each seat's time less its time away. 216 Kunal hides his name on the TVs; 217 Neel has excluded himself.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A member's seat at Table 2 between two IST times, in a visit of its own that closed as it ended, less any time away.
create function pg_temp.seat(p_member text, p_from text, p_to text, p_away_seconds integer default 0) returns void language sql as $$
  with v as (
    insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
    values ('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || p_member)::uuid,
            (p_from || '+05:30')::timestamptz, (p_to || '+05:30')::timestamptz, 'door')
    returning id, venue_id, member_id, opened_at, closed_at
  )
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds)
  select v.venue_id, v.member_id, v.id, g.id, 1, v.opened_at, v.opened_at, v.closed_at, 'left', p_away_seconds
  from v join public.game_table g on g.venue_id = v.venue_id and g.name = 'Table 2';
$$;
-- The board at 23:00 IST on 8 Oct 2025, each place by the member's last three digits.
create function pg_temp.board(p_period text, p_top integer default null, p_min_hours integer default null)
returns table (place integer, member text, minutes integer) language sql as $$
  select l.place, right(l.member_id::text, 3), l.played_minutes
  from private.hours_leaderboard('00000000-0000-4000-8000-000000000001', p_period, p_top, p_min_hours, '2025-10-08 23:00+05:30') l;
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The periods, in the club's days from 06:00 IST.
select results_eq($$ select private.leaderboard_from(p, '2025-10-08 23:00+05:30') from unnest(array['tonight', 'week', 'month', 'all']) p $$,
  $$ values ('2025-10-08 06:00+05:30'::timestamptz), ('2025-10-06 06:00+05:30'), ('2025-10-01 06:00+05:30'), ('-infinity') $$,
  'tonight from 06:00, this week from Monday 06:00, this month from the first at 06:00, or all time');
select is(private.leaderboard_from('week', '2025-10-06 05:00+05:30'), '2025-09-29 06:00+05:30'::timestamptz,
  'at 05:00 on a Monday the club day is still Sunday''s, so the week is still last week');
select is(private.leaderboard_from('month', '2025-11-01 05:00+05:30'), '2025-10-01 06:00+05:30'::timestamptz,
  'and at 05:00 on the first, the month is still last month');

select pg_temp.seat('211', '2025-10-08 19:00', '2025-10-08 23:00', 1800);
select pg_temp.seat('212', '2025-10-08 20:00', '2025-10-08 22:00');
select pg_temp.seat('212', '2025-10-06 20:00', '2025-10-06 23:00');
select pg_temp.seat('213', '2025-10-02 18:00', '2025-10-02 23:00');
select pg_temp.seat('213', '2025-10-08 21:00', '2025-10-09 01:00');
select pg_temp.seat('216', '2025-10-08 18:00', '2025-10-08 23:00');
select pg_temp.seat('217', '2025-10-08 10:00', '2025-10-08 22:00');
select pg_temp.seat('214', '2025-09-30 20:00', '2025-09-30 23:00');
select pg_temp.seat('214', '2025-10-08 23:30', '2025-10-09 02:00');
-- Asha (301) at the practice venue, ten hours tonight: never on the club's board.
with v as (
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', '2025-10-08 12:00+05:30', '2025-10-08 22:00+05:30', 'door')
  returning id, venue_id, member_id, opened_at, closed_at
)
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select v.venue_id, v.member_id, v.id, g.id, 1, v.opened_at, v.opened_at, v.closed_at, 'left'
from v join public.game_table g on g.venue_id = v.venue_id and g.name = 'Table 1';
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', now() - interval '1 day', now() + interval '30 days');
insert into public.member_preference (member_id, venue_id, name_on_tvs)
values ('00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-000000000001', false)
on conflict (member_id) do update set name_on_tvs = false;

select set_eq($$ select * from pg_temp.board('tonight') $$,
  $$ values (1, '216', 300), (2, '211', 210), (3, '212', 120), (3, '213', 120) $$,
  'tonight: time away does not count, a seat still going counts to now, ties share a place, the self-excluded are left out, and the practice venue never shows');
select set_eq($$ select place, right(member_id::text, 3), played_minutes from private.hours_leaderboard('00000000-0000-4000-8000-000000000002', 'tonight',
                   null, null, '2025-10-08 23:00+05:30') $$,
  $$ values (1, '301', 600) $$, 'and the practice venue''s board holds its own seats alone');
select set_eq($$ select * from pg_temp.board('week') $$,
  $$ values (1, '212', 300), (1, '216', 300), (3, '211', 210), (4, '213', 120) $$,
  'this week adds Monday''s seats');
select set_eq($$ select * from pg_temp.board('month') $$,
  $$ values (1, '213', 420), (2, '212', 300), (2, '216', 300), (4, '211', 210) $$,
  'this month adds last week''s');
select set_eq($$ select * from pg_temp.board('all') $$,
  $$ values (1, '213', 420), (2, '212', 300), (2, '216', 300), (4, '211', 210), (5, '214', 180) $$,
  'all time adds last month''s, and never a seat begun after the moment');

select set_eq($$ select member from pg_temp.board('all', 2) $$, $$ values ('213'), ('212'), ('216') $$, 'the top 2 places, both tied seconds with them');
select set_eq($$ select member from pg_temp.board('all', null, 4) $$, $$ values ('213'), ('212'), ('216') $$, 'or those past 4 hours');
select set_eq($$ select member from pg_temp.board('all', 1, 4) $$, $$ values ('213') $$, 'or the top place of those');

select results_eq($$ select display_name is null, member_number is not null from private.hours_leaderboard('00000000-0000-4000-8000-000000000001',
                     'tonight', null, null, '2025-10-08 23:00+05:30') where member_id = '00000000-0000-4000-8000-000000000216' $$,
  $$ values (true, true) $$, 'a member who hid their name shows by member number alone');
select results_eq($$ select display_name, member_number from private.hours_leaderboard('00000000-0000-4000-8000-000000000001',
                     'tonight', null, null, '2025-10-08 23:00+05:30') where member_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ select private.first_name_and_initial(full_name), null::bigint from public.member where id = '00000000-0000-4000-8000-000000000211' $$,
  'anyone else by first name and initial, never their number');

-- The club's setting: top 1 to 12, at least 1 to 500 hours.
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'tv.leaderboard', '', '{"period": "week", "top": 13}', '-infinity', 'Test 410') $$,
  null, 'more than the board''s twelve is refused');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'tv.leaderboard', '', '{"period": "week", "min_hours": 0}', '-infinity', 'Test 410') $$,
  null, 'and a cutoff under an hour');
-- 3.0 passes the schema as a whole number; the board reads it as 3 (the security review of #907).
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                   values ('00000000-0000-4000-8000-000000000001', 'tv.leaderboard', '', '{"period": "all", "top": 3.0}', '-infinity', 'Test 410') $$,
  'all time, the top 3');

-- A paired TV reads it only while it shows the board, as its main mode or in its rotation.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e410', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000004101');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d410', '00000000-0000-4000-8000-000000000001', 'tv', 'Lounge TV', '00000000-0000-4000-8000-00000000e410');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d410', '00000000-0000-4000-8000-000000000001', 'waitlist');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e410');
select is_empty($$ select * from public.tv_leaderboard() $$, 'a TV on the waitlist board reads nothing of it');
reset role;
update public.tv_screen set rotation = array['leaderboard']::public.tv_mode[] where device_id = '00000000-0000-4000-8000-00000000d410';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e410');
select ok((select count(*) > 0 and bool_and(period = 'all') and max(place) <= 3 from public.tv_leaderboard()),
  'in its rotation, the board as the club set it: all time, places 1 to 3');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.tv_leaderboard() $$, 'staff, not a TV, read nothing');
select throws_ok($$ select * from private.hours_leaderboard('00000000-0000-4000-8000-000000000001', 'all', null, null, now()) $$,
  '42501', null, 'nor any venue''s board directly');
reset role;

select * from finish();
rollback;
