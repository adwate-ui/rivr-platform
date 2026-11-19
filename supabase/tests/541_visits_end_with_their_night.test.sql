-- A night's visit ends with it (#1096, #1095). The 11:10 sweep closes an earlier night's visit with nothing open, even one
-- whose last seat ended a little after 06:00; a seat forgotten overnight and let go after 08:00 closes its visit at 06:00 at
-- once; an end at exactly 06:00 is last night's on the door's and the top-ups' lists. 216 Kunal, 217 Neel, 213 Mihir,
-- 214 Yash, 211 Ishaan, 212 Vihaan and 218 Meera are members; 103 Aditya the floor.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.table_id(text) to authenticated;
create temp table night on commit drop as select private.tonight_began(now()) as began;
grant select on night to authenticated;
create temp table sess (who text, id uuid) on commit drop;
grant select on sess to authenticated;

-- An earlier night's visit and its seat, by hand, its 30-minute call time set as he sat down and long met: p_closed null
-- leaves the seat open.
create function pg_temp.came(p_member text, p_visit text, p_opened interval, p_seat integer, p_seated interval, p_closed timestamptz)
returns void language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at)
  select ('00000000-0000-4000-8000-0000000d' || p_visit)::uuid, '00000000-0000-4000-8000-000000000001',
         ('00000000-0000-4000-8000-000000000' || p_member)::uuid, began - p_opened from night;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason,
                                   call_time_minutes, call_time_set_at)
  select '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || p_member)::uuid,
         ('00000000-0000-4000-8000-0000000d' || p_visit)::uuid, pg_temp.table_id('Table 2'), p_seat,
         began - p_seated, began - p_seated, p_closed, case when p_closed is not null then 'left' end, 30, began - p_seated from night;
  insert into sess select p_member, id from public.seat_session where visit_id = ('00000000-0000-4000-8000-0000000d' || p_visit)::uuid;
$$;

-- The morning sweep (#1095). Kunal played on past 06:00 last night and nobody checked him out; Neel is still seated from
-- last night; Mihir checked in as tonight began.
select pg_temp.came('216', '2411', interval '8 hours', 7, interval '7 hours', (select least(began + interval '30 minutes', now()) from night));
select pg_temp.came('217', '2412', interval '5 hours', 8, interval '4 hours', null);
insert into public.visit (id, venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-0000000d2413', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', began from night;
select lives_ok($$ select private.close_stale_visits() $$, 'the morning sweep runs');
select results_eq($$ select close_reason, closed_at = (select least(began + interval '30 minutes', now()) from night) from public.visit
                     where id = '00000000-0000-4000-8000-0000000d2411' $$,
  $$ values ('end_of_day'::text, true) $$, 'a visit from last night with nothing open ends at its last seat''s end, though that was after 06:00');
select is((select closed_at from public.visit where id = '00000000-0000-4000-8000-0000000d2412'), null, 'one with a seat still open stays open');
select is((select closed_at from public.visit where id = '00000000-0000-4000-8000-0000000d2413'), null, 'tonight''s visit stays open');

-- A seat forgotten overnight (#1096). The floor lets Yash go; Ishaan leaves from the app. After 08:00 each seat ends at
-- 06:00 and its visit with it, at once; before 08:00 the seat ends now and the visit stays for the rest of the morning.
select pg_temp.came('214', '2414', interval '6 hours', 9, interval '5 hours', null);
select pg_temp.came('211', '2415', interval '6 hours', 10, interval '5 hours', null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.end_seat((select id from sess where who = '214'), 'left') $$, 'the floor lets Yash go');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.leave_my_seat(), 'left', 'Ishaan leaves from the app');
reset role;
select results_eq(
  $$ select right(v.id::text, 4), v.closed_at is not distinct from (case when s.ended_at < now() then n.began end),
            v.close_reason is not distinct from (case when s.ended_at < now() then 'end_of_day' end)
     from public.visit v join public.seat_session s on s.visit_id = v.id, night n
     where v.id in ('00000000-0000-4000-8000-0000000d2414', '00000000-0000-4000-8000-0000000d2415') order by 1 $$,
  $$ values ('2414', true, true), ('2415', true, true) $$,
  'a visit ends with its seat stamped at 06:00, by the floor or the app, and stays open while the seat ends now');

-- Exactly 06:00 is last night's (#1096). Vihaan's visit closed as tonight began; tonight he joined a list and left it, so he
-- never came in tonight. Meera's top-up was open when her seat was stamped at 06:00: last night's, not tonight's.
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', began - interval '7 hours', began, 'end_of_day' from night;
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, joined_at, status, left_at, left_reason, idempotency_key)
select g.venue_id, '00000000-0000-4000-8000-000000000212', g.table_type_id, g.id, n.began, 'left', n.began, 'left', gen_random_uuid()
from public.game_table g, night n where g.id = pg_temp.table_id('Table 2');
select pg_temp.came('218', '2416', interval '6 hours', 6, interval '5 hours', null);
insert into public.top_up_request (venue_id, member_id, session_id, table_id, seat, requested_at)
select s.venue_id, s.member_id, s.id, s.table_id, s.seat, n.began - interval '1 hour' from public.seat_session s, night n
where s.id = (select id from sess where who = '218');
update public.seat_session set ended_at = (select began from night), end_reason = 'left' where id = (select id from sess where who = '218');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select status from public.todays_players('00000000-0000-4000-8000-000000000001') where full_name = 'Vihaan Kapoor'), 'never_arrived',
  'a visit that closed as tonight began does not count as tonight''s at the door');
select is((select count(*)::integer from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') where full_name = 'Meera Iyer'), 0,
  'a top-up whose seat ended as tonight began is not on tonight''s list');
reset role;

select * from finish();
rollback;
