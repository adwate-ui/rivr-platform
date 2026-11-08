-- The promotions list and the next play-time step (audit F-104, F-173). The seeded four-hour bonus goes live as 500 bonus
-- chips after two hours, then 1,000 after four. Mihir (213), seated 30 minutes, is told the 500 in 90 minutes; Kunal (216),
-- seated 130 minutes and paid his first step, the 1,000 in 110. Kavya (290), away, is counting towards nothing, and Ishaan
-- (211) has no seat. Nothing is promised past a budget, without promotions.feed, or during a freeze. The list says what
-- was given this week, the budget used, and which live promotion has gone a week giving nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table bonus as
select v.id as version_id, p.id as promotion_id from public.promotion p join public.promotion_version v on v.promotion_id = p.id
where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'hours_bonus';
grant select on bonus to authenticated;
update public.promotion_version set status = 'live', limits = '{"perMember": "per_visit"}',
  schedule = jsonb_set(schedule, '{startsOn}', to_jsonb(to_char(private.club_day_of(now()) - 1, 'YYYY-MM-DD'))),
  reward = '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 120, "chips": 500}, {"afterMinutes": 240, "chips": 1000}]}'
where id = (select version_id from bonus);
select private.sync_promotion((select promotion_id from bonus));

create function pg_temp.seat(p_visit uuid, p_member uuid, p_table text, p_seat integer, p_minutes integer, p_away_minutes integer)
returns void language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at)
  values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, now() - make_interval(mins => p_minutes + 5));
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, away_since)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, g.id, p_seat, now() - make_interval(mins => p_minutes),
         now() - make_interval(mins => p_minutes), case when p_away_minutes > 0 then now() - make_interval(mins => p_away_minutes) end
  from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = p_table;
$$;
select pg_temp.seat('00000000-0000-4000-8000-0000000b3901', '00000000-0000-4000-8000-000000000213', 'Table 2', 9, 30, 0);
select pg_temp.seat('00000000-0000-4000-8000-0000000b3902', '00000000-0000-4000-8000-000000000216', 'Table 3', 9, 130, 0);
select pg_temp.seat('00000000-0000-4000-8000-0000000b3903', '00000000-0000-4000-8000-000000000290', 'Table 4', 9, 60, 5);
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the minute''s sweep pays Kunal''s first step');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select * from public.my_next_play_time_bonus() $$, $$ values (500::bigint, 120, 5400::bigint) $$,
  'Mihir, 30 minutes in, is 90 minutes from the 500');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select results_eq($$ select * from public.my_next_play_time_bonus() $$, $$ values (1000::bigint, 240, 6600::bigint) $$,
  'Kunal, paid the first step, is 110 minutes from the 1,000');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000290');
select is_empty($$ select * from public.my_next_play_time_bonus() $$, 'Kavya, away, is counting towards nothing');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.my_next_play_time_bonus() $$, 'Ishaan has no seat');
reset role;

-- The list, read by marketing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select results_eq($$ select given_this_week, chips_given_this_week, points_given_this_week, budget_used_chips, is_quiet
                     from public.promotions_overview('00000000-0000-4000-8000-000000000001') where current_version_id = (select version_id from bonus) $$,
  $$ values (1::bigint, 500::bigint, 0::bigint, null::bigint, false) $$, 'the list has the 500 given once, and no budget to report');
select is((select is_quiet from public.promotions_overview('00000000-0000-4000-8000-000000000001') where name = 'Referral'), false,
  'a promotion live for less than a week is not marked');
reset role;

-- A budget already spent: the list shows it used, and the step is not promised.
update public.promotion_version set limits = '{"perMember": "per_visit", "budgetChips": 500}' where id = (select version_id from bonus);
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select budget_used_chips from public.promotions_overview('00000000-0000-4000-8000-000000000001') where current_version_id = (select version_id from bonus)),
  500::bigint, 'the list has the budget used');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_next_play_time_bonus() $$, 'a step past the budget is not promised');
reset role;
update public.promotion_version set limits = '{"perMember": "per_visit"}' where id = (select version_id from bonus);

-- Hours that close before the step is reached: not promised.
create temp table kept as select schedule from public.promotion_version where id = (select version_id from bonus);
update public.promotion_version set schedule = schedule || jsonb_build_object(
    'from', to_char(now() at time zone 'Asia/Kolkata' - interval '2 hours', 'HH24:MI'),
    'to', to_char(now() at time zone 'Asia/Kolkata' + interval '30 minutes', 'HH24:MI'))
where id = (select version_id from bonus);
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_next_play_time_bonus() $$, 'Mihir needs 90 minutes and the hours close in 30: not promised');
reset role;
update public.promotion_version set schedule = (select schedule from kept) where id = (select version_id from bonus);

-- A week on: the Referral has given nothing, the bonus has.
alter table public.promotion_version disable trigger promotion_version_touch_updated_at;
update public.promotion_version set updated_at = now() - interval '10 days',
  schedule = jsonb_set(schedule, '{startsOn}', to_jsonb(to_char(private.club_day_of(now()) - 10, 'YYYY-MM-DD')))
where status = 'live' and promotion_id in (select promotion_id from bonus union all
                                           select id from public.promotion where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Referral');
alter table public.promotion_version enable trigger promotion_version_touch_updated_at;
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select is_quiet from public.promotions_overview('00000000-0000-4000-8000-000000000001') where name = 'Referral'), true,
  'a promotion live a week with nothing given is marked');
select is((select is_quiet from public.promotions_overview('00000000-0000-4000-8000-000000000001') where current_version_id = (select version_id from bonus)), false,
  'one that gave something in the week is not');
reset role;

-- Staff keep it off the app: the bonus still pays, the app does not advertise it.
update public.promotion_version set channels = jsonb_set(channels, '{playerApp}', 'false') where id = (select version_id from bonus);
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_next_play_time_bonus() $$, 'a promotion kept off the app is not shown on it');
reset role;
update public.promotion_version set channels = jsonb_set(channels, '{playerApp}', 'true') where id = (select version_id from bonus);

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'promotions.feed', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_next_play_time_bonus() $$, 'without promotions.feed, nothing');
reset role;
delete from public.member_feature_override where member_id = '00000000-0000-4000-8000-000000000213' and feature_key = 'promotions.feed';

-- Once a day: paid the 500 on a first visit, a second visit that club day is told of the 1,000 the limits still allow.
update public.promotion_version set limits = '{"perMember": "per_day"}' where id = (select version_id from bonus);
update public.seat_session set ended_at = now(), end_reason = 'left', away_since = null where visit_id = '00000000-0000-4000-8000-0000000b3903';
update public.visit set closed_at = now(), close_reason = 'door' where id = '00000000-0000-4000-8000-0000000b3903';
select pg_temp.seat('00000000-0000-4000-8000-0000000b3904', '00000000-0000-4000-8000-000000000211', 'Table 4', 9, 125, 0);
select lives_ok($$ select private.sweep_hours_bonus() $$, 'Ishaan''s first visit is paid the 500');
update public.seat_session set ended_at = now(), end_reason = 'left' where visit_id = '00000000-0000-4000-8000-0000000b3904';
update public.visit set closed_at = now(), close_reason = 'door' where id = '00000000-0000-4000-8000-0000000b3904';
select pg_temp.seat('00000000-0000-4000-8000-0000000b3905', '00000000-0000-4000-8000-000000000211', 'Table 4', 9, 30, 0);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select * from public.my_next_play_time_bonus() $$, $$ values (1000::bigint, 240, 12600::bigint) $$,
  'the 500 is refused for the day, and the 1,000 is what he is told of');
reset role;
update public.promotion_version set limits = '{"perMember": "per_visit"}' where id = (select version_id from bonus);

insert into public.control_state (venue_id, level, reason, engaged_by_staff_id, engaged_at)
select '00000000-0000-4000-8000-000000000001', 'venue_freeze', 'test 390 freeze', s.id, now()
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_next_play_time_bonus() $$, 'during a freeze, nothing is promised');
reset role;

select * from finish();
rollback;
