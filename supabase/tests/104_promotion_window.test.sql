-- Hours-played promotions count the seated time inside their window (#457; the owner's answer on #445;
-- decision 0186). "Thursday afternoon" doubles the points earned 14:00 to 20:00 on Thursdays, "Thursday
-- afternoon at 100/200" only those at that stake, and "Thursday four hours" gives 50 points for four hours
-- in the window; "Any four hours" has no window. 22 October 2026 is a Thursday. Mihir (213) plays 14:00 to
-- 20:00 and closes at 20:30; Vihaan (212) plays 12:00 to 20:00; Kunal (216) plays 10:00 to 15:00; Kavya
-- (290) moves from 100/200 to 50/100 and takes an hour away; Mihir plays the Wednesday before too. Points
-- an hour are set here, as the club sets none since #629 (points by hand only): 10 at 100/200 (Tables 2 and 3),
-- 5 at 50/100 (Table 1).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select '00000000-0000-4000-8000-000000000001', 'points.per_hour', r.code, jsonb_build_object('points', r.points), '-infinity', 'Promotion window test'
from (values ('nlh_50_100', 5), ('nlh_100_200', 10)) as r (code, points);

-- A visit with one seat session at a table, closed as the cage or the door closes it.
create function pg_temp.play(p_visit uuid, p_member uuid, p_table text, p_seat integer, p_from timestamptz, p_to timestamptz, p_closed timestamptz)
returns void language plpgsql as $$
begin
  insert into public.visit (id, venue_id, member_id, opened_at) values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, p_from - interval '30 minutes');
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, g.id, p_seat, p_from, p_from, p_to, 'left'
  from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = p_table;
  update public.visit set closed_at = p_closed, close_reason = 'cash_out' where id = p_visit;
  perform private.earn_visit_points(p_visit);
  perform private.weigh_hours_played(p_visit);
end;
$$;
-- The points a promotion gave for a visit, or null for none.
create function pg_temp.given(p_promotion uuid, p_visit uuid) returns bigint language sql as $$
  select g.points from public.promotion_grant g where g.promotion_id = p_promotion and g.source_key = 'hours_played:' || p_visit;
$$;
-- A visit's points on time.
create function pg_temp.earned(p_visit uuid) returns bigint language sql as $$
  select sum(e.points)::bigint from public.points_earning e where e.visit_id = p_visit and e.basis = 'hours';
$$;

update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;
insert into public.promotion (id, venue_id, name, status, starts_at) values
  ('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-000000000001', 'Thursday afternoon', 'live', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000c1042', '00000000-0000-4000-8000-000000000001', 'Thursday four hours', 'live', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000c1043', '00000000-0000-4000-8000-000000000001', 'Any four hours', 'live', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000c1044', '00000000-0000-4000-8000-000000000001', 'Thursday afternoon at 100/200', 'live', now() - interval '1 day');
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1041', 'hours_played',
   '{"days": [4], "from": "14:00", "until": "20:00"}', '{"kind": "points", "multiplier_percent": 200}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1042', 'hours_played',
   '{"days": [4], "from": "14:00", "until": "20:00", "min_hours": 4}', '{"kind": "points", "points": 50}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1043', 'hours_played', '{"min_hours": 4}', '{"kind": "points", "points": 50}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1044', 'hours_played',
   '{"days": [4], "from": "14:00", "until": "20:00", "stakes": ["nlh_100_200"]}', '{"kind": "points", "multiplier_percent": 200}');

select pg_temp.play('00000000-0000-4000-8000-0000000a1041', '00000000-0000-4000-8000-000000000213', 'Table 2', 6,
  '2026-10-22 14:00+05:30', '2026-10-22 20:00+05:30', '2026-10-22 20:30+05:30');
select ok(pg_temp.earned('00000000-0000-4000-8000-0000000a1041') > 0, 'Mihir earns points for his six hours');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-0000000a1041'),
  pg_temp.earned('00000000-0000-4000-8000-0000000a1041'),
  'closing at 20:30, after the window, he still has all six hours'' points doubled');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1042', '00000000-0000-4000-8000-0000000a1041'), 50::bigint,
  'and his six hours in the window earn the four-hour 50');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1043', '00000000-0000-4000-8000-0000000a1041'), 50::bigint,
  'and a promotion with no window gives as before');

select pg_temp.play('00000000-0000-4000-8000-0000000a1042', '00000000-0000-4000-8000-000000000212', 'Table 3', 7,
  '2026-10-22 12:00+05:30', '2026-10-22 20:00+05:30', '2026-10-22 20:30+05:30');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-0000000a1042'),
  pg_temp.earned('00000000-0000-4000-8000-0000000a1042') * 3 / 4,
  'Vihaan''s eight hours double only the six inside the window');

select pg_temp.play('00000000-0000-4000-8000-0000000a1043', '00000000-0000-4000-8000-000000000216', 'Table 2', 8,
  '2026-10-22 10:00+05:30', '2026-10-22 15:00+05:30', '2026-10-22 15:30+05:30');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-0000000a1043'),
  pg_temp.earned('00000000-0000-4000-8000-0000000a1043') / 5, 'Kunal''s one hour of five in the window is doubled');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1042', '00000000-0000-4000-8000-0000000a1043'), null::bigint,
  'but one hour in the window is not four, though he played five');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1043', '00000000-0000-4000-8000-0000000a1043'), 50::bigint,
  'which the promotion with no window counts');

-- Kavya: 100/200 at Table 2 from 12:00, moved to 50/100 at Table 1 at 16:00, until 02:00, an hour away.
-- 14 hours, 13 played. Table 2's 4 hours play 13,371 seconds (37 points), and its 2 in the window 6,685
-- (18 points); Table 1's 10 hours play 33,428 (46 points), and its 4 in the window 13,371 (18 points).
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a1045', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000290', '2026-10-22 11:30+05:30');
with session as (
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000290', '00000000-0000-4000-8000-0000000a1045', g.id, 9,
         '2026-10-22 12:00+05:30', '2026-10-22 16:00+05:30', '2026-10-23 02:00+05:30', 'left', 3600
  from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 1'
  returning id
)
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
select '00000000-0000-4000-8000-000000000001', session.id, two.id, 9, one.id, 9, '2026-10-22 16:00+05:30'
from session, public.game_table two, public.game_table one
where two.venue_id = '00000000-0000-4000-8000-000000000001' and two.name = 'Table 2'
  and one.venue_id = '00000000-0000-4000-8000-000000000001' and one.name = 'Table 1';
update public.visit set closed_at = '2026-10-23 02:30+05:30', close_reason = 'cash_out' where id = '00000000-0000-4000-8000-0000000a1045';
select private.earn_visit_points('00000000-0000-4000-8000-0000000a1045');
select private.weigh_hours_played('00000000-0000-4000-8000-0000000a1045');
select is(pg_temp.earned('00000000-0000-4000-8000-0000000a1045'), 83::bigint, 'Kavya earns 37 points at 100/200 and 46 at 50/100');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-0000000a1045'), 36::bigint,
  'the window doubles the 18 and 18 points she earned inside it, each at its table''s rate');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1044', '00000000-0000-4000-8000-0000000a1045'), 18::bigint,
  'and at 100/200 only the 18 earned there, though she played longest at 50/100');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1042', '00000000-0000-4000-8000-0000000a1045'), 50::bigint,
  'and her 5.57 hours played in the window earn the four-hour 50');

select pg_temp.play('00000000-0000-4000-8000-0000000a1044', '00000000-0000-4000-8000-000000000213', 'Table 2', 6,
  '2026-10-21 14:00+05:30', '2026-10-21 20:00+05:30', '2026-10-21 20:30+05:30');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-0000000a1044'), null::bigint,
  'Mihir''s Wednesday is outside Thursday''s window: nothing');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1043', '00000000-0000-4000-8000-0000000a1044'), 50::bigint,
  'while the promotion with no window gives');

select * from finish();
rollback;
