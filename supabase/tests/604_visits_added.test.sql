-- Visits added by hand and from a file (the owner, 25 Nov; #1134): a super admin's add counts at once, the floor's waits for
-- a super admin to approve or refuse it; Edit's rules hold; a file is all lines or none; and an added visit's play-time
-- Bonus waits, weighed on its own night. 101 is a super admin, 104 a cashier; a host becomes the Floor member here. The
-- members are picked from the seed, none with a visit in the last ten days; each added visit is three nights ago.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.promotion_version set status = 'ended' where status = 'live';
update public.staff s set role = 'floor'
where s.id = (select h.id from public.staff h where h.venue_id = '00000000-0000-4000-8000-000000000001' and h.role = 'host' and h.user_id is not null
                and h.user_id <> '00000000-0000-4000-8000-000000000108' order by h.user_id limit 1);
create temp table who on commit drop as
select 'floor'::text as name, (select min(s.user_id::text) from public.staff s
  where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.role = 'floor' and s.user_id is not null)::uuid as id;
insert into who
select (array['a', 'b', 'c', 'd'])[n], id
from (select m.id, row_number() over (order by m.member_number) as n from public.member m
      where m.venue_id = '00000000-0000-4000-8000-000000000001' and m.erased_at is null
        and not exists (select 1 from public.staff s where s.phone = m.phone)
        and not exists (select 1 from public.visit v where v.member_id = m.id and v.opened_at > now() - interval '10 days')) p
where n <= 4;
-- Three nights ago, 20:00 to 23:30 IST.
create temp table night on commit drop as
select (d + time '20:00') at time zone 'Asia/Kolkata' as opened, (d + time '23:30') at time zone 'Asia/Kolkata' as closed, d as day
from (select private.club_day_of(now()) - 3 as d) x;
grant select on who, night to authenticated;
create function pg_temp.w(p_name text) returns uuid language sql as $$ select id from who where name = p_name $$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create function pg_temp.as_person(p_person uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.add(p_member text, p_from timestamptz, p_to timestamptz, p_request uuid default gen_random_uuid())
returns table (status text, visit_id uuid) language sql as $$
  select * from public.add_visit('00000000-0000-4000-8000-000000000001', pg_temp.w(p_member), pg_temp.t('Table 5'), p_from, p_to, 'Played, not checked in', p_request);
$$;
-- Any added visit's request, which no signed-in caller reads from the table itself.
create function pg_temp.decided() returns setof uuid language sql security definer as $$ select id from public.visit_request where status = 'approved' $$;
create function pg_temp.any_request() returns uuid language sql security definer as $$ select id from public.visit_request limit 1 $$;
grant execute on function pg_temp.w(text), pg_temp.t(text), pg_temp.as_person(uuid), pg_temp.add(text, timestamptz, timestamptz, uuid), pg_temp.any_request(),
  pg_temp.decided() to authenticated;
select is((select count(*)::integer from who where id is not null), 5, 'the seed gives the members this test needs');

-- A play-time Bonus live since before that night, on that night's weekday alone: 500 after an hour, 1,000 after three.
-- Another approved only now, every day: it pays nothing for a night before it.
with made as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Hours 604') returning id)
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels, decided_at)
select '00000000-0000-4000-8000-000000000001', made.id, 1, 'live', 'Hours 604',
       '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 60, "chips": 500}, {"afterMinutes": 180, "chips": 1000}]}',
       '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', jsonb_build_array(extract(isodow from (select day from night))::integer), 'from', '06:00', 'to', '06:00',
                          'startsOn', ((select day from night) - 7)::text, 'timezone', 'Asia/Kolkata'),
       '{"perMember": "none"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}', now() - interval '10 days'
from made;
with made as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Late 604') returning id)
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels, decided_at)
select '00000000-0000-4000-8000-000000000001', made.id, 1, 'live', 'Late 604',
       '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 60, "chips": 500}, {"afterMinutes": 180, "chips": 1000}]}',
       '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', ((select day from night) - 7)::text,
                          'timezone', 'Asia/Kolkata'),
       '{"perMember": "none"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}', now()
from made;
select private.sync_promotion(p.id) from public.promotion p where p.name in ('Hours 604', 'Late 604');

-- A super admin's add counts at once: one seat at its table for the whole visit, owing no call time, closed by hand.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select status from pg_temp.add('a', (select opened from night), (select closed from night), '00000000-0000-4000-8000-00000000a604')), 'added',
  'a super admin''s visit is added at once');
select is((select status from pg_temp.add('a', (select opened from night), (select closed from night), '00000000-0000-4000-8000-00000000a604')), 'added',
  'the same request again is the same answer');
select results_eq($$ select tables, minutes_played from public.member_visits('00000000-0000-4000-8000-000000000001', pg_temp.w('a'), 5) $$,
  $$ values ('Table 5'::text, 210) $$, 'the record shows it, its table and time played');
select is((select jsonb_array_length(sessions) from public.member_visits('00000000-0000-4000-8000-000000000001', pg_temp.w('a'), 5)), 1,
  'with its seat, for a super admin to edit');
reset role;
select results_eq($$ select v.close_reason, s.call_time_minutes, s.started_at = v.opened_at and s.ended_at = v.closed_at
                     from public.visit v join public.seat_session s on s.visit_id = v.id where v.member_id = pg_temp.w('a') $$,
  $$ values ('by_hand'::text, 0, true) $$, 'one seat the whole visit, no call time, closed by hand');
select is((select count(*)::integer from public.visit_request where member_id = pg_temp.w('a')), 1, 'one add, kept once');

-- Its play-time Bonus waits, weighed on its own night; the promotion approved after it pays nothing.
select results_eq($$ select (g.event ->> 'stepMinutes')::integer, g.status from public.promotion_grant g
                     where g.member_id = pg_temp.w('a') and g.trigger = 'hours_step' order by 1 $$,
  $$ values (60, 'waiting'::text), (180, 'waiting') $$, 'both steps wait for a super admin, on that night''s weekday');
select is((select private.promotion_event('hours_step', v, jsonb_build_object('member_id', pg_temp.w('a'), 'at', (select closed from night)))->> 'at')::timestamptz,
  (select closed from night), 'a step is at the time it is weighed')
from public.promotion_version v where v.name = 'Hours 604';

-- The floor's add waits for a super admin; it shows on the record and in the queue.
select pg_temp.as_person(pg_temp.w('floor'));
select is((select status from pg_temp.add('b', (select opened from night), (select closed from night))), 'waiting', 'the floor''s add waits');
select results_eq($$ select table_name, status from public.member_visit_requests('00000000-0000-4000-8000-000000000001', pg_temp.w('b')) $$,
  $$ values ('Table 5'::text, 'waiting'::text) $$, 'the record shows it waiting');
select is_empty($$ select * from public.visits_waiting('00000000-0000-4000-8000-000000000001') $$, 'the floor does not decide it');
reset role;
select ok(not exists (select 1 from public.visit where member_id = pg_temp.w('b') and close_reason = 'by_hand'), 'nothing counts yet');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'visitApprovals'), 1,
  'a super admin''s queue counts it');
select lives_ok(format('select public.decide_visit_request(%L, true)',
  (select request_id from public.visits_waiting('00000000-0000-4000-8000-000000000001') where member_id = pg_temp.w('b'))), 'a super admin approves it');
reset role;
select is((select count(*)::integer from public.visit where member_id = pg_temp.w('b') and close_reason = 'by_hand'), 1, 'and it counts');

-- A clash is refused at once; a waiting add refused needs a reason, and says why.
select pg_temp.as_person(pg_temp.w('floor'));
select throws_ok($$ select * from pg_temp.add('b', (select opened from night) + interval '1 hour', (select closed from night) + interval '1 hour') $$,
  'RVVCL', null, 'never into the member''s other visit');
select is((select status from pg_temp.add('c', (select opened from night), (select closed from night))), 'waiting', 'another waits');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok(format('select public.decide_visit_request(%L, false)',
  (select request_id from public.visits_waiting('00000000-0000-4000-8000-000000000001') where member_id = pg_temp.w('c'))), '22023', null,
  'a refusal needs a reason');
select lives_ok(format('select public.decide_visit_request(%L, false, %L)',
  (select request_id from public.visits_waiting('00000000-0000-4000-8000-000000000001') where member_id = pg_temp.w('c')), 'Not at the club that night'),
  'refused with a reason');
select pg_temp.as_person(pg_temp.w('floor'));
select results_eq($$ select status, refusal from public.member_visit_requests('00000000-0000-4000-8000-000000000001', pg_temp.w('c')) $$,
  $$ values ('refused'::text, 'Not at the club that night'::text) $$, 'the record says it was refused, and why');

-- Edit's rules.
select throws_ok($$ select * from pg_temp.add('d', now() - interval '1 hour', now() + interval '1 hour') $$, 'RVVTM', null, 'never ahead of now');
select throws_ok($$ select * from pg_temp.add('d', (select opened from night), (select day + 1 + time '07:00' from night) at time zone 'Asia/Kolkata') $$,
  'RVVDY', null, 'never past 06:00 after its club day');
select throws_ok(format('select * from public.add_visit(%L, %L, %L, %L, %L, %L, gen_random_uuid())', '00000000-0000-4000-8000-000000000001',
  pg_temp.w('d'), pg_temp.t('Table 5'), (select opened from night), (select closed from night), 'ok'), '22023', null, 'a reason of three characters at least');
select throws_ok(format('select * from public.add_visit(%L, %L, %L, %L, %L, %L, gen_random_uuid())', '00000000-0000-4000-8000-000000000001',
  pg_temp.w('d'), (select id from public.game_table where venue_id <> '00000000-0000-4000-8000-000000000001' limit 1),
  (select opened from night), (select closed from night), 'Played, not checked in'), 'RVTBL', null, 'never at another venue''s table');
select throws_ok(format('select public.decide_visit_request(%L, true)', pg_temp.any_request()), '42501', null,
  'the floor decides no added visit');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from pg_temp.add('d', (select opened from night), (select closed from night)) $$, '42501', null, 'a cashier adds no visit');
-- Never on the staff member's own record: c's number made the floor member's.
reset role;
update public.member set phone = (select s.phone from public.staff s where s.user_id = pg_temp.w('floor')
                                    and s.venue_id = '00000000-0000-4000-8000-000000000001')
where id = pg_temp.w('c');
select pg_temp.as_person(pg_temp.w('floor'));
select throws_ok($$ select * from pg_temp.add('c', (select opened from night) - interval '2 days', (select closed from night) - interval '2 days') $$,
  'RVOWN', null, 'staff never add a visit to their own record');
reset role;

-- A file: super admins alone; every line or none, a clash between its own lines refused; the same file again changes nothing.
create temp table lines on commit drop as
select jsonb_build_array(
  jsonb_build_object('memberId', pg_temp.w('d'), 'tableId', pg_temp.t('Table 5'), 'openedAt', (select opened from night),
                     'closedAt', (select closed from night), 'reason', 'From the paper register'),
  jsonb_build_object('memberId', pg_temp.w('d'), 'tableId', pg_temp.t('Table 5'), 'openedAt', (select opened from night) - interval '1 day',
                     'closedAt', (select closed from night) - interval '1 day', 'reason', 'From the paper register')) as good,
jsonb_build_array(
  jsonb_build_object('memberId', pg_temp.w('c'), 'tableId', pg_temp.t('Table 5'), 'openedAt', (select opened from night),
                     'closedAt', (select closed from night), 'reason', 'From the paper register'),
  jsonb_build_object('memberId', pg_temp.w('c'), 'tableId', pg_temp.t('Table 5'), 'openedAt', (select opened from night) + interval '1 hour',
                     'closedAt', (select closed from night), 'reason', 'From the paper register')) as clashing;
grant select on lines to authenticated;
select pg_temp.as_person(pg_temp.w('floor'));
select throws_ok($$ select public.visits_from_file('00000000-0000-4000-8000-000000000001', (select good from lines), gen_random_uuid()) $$, '42501', null,
  'the floor adds no file');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(public.visits_from_file('00000000-0000-4000-8000-000000000001', (select good from lines), '00000000-0000-4000-8000-00000000f604'), 2, 'a file adds every line');
select is(public.visits_from_file('00000000-0000-4000-8000-000000000001', (select good from lines), '00000000-0000-4000-8000-00000000f604'), 2,
  'the same file again changes nothing');
select throws_ok($$ select public.visits_from_file('00000000-0000-4000-8000-000000000001', (select clashing from lines), gen_random_uuid()) $$, 'RVVCL', null,
  'two lines that clash refuse the file');
select throws_ok($$ select public.visits_from_file('00000000-0000-4000-8000-000000000001',
  (select jsonb_agg((select good from lines) -> 0) from generate_series(1, 501)), gen_random_uuid()) $$, '22023', null, 'never more than 500 lines');
reset role;
select is((select count(*)::integer from public.visit where member_id = pg_temp.w('d') and close_reason = 'by_hand'), 2, 'two visits from the file');
select is((select count(*)::integer from public.visit where member_id = pg_temp.w('c') and close_reason = 'by_hand'), 0, 'and none from the refused file');

-- A refusal names the file's own line, as the preview numbers it.
create function pg_temp.refused_at(p_lines jsonb) returns text language plpgsql as $$
declare
  v_detail text;
begin
  perform public.visits_from_file('00000000-0000-4000-8000-000000000001', p_lines, gen_random_uuid());
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail;
end;
$$;
grant execute on function pg_temp.refused_at(jsonb) to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(pg_temp.refused_at((select jsonb_build_array((clashing -> 0) || '{"line": 4}', (clashing -> 1) || '{"line": 7}') from lines)), '7',
  'a refused file names the line as the file numbers it');

-- Decided already: its own refusal, so a second super admin is told so.
select throws_ok(format('select public.decide_visit_request(%L, false, %L)',
  (select d from pg_temp.decided() d limit 1), 'Not here that night'), 'RVVDD', null, 'a visit approved already is not refused after');
reset role;

-- A visit added within the last day is never weighed for a seat Bonus by the minute's sweep.
create temp table recent on commit drop as
select private.insert_added_visit('00000000-0000-4000-8000-000000000001', pg_temp.w('a'), pg_temp.t('Table 5'),
                                  now() - interval '3 hours', now() - interval '2 hours', null) as visit_id;
select ok(exists (select 1 from private.seat_bonus_weighed w join public.seat_session s on s.id = w.seat_session_id
                  where s.visit_id = (select visit_id from recent)),
  'an added seat is marked weighed, so no seat Bonus comes of it');

-- While promotions are stopped, a super admin's add, an approval and a file are refused; the floor's add may still wait.
insert into public.control_state (venue_id, level, feature, reason)
values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'test 604');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from pg_temp.add('d', (select opened from night) - interval '3 days', (select closed from night) - interval '3 days') $$,
  'RVKIL', null, 'no visit added while promotions are stopped, as nothing would weigh its Bonus later');
select throws_ok($$ select public.visits_from_file('00000000-0000-4000-8000-000000000001', (select good from lines), gen_random_uuid()) $$, 'RVKIL', null,
  'nor a file');
select pg_temp.as_person(pg_temp.w('floor'));
select is((select status from pg_temp.add('d', (select opened from night) - interval '3 days', (select closed from night) - interval '3 days')), 'waiting',
  'the floor''s add still waits');
reset role;

select * from finish();
rollback;
