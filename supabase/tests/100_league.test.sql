-- The RIVR League (#147; decision 0182; question #452). A month's League points are what cash play earned
-- for hours at the tables (not the rake share) plus tournament finishes at league.points, by the club's
-- day; a season adds up its months; ties share a place. 213 Mihir, 214 Yash, 215 Ritika and 216 Kunal
-- are members; 103 Aditya an admin (members.read), 107 Ishita marketing (rewards.manage), 106 Pema a
-- dealer, who sees no standings.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- A visit for the member closing at that moment, three hours seated, which earned these points for its hours.
create function pg_temp.earn(p_member uuid, p_points bigint, p_closed timestamptz) returns uuid language sql as $$
  with v as (
    insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
    select m.venue_id, m.id, p_closed - interval '3 hours', p_closed, 'door' from public.member m where m.id = p_member
    returning id, venue_id, opened_at, closed_at
  ),
  s as (
    insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
    select v.venue_id, p_member, v.id, g.id, 1, v.opened_at, v.opened_at, v.closed_at, 'left'
    from v cross join lateral (select t.id from public.game_table t where t.venue_id = v.venue_id order by t.name limit 1) g
    returning id, visit_id, table_id, venue_id
  )
  insert into public.points_earning (venue_id, member_id, visit_id, basis, session_id, table_id, played_seconds, rate, points)
  select s.venue_id, p_member, s.visit_id, 'hours', s.id, s.table_id, 10800, 10, p_points from s
  returning visit_id;
$$;

select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'league.points', '', now()),
  '{"first": 100, "second": 70, "third": 50, "final_table": 20, "entry": 5}'::jsonb,
  'the seed gives 100, 70 and 50 for the podium, 20 for the final table and 5 for taking part');

-- January 2026, long before anything seeded. Cash: Mihir three hours (30 points for hours, 40 from rake,
-- which is not League play); Yash a night that ended at 03:00 on 1 February, so January's, and one on
-- 1 February's own club day; Kunal 25.
insert into public.points_earning (venue_id, member_id, visit_id, basis, rake_share_paise, rate, points)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
       pg_temp.earn('00000000-0000-4000-8000-000000000213', 30, '2026-01-10T23:00:00+05:30'), 'rake', 80000, 500, 40;
select pg_temp.earn('00000000-0000-4000-8000-000000000214', 20, '2026-02-01T03:00:00+05:30');
select pg_temp.earn('00000000-0000-4000-8000-000000000214', 50, '2026-02-01T23:00:00+05:30');
select pg_temp.earn('00000000-0000-4000-8000-000000000216', 25, '2026-01-20T23:00:00+05:30');

-- A Sunday tournament: Mihir wins, Yash finishes twelfth; it ends at 01:30 on Monday 5 January.
insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise)
values ('00000000-0000-4000-8000-0000000c1001', '00000000-0000-4000-8000-000000000001', 'RIVR Sunday', '2026-01-04T16:00:00+05:30', 1000000);
select is(private.award_league_points('00000000-0000-4000-8000-0000000c1001', '00000000-0000-4000-8000-000000000213', 1,
                                      '2026-01-05T01:30:00+05:30'), 105::bigint, 'the winner earns 105');
select is(private.award_league_points('00000000-0000-4000-8000-0000000c1001', '00000000-0000-4000-8000-000000000214', 12,
                                      '2026-01-05T01:30:00+05:30'), 5::bigint, 'twelfth earns 5 for taking part');
select is(private.award_league_points('00000000-0000-4000-8000-0000000c1001', '00000000-0000-4000-8000-000000000213', 3,
                                      '2026-01-05T02:00:00+05:30'), 105::bigint, 'a finish earns once: the first word stands');
select is((select count(*)::integer from public.league_finish), 2, 'two finishes are kept');
select is((select month from public.league_finish where place = 1), '2026-01-01'::date, 'in January');
select throws_ok($$ select private.award_league_points('00000000-0000-4000-8000-0000000c1001', '00000000-0000-4000-8000-000000000216', 0, now()) $$,
  '22023', null, 'a place is 1 or more');
select throws_ok($$ select private.award_league_points('00000000-0000-4000-8000-0000000c1001', '00000000-0000-4000-8000-000000000270', 2, now()) $$,
  '22023', null, 'a practice member has no finish in a club tournament');
select throws_ok($$ update public.league_finish set points = 1000 $$, '42501', null, 'a finish is never changed');

-- The console's standings.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select place, full_name, cash_points, tournament_points, points
     from public.venue_league('00000000-0000-4000-8000-000000000001', '2026-01-01', '2026-01-01') $$,
  $$ values (1, 'Mihir Shah'::text, 30::bigint, 105::bigint, 135::bigint), (2, 'Kunal Mehra', 25, 0, 25), (2, 'Yash Gupta', 20, 5, 25) $$,
  'January: Mihir 30 at the tables and 105 for the win; Kunal and Yash share second with 25');
select results_eq(
  $$ select place, full_name, points from public.venue_league('00000000-0000-4000-8000-000000000001', '2026-02-01', '2026-02-01') $$,
  $$ values (1, 'Yash Gupta'::text, 50::bigint) $$, 'February: Yash''s night on its own club day');
select results_eq(
  $$ select place, full_name, points from public.venue_league('00000000-0000-4000-8000-000000000001', '2026-01-01', '2026-03-01') $$,
  $$ values (1, 'Mihir Shah'::text, 135::bigint), (2, 'Yash Gupta', 75), (3, 'Kunal Mehra', 25) $$,
  'a season from January to March adds the months up');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select count(*)::integer from public.venue_league('00000000-0000-4000-8000-000000000001', '2026-01-01', '2026-01-01')), 3,
  'marketing sees the standings too');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.venue_league('00000000-0000-4000-8000-000000000001', '2026-01-01', '2026-01-01') $$,
  'a dealer sees none');
select is_empty($$ select * from public.league_finish $$, 'nor any finish');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.venue_league('00000000-0000-4000-8000-000000000001', '2026-01-01', '2026-01-01') $$,
  'a member reads no full names');
select results_eq($$ select place, points from public.league_finish $$, $$ values (1, 105::bigint) $$, 'Mihir sees his own finish only');

-- Seasons, from rewards.manage.
reset role;
delete from public.league_season;
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.save_league_season('00000000-0000-4000-8000-000000000001', 'Winter', '2026-01-01', '2026-03-01') $$,
  '42501', null, 'a dealer sets no season');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.save_league_season('00000000-0000-4000-8000-000000000001', ' Winter 2026 ', '2026-01-01', '2026-03-01') $$,
  'marketing sets a season from January to March');
select throws_ok($$ select public.save_league_season('00000000-0000-4000-8000-000000000001', 'Spring', '2026-03-01', '2026-05-01') $$,
  '22023', null, 'seasons do not overlap');
select throws_ok($$ select public.save_league_season('00000000-0000-4000-8000-000000000001', 'Spring', '2026-04-15', '2026-05-01') $$,
  '22023', null, 'a season is whole months');
select throws_ok($$ select public.save_league_season('00000000-0000-4000-8000-000000000001', 'Spring', '2026-05-01', '2026-04-01') $$,
  '22023', null, 'in order');
select lives_ok($$ select public.save_league_season('00000000-0000-4000-8000-000000000001', 'Winter 2026', '2026-01-01', '2026-02-01',
                                                   (select id from public.league_season)) $$, 'and shortens it to February');
select results_eq($$ select name, first_month, last_month from public.league_season $$,
  $$ values ('Winter 2026'::text, '2026-01-01'::date, '2026-02-01'::date) $$, 'the season, its name trimmed');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.league_season), 1, 'Mihir sees the season');

-- This month's board. Mihir and Kunal lead by far; Kunal hid his name on the TVs; ten others play a little, and
-- Yash least; Ritika's tier is denied the League. A practice member plays too.
reset role;
select pg_temp.earn('00000000-0000-4000-8000-000000000213', 100000, now());
select pg_temp.earn('00000000-0000-4000-8000-000000000216', 50000, now());
select pg_temp.earn(m.id, 1000 + m.n, now()) from (
  select id, row_number() over (order by id) as n from public.member where venue_id = '00000000-0000-4000-8000-000000000001'
    and id not in ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-000000000215',
                   '00000000-0000-4000-8000-000000000216')
  order by id limit 10) m;
select pg_temp.earn('00000000-0000-4000-8000-000000000214', 1, now());
select pg_temp.earn('00000000-0000-4000-8000-000000000270', 500000, now());
insert into public.member_preference (member_id, venue_id, name_on_tvs)
values ('00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-000000000001', false)
on conflict (member_id) do update set name_on_tvs = false;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 'league.standings', false, 'Test');
create temporary table this_month as select private.league_month(now()) as first_month;
grant select on this_month to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.save_league_season('00000000-0000-4000-8000-000000000001', 'This season',
                                                   (select first_month from this_month), ((select first_month from this_month) + interval '2 months')::date) $$,
  'a season runs now');
reset role;

set local role anon;
select results_eq(
  $$ select standing, place, display_name, points from public.public_league_table where venue_slug = 'gurugram' and place <= 2 order by standing, place $$,
  $$ values ('month'::text, 1, 'Mihir S.'::text, 100000::bigint), ('month', 2, null, 50000),
            ('season', 1, 'Mihir S.', 100000), ('season', 2, null, 50000) $$,
  'the website shows the month and the season: Mihir first, and Kunal second with no name');
select is((select max(place) from public.public_league_table where venue_slug = 'gurugram' and standing = 'month'), 10,
  'ten places on the board');
select is_empty($$ select * from public.public_league_table where venue_slug = 'practice' $$, 'never the practice venue');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select results_eq(
  $$ select standing, display_name, points, is_me from public.my_league() where is_me $$,
  $$ values ('month'::text, 'Yash G.'::text, 1::bigint, true), ('season', 'Yash G.', 1, true) $$,
  'Yash, off the board, sees his own place this month and this season');
select ok((select bool_and(place > 10) from public.my_league() where is_me), 'below the ten');
select is((select count(*)::integer from public.my_league() where standing = 'month' and not is_me),
  (select count(*)::integer from public.public_league_table where venue_slug = 'gurugram' and standing = 'month'),
  'beside the board');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select standing, place, points from public.my_league() where is_me $$,
  $$ values ('month'::text, 1, 100000::bigint), ('season', 1, 100000) $$, 'Mihir finds himself on the board, once each');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select is_empty($$ select * from public.my_league() $$, 'Ritika''s tier has no League');
select is_empty($$ select * from public.league_season $$, 'nor its seasons');

select * from finish();
rollback;
