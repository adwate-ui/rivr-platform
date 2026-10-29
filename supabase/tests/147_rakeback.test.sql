-- Hourly rakeback (#108; question #485; decision 0245). Last week, at 100/200 (Tables 2 and 3) a 10% rakeback rate was
-- in force; at 50/100 (Table 1) none. Mihir (213) and Yash (214) sat at Table 2 for two hours; Kunal (216) sat at
-- Table 1 and moved to Table 2 after an hour; member 217 sat at Table 3 across the start of the week. Each hand's rake is
-- split among those seated at its table, summed by member and stake, and 10% of it given as bonus in ₹50 chips. A hand
-- the tablet sends late is topped up by the next run; a frozen member is given theirs once released; nothing twice.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.week() returns timestamptz language sql as $$ select week_from from private.rakeback_week(now()) $$;
-- Last club week's Wednesday 06:00 IST, and some minutes after it.
create function pg_temp.at(p_minutes integer) returns timestamptz language sql as $$
  select pg_temp.week() + interval '2 days' + make_interval(mins => p_minutes);
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create function pg_temp.given(p_member text) returns bigint language sql as $$
  select coalesce(sum(amount_paise), 0)::bigint from public.bonus_grant
  where member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid and reason = 'Hourly rakeback';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The club's week: from the Monday 06:00 IST before, to the Monday 06:00 IST after.
select results_eq($$ select * from private.rakeback_week('2026-11-02 06:00 +05:30') $$,
  $$ values ('2026-10-26 06:00 +05:30'::timestamptz, '2026-11-02 06:00 +05:30'::timestamptz) $$, 'Monday 06:00 IST starts a week');
select results_eq($$ select * from private.rakeback_week('2026-11-02 05:59 +05:30') $$,
  $$ values ('2026-10-19 06:00 +05:30'::timestamptz, '2026-10-26 06:00 +05:30'::timestamptz) $$, 'and a minute before, the week before still runs');
-- Points by hand only (#629): the daily job is stopped, and the club gives rakeback, if at all, by hand. What it
-- would give, below, is kept for when the club turns it on again.
select ok(not exists (select 1 from cron.job where jobname = 'rakeback-daily'), 'no job gives rakeback by itself');

-- Last week: the seats, a move, and the hands with their rake.
insert into public.visit (id, venue_id, member_id, opened_at)
select ('00000000-0000-4000-8000-0000000a1' || m)::uuid, '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || m)::uuid,
       case m when '217' then pg_temp.week() - interval '2 hours' else pg_temp.at(0) end
from unnest(array['213', '214', '216', '217']) m;
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds) values
  ('00000000-0000-4000-8000-0000000b1213', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
   '00000000-0000-4000-8000-0000000a1213', pg_temp.table_id('Table 2'), 1, pg_temp.at(0), pg_temp.at(0), pg_temp.at(120), 'left', 0),
  ('00000000-0000-4000-8000-0000000b1214', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214',
   '00000000-0000-4000-8000-0000000a1214', pg_temp.table_id('Table 2'), 2, pg_temp.at(0), pg_temp.at(0), pg_temp.at(120), 'left', 0),
  ('00000000-0000-4000-8000-0000000b1216', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
   '00000000-0000-4000-8000-0000000a1216', pg_temp.table_id('Table 2'), 3, pg_temp.at(0), pg_temp.at(60), pg_temp.at(120), 'left', 0),
  ('00000000-0000-4000-8000-0000000b1217', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217',
   '00000000-0000-4000-8000-0000000a1217', pg_temp.table_id('Table 3'), 1, pg_temp.week() - interval '2 hours', pg_temp.week() - interval '2 hours',
   pg_temp.week() + interval '2 hours', 'left', 0);
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b1216', pg_temp.table_id('Table 1'), 1, pg_temp.table_id('Table 2'), 3,
        pg_temp.at(60));
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e147', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001471');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d147', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet RB', '00000000-0000-4000-8000-00000000e147');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c147', '00000000-0000-4000-8000-000000000001', pg_temp.table_id('Table 2'), s.id,
       '00000000-0000-4000-8000-00000000d147', pg_temp.week() - interval '40 days', pg_temp.at(240)
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001';
create function pg_temp.hand(p_table text, p_rake bigint, p_at timestamptz, p_request text) returns void language sql as $$
  insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied, played_at,
                           idempotency_key)
  select d.venue_id, pg_temp.table_id(p_table), d.id, d.staff_id, d.device_id, 'holdem', p_rake * 20, p_rake, 0, false, p_at, p_request
  from public.dealer_down d where d.id = '00000000-0000-4000-8000-00000000c147';
$$;
-- Table 2: ₹3,000 between Mihir and Yash, then ₹3,000 among the three once Kunal has moved there.
select pg_temp.hand('Table 2', 300000, pg_temp.at(30), 'rakeback-hand-1');
select pg_temp.hand('Table 2', 300000, pg_temp.at(90), 'rakeback-hand-2');
-- Table 1: ₹1,000, Kunal's alone before he moved.
select pg_temp.hand('Table 1', 100000, pg_temp.at(45), 'rakeback-hand-3');
-- Table 3: ₹2,000 before the week began (the week before's), and ₹600 after.
select pg_temp.hand('Table 3', 200000, pg_temp.week() - interval '1 hour', 'rakeback-hand-4');
select pg_temp.hand('Table 3', 60000, pg_temp.week() + interval '1 hour', 'rakeback-hand-5');

select results_eq(
  $$ select right(member_id::text, 3), stake, share_paise
     from private.week_rake_shares('00000000-0000-4000-8000-000000000001', pg_temp.week(), pg_temp.week() + interval '7 days')
     order by 1, 2 $$,
  $$ values ('213'::text, 'nlh_100_200'::text, 250000::bigint), ('214', 'nlh_100_200', 250000), ('216', 'nlh_100_200', 100000),
            ('216', 'nlh_50_100', 100000), ('217', 'nlh_100_200', 60000) $$,
  'each member''s rake for the week at each stake: a hand split among those seated at its table then, the week''s hands only');

-- Nothing is given without a rate.
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', pg_temp.week()), 0, 'no rakeback rate, no rakeback');
insert into public.setting (venue_id, key, subject, value, effective_from)
values ('00000000-0000-4000-8000-000000000001', 'rakeback.rate', 'nlh_100_200', '{"basis_points": 1000, "expires_days": 7}', pg_temp.week() - interval '1 day');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from)
                   values ('00000000-0000-4000-8000-000000000001', 'rakeback.rate', 'nlh_50_100', '{"basis_points": 0, "expires_days": 7}',
                           pg_temp.week() - interval '1 day') $$,
  'a rate of 0 is a rate: none at 50/100');
-- The seed gives every tier every feature; here no tier has rakeback, then every tier does.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, effective_from)
select venue_id, id, 'rewards.rakeback', false, now() - interval '1 second' from public.tier where venue_id = '00000000-0000-4000-8000-000000000001';
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', pg_temp.week()), 0, 'nothing for a tier without rewards.rakeback');
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, effective_from)
select venue_id, id, 'rewards.rakeback', true, now() from public.tier where venue_id = '00000000-0000-4000-8000-000000000001';

-- 217 has since been erased: never given anything.
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member', qualifying_small_blind = null
where id = '00000000-0000-4000-8000-000000000217';

-- Yash is frozen at Monday's run: the others are given theirs, Yash not yet.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000214', 'Test freeze');
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', pg_temp.week()), 2,
  'Mihir and Kunal are given theirs; not the frozen Yash, nor the erased 217');
select results_eq($$ select pg_temp.given(m) from unnest(array['213', '214', '216', '217']) m $$,
  $$ values (25000::bigint), (0), (10000), (0) $$,
  '10% in ₹50 chips: ₹250 of ₹2,500, nothing yet for Yash, ₹100 of Kunal''s ₹1,000 at 100/200 (none at 50/100), none for 217');
select is((select expires_at from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000213' and reason = 'Hourly rakeback'),
  now() + interval '7 days', 'ending after the rate''s seven days');

-- A hand the tablet sent late: ₹1,500 among the three at Table 2. The next run gives what it adds.
select pg_temp.hand('Table 2', 150000, pg_temp.at(100), 'rakeback-hand-6');
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', pg_temp.week()), 2, 'a later run tops up Mihir and Kunal');
select results_eq($$ select pg_temp.given(m) from unnest(array['213', '216']) m $$, $$ values (30000::bigint), (15000) $$,
  'Mihir ₹300 of ₹3,000 and Kunal ₹150 of ₹1,500, given in two grants each');

-- Released, Yash is given his whole week by the next run.
update public.control_state set released_at = now(), release_reason = 'Test over',
  released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001')
where member_id = '00000000-0000-4000-8000-000000000214' and released_at is null;
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', pg_temp.week()), 1, 'released, Yash is given his');
select is(pg_temp.given('214'), 30000::bigint, 'his ₹300 of ₹3,000');

-- A new rate set during the week applies from the next one; a run again gives nothing twice.
insert into public.setting (venue_id, key, subject, value, effective_from)
values ('00000000-0000-4000-8000-000000000001', 'rakeback.rate', 'nlh_100_200', '{"basis_points": 2000, "expires_days": 7}', pg_temp.week() + interval '3 days');
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', pg_temp.week()), 0,
  'the rate in force when the week began is the week''s, and nothing is given twice');
select lives_ok($$ select private.give_rakeback_everywhere() $$, 'the daily run looks back over five weeks at every venue');
select is((select sum(amount_paise)::bigint from public.bonus_grant where reason = 'Hourly rakeback'), 75000::bigint, 'and gives nothing more');
select results_eq(
  $$ select right(payload ->> 'member_id', 3), (payload ->> 'amount_paise')::bigint from public.outbox_event
     where event_type = 'rakeback.given' order by 1, 2 $$,
  $$ values ('213'::text, 5000::bigint), ('213', 25000), ('214', 30000), ('216', 5000), ('216', 10000) $$,
  'each grant emits rakeback.given');

-- Six weeks ago member 215 earned ₹1,000 of rake at Table 2 and has been frozen since: that week is no longer looked
-- at, so the owner is told, once.
insert into public.setting (venue_id, key, subject, value, effective_from)
values ('00000000-0000-4000-8000-000000000001', 'rakeback.rate', 'nlh_100_200', '{"basis_points": 1000, "expires_days": 7}', pg_temp.week() - interval '60 days');
insert into public.visit (id, venue_id, member_id, opened_at)
values ('00000000-0000-4000-8000-0000000a1215', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', pg_temp.at(-35 * 24 * 60));
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-0000000a1215', pg_temp.table_id('Table 2'),
        1, pg_temp.at(-35 * 24 * 60), pg_temp.at(-35 * 24 * 60), pg_temp.at(-35 * 24 * 60 + 60), 'left', 0);
select pg_temp.hand('Table 2', 100000, pg_temp.at(-35 * 24 * 60 + 30), 'rakeback-hand-7');
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000215', 'Test freeze');
select private.give_rakeback_everywhere();
select private.give_rakeback_everywhere();
select results_eq(
  $$ select detail from public.alert where venue_id = '00000000-0000-4000-8000-000000000001' and kind = 'rakeback.unpaid' $$,
  $$ values (jsonb_build_object('week', to_char((pg_temp.week() - interval '35 days') at time zone 'Asia/Kolkata', 'YYYY-MM-DD'))) $$,
  'rakeback still due for a week past the five is told to the owner, once');
select is(pg_temp.given('215'), 0::bigint, 'and is not given');

-- Only a super admin sets the rate; only the scheduler gives it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'rakeback.rate', 'nlh_50_100', '{"basis_points": 500, "expires_days": 7}', now(), 'Busy') $$,
  '42501', null, 'an admin does not set a rakeback rate');
select throws_ok($$ select private.give_rakeback('00000000-0000-4000-8000-000000000001', now()) $$, '42501', null, 'no one signed in runs it');
reset role;

select * from finish();
rollback;
