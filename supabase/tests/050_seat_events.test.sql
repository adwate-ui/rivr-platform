-- Seat events from the dealer tablet (#59). Tablet A is fixed to Table 3, where the floor (103) seats
-- Ishaan (211) at seat 9; Vihaan (212) sits at Table 1. 104 is a cashier; 106 Pema a dealer (staff).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor (56_floor.sql) is set aside, so this test builds its own: the seeded tablets leave
-- their tables, which ends Pema's down at Table 3 (private.end_tablet_downs).
delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', pg_temp.t('Table 3'));

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Table 3'), 9, '9000000211');
insert into ids select 'vihaan', public.seat_member(pg_temp.t('Table 1'), 2, '9000000212');

-- The tablet's seats, and a buy-in request for seat 9 (flow 3).
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select is((select count(*)::integer from public.tablet_seats()), 9, 'the tablet sees every seat at its table');
select results_eq($$ select seat, full_name, away_since is null, minimum_paise, pending_buy_in_paise from public.tablet_seats() where session_id is not null $$,
  $$ values (9, 'Ishaan Verma'::text, true, 1000000::bigint, null::bigint) $$, 'who sits there, and the table''s minimum');
insert into ids select 'request', public.request_buy_in((select id from ids where name = 'ishaan'), 1000000, '00000000-0000-4000-8000-0000000c5901');
select isnt((select id from ids where name = 'request'), null, 'the tablet asks the cage for ₹10,000 for seat 9');
select is((select pending_buy_in_paise from public.tablet_seats() where seat = 9), 1000000::bigint, 'and sees it waiting there');
select throws_ok($$ select public.request_buy_in((select id from ids where name = 'ishaan'), 2000000, '00000000-0000-4000-8000-0000000c5902') $$,
  'RVPND', null, 'a second request for the seat waits until the cage has decided the first');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select full_name, table_name, seat, amount_paise, photo_path from public.cage_queue('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Ishaan Verma'::text, 'Table 3'::text, 9, 1000000::bigint,
             '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000211/selfie.jpg'::text) $$,
  'and the request waits at the cage, with his KYC photo');

-- Away, back, and left.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select lives_ok($$ select public.set_seat_away((select id from ids where name = 'ishaan'), true) $$, 'the dealer marks Ishaan away');
select isnt((select away_since from public.tablet_seats() where seat = 9), null, 'his seat shows away');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt((select away_since from public.floor_seats('00000000-0000-4000-8000-000000000001') where seat = 9), null, 'on the live floor too');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select lives_ok($$ select public.set_seat_away((select id from ids where name = 'ishaan'), false) $$, 'and back');
select is((select away_since from public.tablet_seats() where seat = 9), null, 'his seat is his, present');

-- Only at its own table.
select throws_ok($$ select public.set_seat_away((select id from ids where name = 'vihaan'), true) $$, '42501', null,
  'the tablet marks no one away at another table');
select throws_ok($$ select public.end_seat((select id from ids where name = 'vihaan'), 'left') $$, '42501', null, 'nor lets them leave');
select throws_ok($$ select public.request_buy_in((select id from ids where name = 'vihaan'), 500000, gen_random_uuid()) $$, '42501', null,
  'nor asks the cage for their chips');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.set_seat_away((select id from ids where name = 'ishaan'), true) $$, '42501', null,
  'a dealer without the tablet marks no one away');
select throws_ok($$ select * from public.tablet_seats() $$, '42501', null, 'nor sees the tablet''s seats');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select lives_ok($$ select public.end_seat((select id from ids where name = 'ishaan'), 'left') $$, 'Player left');
select is_empty($$ select * from public.tablet_seats() where session_id is not null $$, 'and seat 9 is open');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.cage_queue('00000000-0000-4000-8000-000000000001') $$, 'his request leaves the cage''s queue');
reset role;
select is((select status from public.buy_in_request where id = (select id from ids where name = 'request')), 'withdrawn',
  'withdrawn, so it cannot be paid once he has gone');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.set_seat_away((select id from ids where name = 'ishaan'), true) $$, '22023', null,
  'a player who left is not away');
reset role;
select results_eq($$ select event_type, count(*)::integer from public.outbox_event where event_type in ('seat.away', 'seat.back', 'seat.left') group by event_type order by 1 $$,
  $$ values ('seat.away'::text, 1), ('seat.back', 1), ('seat.left', 1) $$, 'away, back and left are each emitted');

-- A frozen venue changes no seat; a revoked tablet changes nothing and sees nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan again', public.seat_member(pg_temp.t('Table 3'), 9, '9000000211');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.set_seat_away((select id from ids where name = 'ishaan again'), true) $$, 'RVFRZ', null,
  'while the venue is frozen, no one is marked away');
select throws_ok($$ select public.end_seat((select id from ids where name = 'ishaan again'), 'left') $$, 'RVFRZ', null, 'nor leaves');
reset role;
update public.device set revoked_at = now(), revoked_reason = 'Lost' where id = '00000000-0000-4000-8000-00000000d001';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.set_seat_away((select id from ids where name = 'ishaan again'), true) $$, '42501', null,
  'a revoked tablet marks no one away');
select throws_ok($$ select public.end_seat((select id from ids where name = 'ishaan again'), 'left') $$, '42501', null, 'nor lets them leave');
select throws_ok($$ select * from public.tablet_seats() $$, '42501', null, 'nor sees the seats');
reset role;

select * from finish();
rollback;
