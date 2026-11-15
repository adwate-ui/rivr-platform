-- Hours-played promotions count the seated time inside their window (#457; the owner's answer on #445; decision 0186).
-- "Thursday afternoon" gives ₹50 of bonus for any play 14:00 to 20:00 on Thursdays, "Thursday four hours" for four hours in
-- that window, "Thursday four hours at 100/200" for four there at that stake, and "Any four hours" has no window. 22 October
-- 2026 is a Thursday. Mihir (213) plays 14:00 to 20:00 and closes at 20:30; Vihaan (212) plays 12:00 to 20:00; Kunal (216)
-- plays 10:00 to 15:00; Kavya (290) moves from 100/200 to 50/100 and takes an hour away; Mihir plays the Wednesday before too.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A visit with one seat session at a table, closed as the cage or the door closes it.
create function pg_temp.play(p_visit uuid, p_member uuid, p_table text, p_seat integer, p_from timestamptz, p_to timestamptz, p_closed timestamptz)
returns void language plpgsql as $$
begin
  insert into public.visit (id, venue_id, member_id, opened_at) values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, p_from - interval '30 minutes');
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, g.id, p_seat, p_from, p_from, p_to, 'left'
  from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = p_table;
  update public.visit set closed_at = p_closed, close_reason = 'cash_out' where id = p_visit;
  perform private.weigh_hours_played(p_visit);
end;
$$;
-- The bonus, in paise, a promotion gave for a visit, or null for none.
create function pg_temp.given(p_promotion uuid, p_visit uuid) returns bigint language sql as $$
  select g.cost_paise from public.promotion_grant g where g.promotion_id = p_promotion and g.source_key = 'hours_played:' || p_visit;
$$;
-- A visit's seconds played inside a window.
create function pg_temp.in_window(p_visit uuid, p_conditions jsonb) returns bigint language sql as $$
  select w.o_seconds from private.visit_window_time(p_visit, p_conditions) w;
$$;

update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;
insert into public.promotion (id, venue_id, name, status, starts_at) values
  ('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-000000000001', 'Thursday afternoon', 'live', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000c1042', '00000000-0000-4000-8000-000000000001', 'Thursday four hours', 'live', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000c1043', '00000000-0000-4000-8000-000000000001', 'Any four hours', 'live', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000c1044', '00000000-0000-4000-8000-000000000001', 'Thursday four hours at 100/200', 'live', now() - interval '1 day');
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1041', 'hours_played', '{"days": [4], "from": "14:00", "until": "20:00"}', '{"kind": "bonus", "amount_paise": 5000, "expires_days": 7}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1042', 'hours_played', '{"days": [4], "from": "14:00", "until": "20:00", "min_hours": 4}', '{"kind": "bonus", "amount_paise": 5000, "expires_days": 7}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1043', 'hours_played', '{"min_hours": 4}', '{"kind": "bonus", "amount_paise": 5000, "expires_days": 7}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1044', 'hours_played', '{"days": [4], "from": "14:00", "until": "20:00", "stakes": ["nlh_100_200"], "min_hours": 4}', '{"kind": "bonus", "amount_paise": 5000, "expires_days": 7}');

select pg_temp.play('00000000-0000-4000-8000-0000000a1041', '00000000-0000-4000-8000-000000000213', 'Table 2', 6,
  '2026-10-22 14:00+05:30', '2026-10-22 20:00+05:30', '2026-10-22 20:30+05:30');
select is((select h.o_played from private.visit_hours('00000000-0000-4000-8000-0000000a1041') h), 21600::bigint, 'Mihir''s six hours are counted');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-0000000a1041'), 5000::bigint, 'closing at 20:30, after the window, his time inside it still counts');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1042', '00000000-0000-4000-8000-0000000a1041'), 5000::bigint, 'and his six hours in the window earn the four-hour bonus');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1043', '00000000-0000-4000-8000-0000000a1041'), 5000::bigint, 'and a promotion with no window gives as before');

select pg_temp.play('00000000-0000-4000-8000-0000000a1042', '00000000-0000-4000-8000-000000000212', 'Table 3', 7,
  '2026-10-22 12:00+05:30', '2026-10-22 20:00+05:30', '2026-10-22 20:30+05:30');
select is(pg_temp.in_window('00000000-0000-4000-8000-0000000a1042', '{"days": [4], "from": "14:00", "until": "20:00"}'), 21600::bigint, 'of Vihaan''s eight hours, only the six inside the window count in it');

select pg_temp.play('00000000-0000-4000-8000-0000000a1043', '00000000-0000-4000-8000-000000000216', 'Table 2', 8,
  '2026-10-22 10:00+05:30', '2026-10-22 15:00+05:30', '2026-10-22 15:30+05:30');
select is(pg_temp.in_window('00000000-0000-4000-8000-0000000a1043', '{"days": [4], "from": "14:00", "until": "20:00"}'), 3600::bigint, 'one of Kunal''s five hours is in the window');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-0000000a1043'), 5000::bigint, 'which is play in the window');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1042', '00000000-0000-4000-8000-0000000a1043'), null::bigint, 'but one hour in the window is not four, though he played five');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1043', '00000000-0000-4000-8000-0000000a1043'), 5000::bigint, 'which the promotion with no window counts');

-- Kavya: 100/200 at Table 2 from 12:00, moved to 50/100 at Table 1 at 16:00, until 02:00, an hour away.
-- 14 hours, 13 played. Table 2's 4 hours play 13,371 seconds, and its 2 in the window 6,685; Table 1's 10 hours play
-- 33,428, and its 4 in the window 13,371.
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
select private.weigh_hours_played('00000000-0000-4000-8000-0000000a1045');
select is((select h.o_played from private.visit_hours('00000000-0000-4000-8000-0000000a1045') h), 46799::bigint, 'Kavya plays 13,371 seconds at 100/200 and 33,428 at 50/100');
select is(pg_temp.in_window('00000000-0000-4000-8000-0000000a1045', '{"days": [4], "from": "14:00", "until": "20:00"}'), 20056::bigint, 'the window counts the 6,685 and 13,371 seconds she played inside it, at each table');
select is(pg_temp.in_window('00000000-0000-4000-8000-0000000a1045', '{"days": [4], "from": "14:00", "until": "20:00", "stakes": ["nlh_100_200"]}'), 6685::bigint,
  'and at 100/200 only the 6,685 played there, though she played longest at 50/100');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1042', '00000000-0000-4000-8000-0000000a1045'), 5000::bigint, 'her 5.57 hours played in the window earn the four-hour bonus');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1044', '00000000-0000-4000-8000-0000000a1045'), null::bigint, 'and her 1.85 hours at 100/200 in the window are not four');

select pg_temp.play('00000000-0000-4000-8000-0000000a1044', '00000000-0000-4000-8000-000000000213', 'Table 2', 6,
  '2026-10-21 14:00+05:30', '2026-10-21 20:00+05:30', '2026-10-21 20:30+05:30');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1041', '00000000-0000-4000-8000-0000000a1044'), null::bigint, 'Mihir''s Wednesday is outside Thursday''s window: nothing');
select is(pg_temp.given('00000000-0000-4000-8000-0000000c1043', '00000000-0000-4000-8000-0000000a1044'), 5000::bigint, 'while the promotion with no window gives');

select * from finish();
rollback;
