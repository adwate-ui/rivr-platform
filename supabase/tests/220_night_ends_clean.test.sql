-- Every night ends clean (B5 of the Fix Tracker). Last night's visit is closed before tonight's opens (end_of_day, at
-- its last seat's end), at check-in and at the door, and its waiting places from last night go with it while tonight's
-- stay. A place from last night is on no list. A seat forgotten overnight ends at its night's end. Seating a member
-- nobody checked in opens their visit as check-in does. A down from last night is no one's tonight. 216 Nikhil, 217 Neel,
-- 213 Mihir, 214 Yash and 290 Kavya are members; 103 Aditya the floor.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.table_id(text) to authenticated;
create function pg_temp.type_of(p_name text) returns uuid language sql as $$
  select table_type_id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create temp table night as select private.tonight_began(now()) as began;
grant select on night to authenticated;

-- When a seat ends: a seat from last night let go of well into today ends at last night's end; let go of just after it,
-- or seated tonight, it ends now.
select is(private.seat_end_stamp(began - interval '4 hours', began + interval '10 hours'), began, 'a seat forgotten overnight ends at its night''s end')
from night;
select is(private.seat_end_stamp(began - interval '4 hours', began + interval '20 minutes'), began + interval '20 minutes',
  'a player who stayed just past 06:00 is not cut short') from night;
select is(private.seat_end_stamp(began + interval '1 hour', began + interval '10 hours'), began + interval '10 hours', 'a seat from tonight ends now')
from night;

-- Nikhil came last night, played until two hours before it ended, and never checked out. Tonight he joined a list before
-- the desk checked him in.
insert into public.visit (id, venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-0000000d2201', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', began - interval '8 hours' from night;
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-0000000d2201', pg_temp.table_id('Table 2'), 7,
       began - interval '7 hours', began - interval '7 hours', began - interval '2 hours', 'left' from night;
insert into public.waitlist_entry (id, venue_id, member_id, table_type_id, joined_at, approved_at, idempotency_key)
values ('00000000-0000-4000-8000-0000000e2202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', pg_temp.type_of('Private Room'),
        now(), now(), gen_random_uuid());

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table tonight as select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216') as visit_id;
reset role;
select isnt((select visit_id from tonight), '00000000-0000-4000-8000-0000000d2201'::uuid, 'tonight''s check-in opens a new visit, not last night''s');
select results_eq($$ select close_reason, closed_at = (select began - interval '2 hours' from night) from public.visit where id = '00000000-0000-4000-8000-0000000d2201' $$,
  $$ values ('end_of_day'::text, true) $$, 'last night''s is closed at the end of day, when its last seat ended');
select is((select status from public.waitlist_entry where id = '00000000-0000-4000-8000-0000000e2202'), 'waiting',
  'tonight''s waiting place stays, so he can still be seated from it');

-- Yash never checked out last night either, and kept a place on a list: it is on no list tonight, and goes when he checks in.
insert into public.visit (venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', began - interval '5 hours' from night;
insert into public.waitlist_entry (id, venue_id, member_id, table_type_id, joined_at, approved_at, idempotency_key)
select '00000000-0000-4000-8000-0000000e2203', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', pg_temp.type_of('Table 2'),
       began - interval '3 hours', began - interval '3 hours', gen_random_uuid() from night;
select ok(not exists (select 1 from private.ranked_waitlist(array[pg_temp.type_of('Table 2')]) r where r.entry_id = '00000000-0000-4000-8000-0000000e2203'),
  'a waiting place from last night is on no list tonight, so nobody at home is called');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214'), null, 'the desk checks Yash in');
reset role;
select is((select status from public.waitlist_entry where id = '00000000-0000-4000-8000-0000000e2203'), 'left', 'and last night''s place goes with last night''s visit');

-- Ishaan played on past 06:00 and left his seat after it: his visit is tonight's, not a stale one.
insert into public.visit (id, venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-0000000d2204', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', began - interval '1 hour' from night;
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-0000000d2204', pg_temp.table_id('Table 2'), 9,
       began - interval '50 minutes', began - interval '50 minutes', began + interval '30 minutes', 'left' from night;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211'), '00000000-0000-4000-8000-0000000d2204'::uuid,
  'a member who played past 06:00 keeps the visit he is in');
reset role;

-- Neel sat down last night and nobody let him go: his seat ends as seat_end_stamp says.
insert into public.visit (id, venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-0000000d2202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', began - interval '5 hours' from night;
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-0000000c2202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', '00000000-0000-4000-8000-0000000d2202',
       pg_temp.table_id('Table 2'), 8, began - interval '4 hours', began - interval '4 hours' from night;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.end_seat('00000000-0000-4000-8000-0000000c2202', 'left') $$, 'the floor lets Neel''s seat go tonight');
reset role;
select is((select ended_at from public.seat_session where id = '00000000-0000-4000-8000-0000000c2202'),
  (select private.seat_end_stamp(began - interval '4 hours', now()) from night), 'and it ends as its night says');

-- Mihir, never checked in, is seated: his visit opens as check-in does, with the check-in welcome.
insert into public.promotion (id, venue_id, name, status, starts_at) values
  ('00000000-0000-4000-8000-0000000c2203', '00000000-0000-4000-8000-000000000001', 'Welcome points', 'live', now() - interval '1 day');
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c2203', 'check_in', '{}', '{"kind": "points", "points": 50}');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member(pg_temp.table_id('Table 3'), 9, '9000000213'), null, 'the floor seats Mihir, never checked in');
reset role;
select ok(exists (select 1 from public.promotion_grant g where g.promotion_id = '00000000-0000-4000-8000-0000000c2203'
                  and g.member_id = '00000000-0000-4000-8000-000000000213'), 'and he gets the check-in welcome, as a check-in would');

-- Kavya never left by the door last night: tonight's scan checks her in, not out.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e221', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000002211');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d221', '00000000-0000-4000-8000-000000000001', 'door', 'Front door', '00000000-0000-4000-8000-00000000e221');
insert into public.visit (id, venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-0000000d2203', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000290', began - interval '6 hours' from night;
create temp table card (code text);
grant select, insert on card to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000290');
insert into card select c.code from public.my_membership_card() c;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e221');
select results_eq($$ select action from public.door_scan((select code from card)) $$, $$ values ('in'::text) $$, 'tonight''s scan checks Kavya in');
reset role;
select is((select close_reason from public.visit where id = '00000000-0000-4000-8000-0000000d2203'), 'end_of_day', 'and last night''s visit closed at the end of day');

-- A down from last night is no one's down tonight; tonight's is.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e220', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000002201');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d220', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet N', '00000000-0000-4000-8000-00000000e220');
insert into public.tablet_assignment (device_id, venue_id, table_id) values
  ('00000000-0000-4000-8000-00000000d220', '00000000-0000-4000-8000-000000000001', pg_temp.table_id('Table 5'));
insert into public.staff (id, venue_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-00000000f220', '00000000-0000-4000-8000-000000000001', 'Dorje Sherpa', 'Dealer', 'dealer');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at)
select '00000000-0000-4000-8000-0000000a2201', '00000000-0000-4000-8000-000000000001', pg_temp.table_id('Table 5'), '00000000-0000-4000-8000-00000000f220',
       '00000000-0000-4000-8000-00000000d220', began - interval '3 hours' from night;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e220');
select is_empty($$ select * from public.current_down() $$, 'a down from last night is no one''s tonight: the tablet asks for a sign-in');
reset role;
update public.dealer_down set started_at = now() where id = '00000000-0000-4000-8000-0000000a2201';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e220');
select results_eq($$ select full_name from public.current_down() $$, $$ values ('Dorje Sherpa'::text) $$, 'a down from tonight is the tablet''s');
reset role;

select * from finish();
rollback;
