-- The TV's stage (redesign of 15 Nov 2026, issue 971; decision 0631). The club's notice runs along the foot of every board:
-- a TV reads the text of its own venue's notice in force that started last, and no other venue's. The hours leaderboard
-- shows two lists, tonight's first: tonight, and the period the club set, or this week where it set tonight.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Signed in through the API's role as one login: a paired TV's, a staff member's, a member's.
create function pg_temp.as_login(p_login text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_login, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_login(text) to authenticated;
-- A venue's notice from so many minutes ago, until so many minutes from now (null: until ended).
create function pg_temp.notice(p_venue text, p_body text, p_started_minutes_ago integer, p_ends_in_minutes integer default null) returns void language sql as $$
  insert into public.notice (venue_id, body, starts_at, ends_at)
  values (('00000000-0000-4000-8000-00000000000' || p_venue)::uuid, p_body, now() - make_interval(mins => p_started_minutes_ago),
          now() + make_interval(mins => p_ends_in_minutes));
$$;
-- The club's hours leaderboard as its staff set it; each later than the one before.
create function pg_temp.set_board(p_value jsonb, p_seconds_ago integer) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'tv.leaderboard', '', p_value, now() - make_interval(secs => p_seconds_ago), 'Test 462');
$$;
-- A member's seat at the club's Table 2 from a moment until now, in a visit of its own that closed as it ended.
create function pg_temp.seat(p_member text, p_from timestamptz) returns void language sql as $$
  with v as (
    insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
    values ('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || p_member)::uuid, p_from, now(), 'door')
    returning id, venue_id, member_id, opened_at, closed_at
  )
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select v.venue_id, v.member_id, v.id, g.id, 1, v.opened_at, v.opened_at, v.closed_at, 'left'
  from v join public.game_table g on g.venue_id = v.venue_id and g.name = 'Table 2';
$$;

-- A TV at the club (venue 1) and one at the practice venue (venue 2), both paired.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e462', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000004621'),
  ('00000000-0000-4000-8000-00000000f462', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000004622');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d462', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e462'),
  ('00000000-0000-4000-8000-00000000c462', '00000000-0000-4000-8000-000000000002', 'tv', 'Practice TV', '00000000-0000-4000-8000-00000000f462');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d462', '00000000-0000-4000-8000-000000000001', 'leaderboard'),
  ('00000000-0000-4000-8000-00000000c462', '00000000-0000-4000-8000-000000000002', 'waitlist');

-- ---------------------------------------------------------------------------------------------------
-- The notice along the foot.
delete from public.notice where venue_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
select pg_temp.as_login('00000000-0000-4000-8000-00000000e462');
select is(public.tv_notice(), null, 'with no notice in force, a TV reads none');
reset role;

select pg_temp.notice('1', 'The kitchen closes at 2.', 120);
select pg_temp.notice('1', 'Table 4 opens at 9 tonight.', 60);
select pg_temp.notice('1', 'Happy hour until 8.', 30, -10);
select pg_temp.notice('1', 'Closed on Monday.', -1440);
select pg_temp.notice('2', 'Practice night.', 5);

select pg_temp.as_login('00000000-0000-4000-8000-00000000e462');
select is(public.tv_notice(), 'Table 4 opens at 9 tonight.',
  'the club''s TV reads the club''s notice in force that started last: not one that ended, one still to come, or the practice venue''s');
select pg_temp.as_login('00000000-0000-4000-8000-00000000f462');
select is(public.tv_notice(), 'Practice night.', 'the practice venue''s TV reads its own, and never the club''s');
reset role;

update public.notice set ends_at = now() - interval '1 minute' where body = 'Table 4 opens at 9 tonight.';
select pg_temp.as_login('00000000-0000-4000-8000-00000000e462');
select is(public.tv_notice(), 'The kitchen closes at 2.', 'once that one is ended, the one before it');
select pg_temp.as_login('00000000-0000-4000-8000-000000000103');
select is(public.tv_notice(), null, 'staff, not a TV, read none through it');
select pg_temp.as_login('00000000-0000-4000-8000-000000000211');
select is(public.tv_notice(), null, 'nor a member');
reset role;
select is(has_function_privilege('anon', 'public.tv_notice()', 'execute'), false, 'and nobody signed out may ask');

-- ---------------------------------------------------------------------------------------------------
-- The hours leaderboard's two lists. 211 has played since the club day began; 212 since the week began.
select pg_temp.seat('211', private.leaderboard_from('tonight', now()));
select pg_temp.seat('212', private.leaderboard_from('week', now()));
-- 211 as the board names them, kept for the TV's own read below.
select set_config('test.played_tonight', private.first_name_and_initial(full_name), true) from public.member where id = '00000000-0000-4000-8000-000000000211';

select pg_temp.set_board('{"period": "tonight"}', 9);
select pg_temp.as_login('00000000-0000-4000-8000-00000000e462');
select is((select string_agg(distinct period, ',' order by period) from public.tv_leaderboard()), 'tonight,week',
  'set to tonight, the board lists tonight and this week');
select ok((select max(r.n) filter (where r.period = 'tonight') < min(r.n) filter (where r.period = 'week')
           from (select period, row_number() over () as n from public.tv_leaderboard()) r), 'tonight''s list first, then the week''s');
select ok((select count(*) = 2 from public.tv_leaderboard() where display_name = current_setting('test.played_tonight')),
  'a member who played tonight is on both');
reset role;

select pg_temp.set_board('{"period": "month", "top": 1}', 5);
select pg_temp.as_login('00000000-0000-4000-8000-00000000e462');
select is((select string_agg(distinct period, ',' order by period) from public.tv_leaderboard()), 'month,tonight',
  'set to this month, the board lists tonight and this month');
select is((select max(place) from public.tv_leaderboard()), 1, 'each list as the club set the board: the top place alone');
reset role;

update public.tv_screen set mode = 'waitlist' where device_id = '00000000-0000-4000-8000-00000000d462';
select pg_temp.as_login('00000000-0000-4000-8000-00000000e462');
select is_empty($$ select * from public.tv_leaderboard() $$, 'a TV that does not show the board reads neither list');
reset role;

select * from finish();
rollback;
