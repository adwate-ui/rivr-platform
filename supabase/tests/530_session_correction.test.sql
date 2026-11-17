-- Correct a session from Bonus approvals (#1061, the owner, 17 Nov): a super admin moves when a player left each seat of a
-- visit and their time away, with a reason, in one call; the visit's waiting play-time steps the corrected time no longer
-- reaches are refused, steps it newly reaches wait, Bonus given stays and is counted, and time played reads net of time
-- away. 101 Vikram is a super admin and 217 Neel his own record; 103 Aditya an admin. 211 Ishaan, 212 Vihaan and 213 Mihir play.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor and its promotions are set aside, so this test seats its own players and runs its own promotion.
delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;
update public.visit set closed_at = now(), close_reason = 'door' where closed_at is null;
update public.promotion_version set status = 'ended' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.steps(p_member text) returns table (step integer, status text) language sql as $$
  select (g.event ->> 'stepMinutes')::integer, g.status from public.promotion_grant g
  where g.member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid and g.trigger = 'hours_step' order by 1;
$$;
-- One seat's correction as the console sends it, and the call with a reason.
create function pg_temp.seat(p_session text, p_away integer, p_end timestamptz default null) returns jsonb language sql as $$
  select jsonb_build_object('sessionId', ('00000000-0000-4000-8000-0000000530' || p_session)::uuid, 'awaySeconds', p_away, 'endedAt', p_end);
$$;
create function pg_temp.fix(p_seats jsonb, p_reason text) returns table (refused integer, given_above integer) language sql as $$
  select * from public.correct_seat_sessions(p_seats, p_reason);
$$;
-- The door and the Players report count a club day: their checks hold only when every seat here began on today's.
create temp table day on commit drop as
select private.club_day_of(now()) as today, private.club_day_of(now() - interval '250 minutes') = private.club_day_of(now()) as is_whole;
create temp table averages (at text, seconds bigint) on commit drop;
grant select on day to authenticated;
grant select, insert on averages to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.seat(text, integer, timestamptz), pg_temp.fix(jsonb, text) to authenticated;

-- A play-time Bonus: 500 after one hour, 1,000 after three.
with made as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Hours 530') returning id)
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000001', made.id, 1, 'live', 'Hours 530',
       '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 60, "chips": 500}, {"afterMinutes": 180, "chips": 1000}]}',
       '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 2)::text, 'timezone', 'Asia/Kolkata'),
       '{"perMember": "none"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}'
from made;
select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.name = 'Hours 530';

-- Ishaan (a1) sat at Table 3 from 200 to 10 minutes ago. Vihaan (a2) sat at Table 1 from 240 to 150 minutes ago, then at
-- Table 3 from 140 to 50 minutes ago with an hour away: two hours in all. Mihir (a3) has sat at Table 2 for 100 minutes and
-- has been away for the last 30. Neel (a4) sat at Table 4 for an hour.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000530a1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '205 minutes'),
  ('00000000-0000-4000-8000-0000000530a2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', now() - interval '245 minutes'),
  ('00000000-0000-4000-8000-0000000530a3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '105 minutes'),
  ('00000000-0000-4000-8000-0000000530a4', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', now() - interval '65 minutes');
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_since, away_seconds, call_time_minutes)
select ('00000000-0000-4000-8000-0000000530' || x.session)::uuid, '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || x.member)::uuid,
       ('00000000-0000-4000-8000-0000000530' || x.visit)::uuid, t.id, 1, now() - x.began, now() - x.began, now() - x.ended, case when x.ended is null then null else 'left' end,
       now() - x.away_since, x.away, 0
from (values ('b1', '211', 'a1', 'Table 3', interval '200 minutes', interval '10 minutes', null::interval, 0),
             ('b2', '212', 'a2', 'Table 1', interval '240 minutes', interval '150 minutes', null, 0),
             ('b3', '212', 'a2', 'Table 3', interval '140 minutes', interval '50 minutes', null, 3600),
             ('b4', '213', 'a3', 'Table 2', interval '100 minutes', null, interval '30 minutes', 0),
             ('b5', '217', 'a4', 'Table 4', interval '60 minutes', interval '1 minute', null, 0)) x (session, member, visit, tbl, began, ended, away_since, away)
join public.game_table t on t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = x.tbl;
-- Neel is Vikram's own record: the member account is his login.
update public.member set user_id = '00000000-0000-4000-8000-000000000101' where id = '00000000-0000-4000-8000-000000000217';
select private.weigh_hours_steps(v.id, now()) from public.visit v where v.id::text like '00000000-0000-4000-8000-0000000530a%';
select results_eq($$ select * from pg_temp.steps('211') $$, $$ values (60, 'waiting'::text), (180, 'waiting') $$, 'Ishaan''s two steps wait');
select results_eq($$ select * from pg_temp.steps('212') $$, $$ values (60, 'waiting'::text) $$, 'Vihaan''s two hours reach the first step only');
select results_eq($$ select * from pg_temp.steps('213') $$, $$ values (60, 'waiting'::text) $$, 'Mihir''s 70 minutes reach the first step');

-- The approvals list carries each visit's seats, time away with any still running, and time played net of it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select member_id, jsonb_array_length(sessions), away_seconds / 60, played_seconds / 60
                     from public.bonus_waiting_page('00000000-0000-4000-8000-000000000001', '{"page_size": 100}')
                     where visit_id::text like '00000000-0000-4000-8000-0000000530a%' and step_minutes = 60 order by member_id $$,
  $$ values ('00000000-0000-4000-8000-000000000211'::uuid, 1, 0::bigint, 190::bigint), ('00000000-0000-4000-8000-000000000212', 2, 60, 120),
            ('00000000-0000-4000-8000-000000000213', 1, 30, 70) $$,
  'each play-time row shows its seats, time away (Mihir''s still running) and time played');

-- Who may correct, and with what.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 0, now() - interval '80 minutes')), 'Left early') $$,
  '42501', null, 'an admin corrects no session');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 0, now() - interval '80 minutes')), ' x ') $$,
  '22023', null, 'a super admin gives a reason');
select throws_ok($$ select * from pg_temp.fix('[]', 'Left early') $$, '22023', null, 'and at least one seat');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b5', 0)), 'For myself') $$,
  'RVOWN', null, 'never on their own record');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 0, now() + interval '5 minutes')), 'Left early') $$,
  '22023', null, 'not an end ahead of now');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 0, now() - interval '300 minutes')), 'Left early') $$,
  '22023', null, 'nor one before he sat');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 200 * 60)), 'Away a lot') $$,
  '22023', null, 'nor more time away than the session');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b4', 1800, now() - interval '10 minutes')), 'Left early') $$,
  '22023', null, 'nor an end for a seat still taken');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b2', 0, now() - interval '100 minutes')), 'Left later') $$,
  '22023', null, 'nor an end that runs into the next seat');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 0), pg_temp.seat('b2', 0)), 'Two visits') $$,
  '22023', null, 'nor seats of two visits at once');
-- A refused seat refuses them all: the first seat's end is not kept either.
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b2', 0, now() - interval '170 minutes'), pg_temp.seat('b3', 0, now() + interval '5 minutes')),
                     'Both seats') $$, '22023', null, 'a seat that does not fit refuses the correction');
reset role;
select is((select ended_at from public.seat_session where id = '00000000-0000-4000-8000-0000000530b2'), now() - interval '150 minutes',
  'and no seat of it is saved');

-- Report averages before any correction, for comparison.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into averages select 'before', amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'players', (select today from day), (select today from day))
where figure = 'session_seconds';

-- Ishaan left at two hours, not checked out: the 1,000 after three hours is refused, the 500 still waits.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 0, now() - interval '80 minutes')), 'Left at 2 h, not checked out') $$,
  $$ values (1, 0) $$, 'the correction refuses one waiting step and finds none given above it');
reset role;
select results_eq($$ select * from pg_temp.steps('211') $$, $$ values (60, 'waiting'::text), (180, 'refused') $$, 'the step no longer reached is refused');
select is((select d.reason from public.promotion_bonus_decision d join public.promotion_grant g on g.decision_id = d.id
           where g.member_id = '00000000-0000-4000-8000-000000000211' and (g.event ->> 'stepMinutes')::integer = 180), 'Session corrected',
  'refused as Session corrected');

-- Vihaan's two seats in one call: the first ends at an hour, the second runs two hours with no time away. Three hours in all
-- reach the second step, which now waits; seat by seat, the first alone would have refused nothing but reached nothing either.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b2', 0, now() - interval '180 minutes'), pg_temp.seat('b3', 0, now() - interval '20 minutes')),
                     'Seats as the floor wrote them') $$,
  $$ values (0, 0) $$, 'both seats are corrected together');
reset role;
select results_eq($$ select * from pg_temp.steps('212') $$, $$ values (60, 'waiting'::text), (180, 'waiting') $$,
  'and the step the corrected time newly reaches waits for approval');

-- Mihir is still away: 35 minutes in all is 5 more than the 30 still running, which alone is stored. 65 minutes played.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b4', 35 * 60)), 'Away before he stepped out') $$,
  $$ values (0, 0) $$, 'time away in progress is corrected as a whole');
reset role;
select is((select away_seconds from public.seat_session where id = '00000000-0000-4000-8000-0000000530b4'), 300, 'only the part already over is stored');
select results_eq($$ select * from pg_temp.steps('213') $$, $$ values (60, 'waiting'::text) $$, 'and his first step still waits');

select results_eq($$ select a.reason, (a.after ->> 'away_seconds')::integer, (a.after ->> 'given_above')::integer from public.audit_log a
                     where a.action = 'seat.session_corrected' and a.entity_id = '00000000-0000-4000-8000-0000000530b1' $$,
  $$ values ('Left at 2 h, not checked out'::text, 0, 0) $$, 'Activity keeps the correction and why');

-- Approved, Ishaan's 500 is given; then 70 minutes away leaves 50 played: nothing waits, the 500 given stays and is counted.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001',
                     array(select g.id from public.promotion_grant g where g.member_id = '00000000-0000-4000-8000-000000000211' and g.status = 'waiting'), gen_random_uuid()) $$,
  'the super admin approves the 500');
select results_eq($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 70 * 60)), 'Away 70 minutes, not marked') $$,
  $$ values (0, 1) $$, 'time away refuses nothing more, and counts the one given above the corrected time');
reset role;
select results_eq($$ select * from pg_temp.steps('211') $$, $$ values (60, 'given'::text), (180, 'refused') $$, 'Bonus already given stays');
select is((select (a.after ->> 'given_above')::integer from public.audit_log a
           where a.action = 'seat.session_corrected' and a.entity_id = '00000000-0000-4000-8000-0000000530b1' and a.reason = 'Away 70 minutes, not marked'), 1,
  'and Activity notes it is above the corrected time');

-- Time played reads net of time away: 120 minutes sat, 70 away.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select case when (select is_whole from day)
  then is((select played_seconds / 60 from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
           where member_id = '00000000-0000-4000-8000-000000000211'), 50::bigint, 'the door shows 50 minutes played')
  else skip('the seats began on yesterday''s club day', 1) end;
select case when (select is_whole from day)
  then is((select played_seconds / 60 from public.player_visits_page('00000000-0000-4000-8000-000000000001',
             jsonb_build_object('scope', jsonb_build_object('from', (select today from day), 'to', (select today from day)), 'page_size', 1000))
           where member_id = '00000000-0000-4000-8000-000000000211'), 50::bigint, 'and so does the Players report')
  else skip('the seats began on yesterday''s club day', 1) end;
insert into averages select 'after', amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'players', (select today from day), (select today from day))
where figure = 'session_seconds';
reset role;
select case when (select is_whole from day)
  then ok((select seconds from averages where at = 'after') < (select seconds from averages where at = 'before'), 'and the report''s average session falls')
  else skip('the seats began on yesterday''s club day', 1) end;

-- His visit closed 30 minutes ago: an end after it is refused.
update public.visit set closed_at = now() - interval '30 minutes', close_reason = 'door' where id = '00000000-0000-4000-8000-0000000530a1';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from pg_temp.fix(jsonb_build_array(pg_temp.seat('b1', 0, now() - interval '20 minutes')), 'Left later') $$,
  '22023', null, 'nor an end after the visit closed');
reset role;

select * from finish();
rollback;
