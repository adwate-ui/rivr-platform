-- Correct a visit from Reports (#1075, the owner, 18 Nov): a super admin moves a visit's check-in and check-out, with its
-- seats' ends and time away, in the one call Bonus approvals uses too. 101 Vikram is a super admin and 217 Neel his own
-- record; 103 Aditya an admin. 211 Ishaan came twice on a club day ten days ago: 18:00 to 19:00, then 20:00 to 23:00 with
-- a seat at Table 3 from 20:10 to 22:40. 213 Mihir is in the club now.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
-- A moment on that club day, by its IST clock time: 06:00 to 23:59 that date, 00:00 to 05:59 the next morning.
create temp table base on commit drop as select private.club_day_of(now()) - 10 as day;
create function pg_temp.at(p_time text) returns timestamptz language sql as $$
  select ((select day from base) + p_time::time) at time zone 'Asia/Kolkata' + case when p_time < '06:00' then interval '1 day' else interval '0' end;
$$;
create function pg_temp.fix(p_visit text, p_in timestamptz, p_out timestamptz, p_seats jsonb, p_reason text)
returns table (refused integer, given_above integer) language sql as $$
  select * from public.correct_visit(('00000000-0000-4000-8000-0000000535' || p_visit)::uuid, p_seats, p_reason, p_in, p_out);
$$;
create function pg_temp.seat(p_end timestamptz) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('sessionId', '00000000-0000-4000-8000-0000000535b1', 'awaySeconds', 0, 'endedAt', p_end));
$$;
grant select on base to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.at(text), pg_temp.fix(text, timestamptz, timestamptz, jsonb, text), pg_temp.seat(timestamptz) to authenticated;

update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000213' and closed_at is null;
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000535a1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', pg_temp.at('18:00'), pg_temp.at('19:00'), 'door'),
  ('00000000-0000-4000-8000-0000000535a2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', pg_temp.at('20:00'), pg_temp.at('23:00'), 'door'),
  ('00000000-0000-4000-8000-0000000535a3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '30 minutes', null, null),
  ('00000000-0000-4000-8000-0000000535a4', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', pg_temp.at('20:00'), pg_temp.at('21:00'), 'door'),
  -- 212 Vihaan played through the night, past 06:00.
  ('00000000-0000-4000-8000-0000000535a5', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', pg_temp.at('23:00'), pg_temp.at('07:00') + interval '1 day', 'door');
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds, call_time_minutes)
select '00000000-0000-4000-8000-0000000535b1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
       '00000000-0000-4000-8000-0000000535a2', t.id, 1, pg_temp.at('20:10'), pg_temp.at('20:10'), pg_temp.at('22:40'), 'left', 0, 0
from public.game_table t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 3';
update public.member set user_id = '00000000-0000-4000-8000-000000000101' where id = '00000000-0000-4000-8000-000000000217';

-- The Players report gives a super admin the day's visits, each with its seats; anyone else none.
create temp table asked on commit drop as
select jsonb_build_object('scope', jsonb_build_object('from', day::text, 'to', day::text), 'page_size', 100) as view from base;
grant select on asked to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select jsonb_path_query_array(visits, '$[*].visitId') || jsonb_path_query_array(visits, '$[1].sessions[*].id')
           from public.player_visits_page('00000000-0000-4000-8000-000000000001', (select view from asked))
           where member_id = '00000000-0000-4000-8000-000000000211'),
  '["00000000-0000-4000-8000-0000000535a1", "00000000-0000-4000-8000-0000000535a2", "00000000-0000-4000-8000-0000000535b1"]'::jsonb,
  'a super admin''s Visits row holds the day''s two visits, the second with its seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select visits is null from public.player_visits_page('00000000-0000-4000-8000-000000000001', (select view from asked))
           where member_id = '00000000-0000-4000-8000-000000000211'), true, 'an admin''s row holds none');

-- Who may correct, and what does not fit.
select throws_ok($$ select * from pg_temp.fix('a2', pg_temp.at('19:30'), null, '[]', 'Came in earlier') $$, '42501', null, 'an admin may not correct a visit');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from pg_temp.fix('a4', pg_temp.at('19:30'), null, '[]', 'For myself') $$, 'RVOWN', null, 'nor anyone their own record''s');
select throws_ok($$ select * from pg_temp.fix('a2', pg_temp.at('19:30'), null, '[]', ' x ') $$, '22023', null, 'a reason is asked');
select throws_ok($$ select * from pg_temp.fix('a2', null, null, '[]', 'Nothing at all') $$, '22023', null, 'and something to correct');
select throws_ok($$ select * from pg_temp.fix('a2', pg_temp.at('20:15'), null, '[]', 'Came in later') $$, '22023', null,
  'check-in falls no later than the first seat');
select throws_ok($$ select * from pg_temp.fix('a2', pg_temp.at('05:59') - interval '1 day', null, '[]', 'The day before') $$, '22023', null,
  'and stays on its club day');
select throws_ok($$ select * from pg_temp.fix('a2', pg_temp.at('18:30'), null, '[]', 'Came in earlier') $$, '22023', null,
  'and runs into none of the member''s other visits');
select throws_ok($$ select * from pg_temp.fix('a2', null, pg_temp.at('22:30'), '[]', 'Left earlier') $$, '22023', null,
  'check-out falls no earlier than the last seat ends');
select throws_ok($$ select * from pg_temp.fix('a2', null, now() + interval '5 minutes', '[]', 'Left later') $$, '22023', null, 'nor ahead of now');
select throws_ok($$ select * from pg_temp.fix('a3', null, now() - interval '5 minutes', '[]', 'Left already') $$, '22023', null,
  'a visit still open is checked out at the door');
select throws_ok($$ select * from pg_temp.fix('a2', null, pg_temp.at('06:30') + interval '1 day', '[]', 'Left at dawn') $$, '22023',
  'Check-out stays within the visit''s club day',
  'a check-out stays within the club day, up to 06:00 the next morning');
select lives_ok($$ select * from pg_temp.fix('a5', null, pg_temp.at('06:30') + interval '1 day', '[]', 'Left at 06:30') $$,
  'unless the visit already ran past it, as far as it ran');
select throws_ok($$ select * from pg_temp.fix('a1', null, null, pg_temp.seat(null), 'Wrong seat') $$, '22023', 'One visit''s seats at a time',
  'and a visit''s own seats alone are corrected with it');

-- Check-in, check-out and a seat's end, in one call: the seat's end is held to the corrected check-out.
select lives_ok($$ select * from pg_temp.fix('a2', pg_temp.at('19:30'), pg_temp.at('22:15'), pg_temp.seat(pg_temp.at('22:00')), 'Card times') $$,
  'a super admin moves check-in, check-out and a seat''s end together');
reset role;
select is((select array[opened_at, closed_at] from public.visit where id = '00000000-0000-4000-8000-0000000535a2'), array[pg_temp.at('19:30'), pg_temp.at('22:15')],
  'the visit has its corrected times');
select is((select ended_at from public.seat_session where id = '00000000-0000-4000-8000-0000000535b1'), pg_temp.at('22:00'), 'and the seat its end');
select is((select reason || ' ' || (before ->> 'opened_at')::timestamptz::text from public.audit_log
           where action = 'visit.times_corrected' and entity_id = '00000000-0000-4000-8000-0000000535a2'),
  'Card times ' || pg_temp.at('20:00')::text, 'Activity keeps the visit''s times as they were, with the reason');
select is((select count(*)::integer from public.audit_log where action = 'seat.session_corrected' and entity_id = '00000000-0000-4000-8000-0000000535b1'), 1,
  'and the seat''s correction');

-- Every screen reads the corrected rows: the Players report's In and Out.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select array[checked_in_at, checked_out_at] from public.player_visits_page('00000000-0000-4000-8000-000000000001', (select view from asked))
           where member_id = '00000000-0000-4000-8000-000000000211'), array[pg_temp.at('18:00'), pg_temp.at('22:15')],
  'the Players report reads the day''s first check-in and its corrected last check-out');

-- Last, as neither can be undone here: a frozen member's visit, and a super admin of another venue alone.
reset role;
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000211', 'Under review');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from pg_temp.fix('a2', pg_temp.at('19:15'), null, '[]', 'Came in earlier') $$, 'RVMBR', null, 'a frozen member''s visit waits');
reset role;
update public.staff set role = 'admin' where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from pg_temp.fix('a2', pg_temp.at('19:15'), null, '[]', 'Came in earlier') $$, '42501', null,
  'and a super admin of another venue alone corrects none here');
reset role;

select * from finish();
rollback;
