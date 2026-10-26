-- The TVs' rewards ticker and League leaderboard (#148, decision 0183), and the player's Rewards tab
-- (#152). A paired TV reads the boards only while they are its mode or in its rotation; names are a first
-- name and initial, none for a member who hid theirs (216 Kunal), and nobody self-excluded (217 Neel)
-- leads. 213 Mihir and 214 Yash are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.signals(p_event text) returns integer language sql as $$
  select count(*)::integer from realtime.messages m
  where m.topic = 'tv:00000000-0000-4000-8000-000000000001' and m.event = p_event and m.inserted_at >= now();
$$;
-- A visit for the member closing now, three hours seated, which earned these points for its hours.
create function pg_temp.earn(p_member uuid, p_points bigint) returns uuid language sql as $$
  with v as (
    insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
    select m.venue_id, m.id, now() - interval '3 hours', now(), 'door' from public.member m where m.id = p_member
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

-- A paired TV at the club on the waitlist board.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001011');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e101');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-000000000001', 'waitlist');

-- This month: Mihir 30,000 points at the tables, Kunal 20,000 (with his name hidden), Neel more than either
-- but excluded from play.
select pg_temp.earn('00000000-0000-4000-8000-000000000213', 30000);
insert into public.points_earning (venue_id, member_id, visit_id, basis, rake_share_paise, rate, points)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
       pg_temp.earn('00000000-0000-4000-8000-000000000216', 15000), 'rake', 10000000, 500, 5000;
select pg_temp.earn('00000000-0000-4000-8000-000000000217', 90000);
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', now() - interval '1 day', now() + interval '30 days');
insert into public.member_preference (member_id, venue_id, name_on_tvs)
values ('00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-000000000001', false)
on conflict (member_id) do update set name_on_tvs = false;

-- Mihir redeems a bar upgrade from the seed's catalogue.
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 2500, 'Test', 'test:101');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select lives_ok($$ select public.redeem_reward('00000000-0000-4000-8000-000000145002', 2500, 'mihir-bar') $$, 'Mihir redeems a bar upgrade');
reset role;
select is(pg_temp.signals('rewards'), 1, 'and the TVs are told at once');

-- On the waitlist board alone, the TV reads neither board.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e101');
select is_empty($$ select * from public.tv_rewards_ticker() $$, 'a TV on another board reads no rewards ticker');
select is_empty($$ select * from public.tv_league_board() $$, 'nor the League');
reset role;
update public.tv_screen set rotation = array['rewards', 'league']::public.tv_mode[] where device_id = '00000000-0000-4000-8000-00000000d101';

select pg_temp.as_person('00000000-0000-4000-8000-00000000e101');
select results_eq(
  $$ select place, display_name, points from public.tv_rewards_ticker() where kind = 'leader' and points >= 20000 $$,
  $$ values (1, 'Mihir S.'::text, 30000::bigint), (2, null, 20000) $$,
  'with both in its rotation: Mihir leads this month, Kunal second with no name, Neel nowhere');
select ok((select count(*) <= 5 from public.tv_rewards_ticker() where kind = 'leader'), 'five leaders at most');
select results_eq(
  $$ select display_name, reward_name, points from public.tv_rewards_ticker() where kind = 'redemption' $$,
  $$ values ('Mihir S.'::text, 'Bar upgrade, one night'::text, 2500::bigint) $$, 'and the week''s redemptions');
select results_eq(
  $$ select standing, place, display_name from public.tv_league_board() where place <= 2 and standing = 'month' $$,
  $$ values ('month'::text, 1, 'Mihir S.'::text), ('month', 2, null) $$, 'the League board: this month''s standings, the same names');

-- Neel, though excluded from play, redeems a bar upgrade too: the TV never names him.
reset role;
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 2500, 'Test', 'test:101:neel');
select pg_temp.as_person('00000000-0000-4000-8000-000000000217');
select lives_ok($$ select public.redeem_reward('00000000-0000-4000-8000-000000145002', 2500, 'neel-bar') $$, 'Neel redeems a bar upgrade');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e101');
select is((select count(*)::integer from public.tv_rewards_ticker() where kind = 'redemption'), 1, 'the TV shows Mihir''s redemption alone');

-- A TV at the practice venue, with both boards in its rotation, sees nothing of the club's.
reset role;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001012');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-000000000002', 'tv', 'Practice TV', '00000000-0000-4000-8000-00000000e102');
insert into public.tv_screen (device_id, venue_id, mode, rotation) values
  ('00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-000000000002', 'rewards', array['league']::public.tv_mode[]);
select pg_temp.as_person('00000000-0000-4000-8000-00000000e102');
select is_empty($$ select * from public.tv_rewards_ticker() where display_name = 'Mihir S.' or reward_name = 'Bar upgrade, one night' $$,
  'the practice TV''s ticker has nothing of the club''s');
select is_empty($$ select * from public.tv_league_board() where display_name = 'Mihir S.' $$, 'nor its League');
reset role;
select ok(not has_function_privilege('anon', 'public.tv_rewards_ticker()', 'execute')
          and not has_function_privilege('anon', 'public.my_redemptions()', 'execute')
          and not has_function_privilege('authenticated', 'private.signal_rewards_boards()', 'execute'),
  'nobody signed out reads the boards, and nobody calls the signal');

-- A member reads neither TV board, but their own points, tier and redemptions.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.tv_rewards_ticker() $$, 'a member reads no TV board');
select results_eq($$ select tier_name from public.my_rewards() $$, $$ values ('Member'::text) $$, 'Mihir is a Member');
reset role;
create temporary table mihir_points as
select -private.account_balance(a.id) as points from public.ledger_account a
where a.member_id = '00000000-0000-4000-8000-000000000213' and a.code = 'member.points';
grant select on mihir_points to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select points from public.my_rewards()), (select points from mihir_points), 'with the points his ledger holds');
select results_eq($$ select reward_name, detail, points, handed_over_at is null from public.my_redemptions() $$,
  $$ values ('Bar upgrade, one night'::text, 'At the Glaza bar'::text, 2500::bigint, true) $$, 'and his redemption, waiting at the bar');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is_empty($$ select * from public.my_redemptions() $$, 'Yash sees none of Mihir''s');
reset role;
update public.reward_item set is_live = false where id = '00000000-0000-4000-8000-000000145002';
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.my_redemptions()), 1, 'a retired reward''s redemption is still his to see');
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'rewards.catalogue', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_redemptions() $$, 'without the catalogue, Mihir''s redemptions are not listed');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.my_rewards() $$, 'staff have no rewards of their own');

select * from finish();
rollback;
