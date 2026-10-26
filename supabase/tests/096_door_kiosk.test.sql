-- The door kiosk (#331; decision 0164). A door kiosk scans a member's card: the first scan checks them in
-- (the visit names the kiosk), the next checks them out, and a scan just after a visit closed says
-- goodbye and opens nothing. The front desk's rules hold: a member still seated, or owing call time, is
-- refused. A check-in weighs the check-in promotions; a close weighs the hours-played ones with the
-- hours played that visit, so four hours at the tables earn the four-hour bonus. A revoked kiosk is
-- refused at once, and a kiosk does nothing else. Kavya Rao (290) is a member and Farhan Ali (190) the
-- front desk, from 14_people_c.sql; 103 Aditya the floor manager; 213 Mihir and 212 Vihaan members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- A member's card code for now, as the app shows it: made the first time they ask.
create temp table code (member text primary key, code text);
grant select, insert on code to authenticated;
create function pg_temp.card(p_member text) returns text language sql as $$ select code from code where member = p_member; $$;
grant execute on function pg_temp.card(text) to authenticated;

-- A door kiosk at the club, one revoked, and the seed's seats set aside.
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e961', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000961'),
  ('00000000-0000-4000-8000-00000000e962', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000962');
insert into public.device (id, venue_id, kind, name, auth_user_id, revoked_at, revoked_reason) values
  ('00000000-0000-4000-8000-00000000d961', '00000000-0000-4000-8000-000000000001', 'door', 'Front door', '00000000-0000-4000-8000-00000000e961', null, null),
  ('00000000-0000-4000-8000-00000000d962', '00000000-0000-4000-8000-000000000001', 'door', 'Old door', '00000000-0000-4000-8000-00000000e962', now(), 'Lost');

-- The four-hour bonus published, and a check-in welcome of 50 points.
update public.promotion set status = 'live', starts_at = now() - interval '1 day'
where venue_id = '00000000-0000-4000-8000-000000000001' and template_key = 'hours_bonus';
insert into public.promotion (id, venue_id, name, status, starts_at) values
  ('00000000-0000-4000-8000-0000000c9601', '00000000-0000-4000-8000-000000000001', 'Welcome points', 'live', now() - interval '1 day');
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c9601', 'check_in', '{}', '{"kind": "points", "points": 50}');

select pg_temp.as_person('00000000-0000-4000-8000-000000000290');
insert into code select 'kavya', c.code from public.my_membership_card() c;
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into code select 'mihir', c.code from public.my_membership_card() c;
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
insert into code select 'vihaan', c.code from public.my_membership_card() c;

-- In, out, and goodbye.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');
select results_eq($$ select * from public.door_scan(pg_temp.card('kavya')) $$, $$ values ('in'::text, 'Kavya'::text, 0::bigint) $$,
  'the door kiosk checks Kavya in');
reset role;
select results_eq($$ select opened_by_device_id, opened_by_staff_id from public.visit
                     where member_id = '00000000-0000-4000-8000-000000000290' and closed_at is null $$,
  $$ values ('00000000-0000-4000-8000-00000000d961'::uuid, null::uuid) $$, 'her visit names the kiosk');
select is((select count(*)::integer from public.promotion_grant
           where promotion_id = '00000000-0000-4000-8000-0000000c9601' and member_id = '00000000-0000-4000-8000-000000000290'), 1,
  'and her check-in earns the welcome points');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');
select results_eq($$ select * from public.door_scan(pg_temp.card('kavya')) $$, $$ values ('in'::text, 'Kavya'::text, 0::bigint) $$,
  'her card scanned again as she walks in only says she is in');
reset role;
select is((select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000290' and closed_at is null), 1,
  'her visit stays open');
update public.visit set opened_at = opened_at - interval '3 minutes' where member_id = '00000000-0000-4000-8000-000000000290';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');
select results_eq($$ select * from public.door_scan(pg_temp.card('kavya')) $$, $$ values ('out'::text, 'Kavya'::text, 0::bigint) $$,
  'past the first two minutes, her next scan checks her out');
select results_eq($$ select * from public.door_scan(pg_temp.card('kavya')) $$, $$ values ('gone'::text, 'Kavya'::text, 0::bigint) $$,
  'a scan just after says goodbye');
reset role;
select is((select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000290'), 1, 'and opens no visit');
select is((select close_reason from public.visit where member_id = '00000000-0000-4000-8000-000000000290'), 'door', 'her visit closed at the door');
update public.visit set opened_at = opened_at - interval '1 hour', closed_at = closed_at - interval '11 minutes'
where member_id = '00000000-0000-4000-8000-000000000290';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');
select results_eq($$ select action from public.door_scan(pg_temp.card('kavya')) $$, $$ values ('in'::text) $$,
  'ten minutes on, she is checked in again');
reset role;
select is((select count(*)::integer from public.promotion_grant
           where promotion_id = '00000000-0000-4000-8000-0000000c9601' and member_id = '00000000-0000-4000-8000-000000000290'), 1,
  'but the welcome points come once a club day, however often she scans in');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');

-- Four and a half hours at Table 2: the scan out earns the four-hour bonus.
reset role;
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a9601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '5 hours');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a9601', g.id, 6,
       now() - interval '270 minutes', now() - interval '270 minutes', now() - interval '1 minute', 'left'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');
select results_eq($$ select action, first_name, played_seconds between 16130 and 16140 from public.door_scan(pg_temp.card('mihir')) $$,
  $$ values ('out'::text, 'Mihir'::text, true) $$, 'Mihir scans out with four and a half hours played');
reset role;
select results_eq($$ select g.cost_paise, g.trigger from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
                     where p.template_key = 'hours_bonus' and g.member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values (100000::bigint, 'hours_played'::text) $$, 'and the four-hour bonus gives him ₹1,000');
select lives_ok($$ select private.weigh_hours_played('00000000-0000-4000-8000-0000000a9601') $$, 'the close weighed again, as a replay would');
select is((select count(*)::integer from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
           where p.template_key = 'hours_bonus' and g.member_id = '00000000-0000-4000-8000-000000000213'), 1, 'gives nothing more');

-- A visit closed at the cage pays it too: Kunal's four hours at Table 3, closed by a final cash-out.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a9602', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', now() - interval '5 hours');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-0000000a9602', g.id, 6,
       now() - interval '245 minutes', now() - interval '245 minutes', now() - interval '1 minute', 'left'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';
select is(private.close_visit('00000000-0000-4000-8000-000000000216', now(), 'cash_out'), '00000000-0000-4000-8000-0000000a9602'::uuid,
  'Kunal''s visit closes at the cage');
select is((select count(*)::integer from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
           where p.template_key = 'hours_bonus' and g.member_id = '00000000-0000-4000-8000-000000000216'), 1,
  'and his four hours earn the bonus as a door close would');

-- The front desk's rules hold at the kiosk.
insert into public.visit (venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', now() - interval '1 hour');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', v.id, g.id, 7, now() - interval '10 minutes', now() - interval '10 minutes'
from public.game_table g, public.visit v
where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2' and v.member_id = '00000000-0000-4000-8000-000000000212' and v.closed_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');
select throws_ok($$ select * from public.door_scan(pg_temp.card('vihaan')) $$, 'RVSTD', null, 'Vihaan, still seated, is sent to the floor or the cage');
reset role;
update public.seat_session set ended_at = now(), end_reason = 'left' where member_id = '00000000-0000-4000-8000-000000000212' and ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');
select throws_ok($$ select * from public.door_scan(pg_temp.card('vihaan')) $$, 'RVCTS', null, 'and, gone from his seat early, owes call time');
select throws_ok($$ select * from public.door_scan('not-a-code') $$, 'RVCRD', null, 'a code that is not a card''s is refused');

-- A revoked kiosk, and anyone else, cannot scan.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e962');
select throws_ok($$ select * from public.door_scan(pg_temp.card('kavya')) $$, '42501', null, 'a revoked kiosk is refused at once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select * from public.door_scan(pg_temp.card('kavya')) $$, '42501', null, 'the front desk checks in on the console, not as a kiosk');

-- The kiosk does nothing else.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e961');
select throws_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216') $$, '42501', null,
  'the kiosk checks nobody in by id');
select throws_ok($$ select public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000216') $$, '42501', null, 'nor by number');
select throws_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000290') $$, '42501', null,
  'nor checks anyone out but by their card');
select is_empty($$ select * from public.member $$, 'it reads no member');
select is_empty($$ select * from public.visit $$, 'and no visit');
select is_empty($$ select * from public.floor_seats('00000000-0000-4000-8000-000000000001') $$, 'and nobody''s seat');
select is_empty($$ select * from public.dealer_down $$, 'nor the dealers'' downs');

-- Door kiosks pair as tablets do; the front desk still checks in as before.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select length(code) = 6 from public.start_device_pairing('00000000-0000-4000-8000-00000000d961')), 'the floor manager pairs a door kiosk');
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select lives_ok($$ select public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000216') $$, 'the front desk checks Kunal in');
reset role;
select ok((select opened_by_device_id is null and opened_by_staff_id is not null from public.visit
           where member_id = '00000000-0000-4000-8000-000000000216' and closed_at is null), 'his visit names the front desk, no kiosk');

select * from finish();
rollback;
