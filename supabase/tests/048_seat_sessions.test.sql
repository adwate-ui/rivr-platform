-- Seat sessions (#77). 211 Ishaan, 212 Vihaan and 213 Mihir have finished their identity check (seed);
-- 204 Rohan has not. 103 Aditya is the floor (waitlist.manage, floor.manage, members.read); 104 is a
-- cashier (members.read); 106 Pema is a dealer. Table 4 is closed; Tables 2 and 3 are 100/200, Table 1 50/100.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;

-- Seating starts a session inside a visit.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table ishaan as select public.seat_member(pg_temp.t('Table 3'), 4, '9000000211') as session;
grant select on ishaan to authenticated;
select results_eq($$ select full_name, seat, must_move_order from public.floor_seats('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Ishaan Verma'::text, 4, null::integer) $$, 'the floor seats Ishaan at Table 3, seat 4');
select is((select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null), 1,
  'straight to the table: his visit opens with the seat');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 3'), 4, '9000000212') $$, 'RVOCC', null, 'one player per seat');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 2'), 1, '9000000211') $$, 'RVSTD', null, 'one seat per player: move him instead');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 4'), 1, '9000000212') $$, '22023', null, 'never at a closed table');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 3'), 10, '9000000212') $$, '22023', null, 'nor in a seat it does not have');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 3'), 5, '9000000204') $$, 'RVKYC', null, 'nor without a finished identity check');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select isnt(public.take_break(1), null, 'Mihir takes a break');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 3'), 5, '9000000213') $$, 'RVBRK', null, 'nor on a break');

-- A move keeps the session, so call time runs on; a must-move table's players move up in order.
create temp table started as select started_at from public.seat_session where id = (select session from ishaan);
select lives_ok($$ select public.move_seat((select session from ishaan), pg_temp.t('Table 2'), 5) $$, 'Ishaan moves to Table 2, seat 5');
select results_eq($$ select table_id, seat, started_at from public.seat_session where id = (select session from ishaan) $$,
  $$ select pg_temp.t('Table 2'), 5, (select started_at from started) $$, 'the same session, still started when he sat down');
select is((select count(*)::integer from public.seat_move), 1, 'and the move is kept');
select throws_ok($$ select public.set_must_move(pg_temp.t('Table 2'), pg_temp.t('Table 1')) $$, '22023', null,
  'a must-move table feeds a main table of its own game');
select lives_ok($$ select public.set_must_move(pg_temp.t('Table 2'), pg_temp.t('Table 3')) $$, 'Table 2 feeds Table 3');
select isnt(public.seat_member(pg_temp.t('Table 2'), 6, '9000000212'), null, 'Vihaan sits at Table 2');
-- One transaction gives every row the same time; Ishaan moved there a minute before Vihaan sat down.
reset role;
update public.seat_session set started_at = started_at - interval '2 minutes', seated_here_at = seated_here_at - interval '1 minute'
where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select full_name, must_move_order from public.floor_seats('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Ishaan Verma'::text, 1), ('Vihaan Kapoor', 2) $$, 'the must-move list: Ishaan sat down there first');

-- Tables close only empty.
select throws_ok($$ select public.set_table_open(pg_temp.t('Table 2'), false) $$, 'RVSTD', null, 'a table with players stays open');
select throws_ok($$ select public.end_seat((select session from ishaan), 'gone') $$, '22023', null, 'a player leaves, or is away for good');
select lives_ok($$ select public.end_seat(s.id, 'left') from public.seat_session s where s.table_id = pg_temp.t('Table 2') and s.ended_at is null $$,
  'both leave Table 2');
select lives_ok($$ select public.set_must_move(pg_temp.t('Table 2'), null) $$, 'Table 2 is a table of its own again');
select lives_ok($$ select public.set_table_open(pg_temp.t('Table 2'), false) $$, 'and, empty, it closes');
select is((select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null), 1,
  'leaving the table leaves the visit open');

-- Seating from the waitlist starts the session in the same visit.
reset role;
create temp table entry (id uuid);
grant select, insert on entry to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into entry select public.join_waitlist((select table_type_id from public.game_table where id = pg_temp.t('Table 3')), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.call_from_waitlist((select id from entry), pg_temp.t('Table 3'), 7) $$, 'the floor calls Ishaan to Table 3, seat 7');
select lives_ok($$ select public.seat_from_waitlist((select id from entry)) $$, 'and seats him');
select results_eq($$ select seat, visit_id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null $$,
  $$ select 7, v.id from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000211' and v.closed_at is null $$,
  'his new session sits in the visit he is already in');

-- Only the floor seats; staff who read members see the seat map; members see their own sessions.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 3'), 1, '9000000212') $$, '42501', null, 'a dealer does not seat players');
select throws_ok($$ select public.set_table_open(pg_temp.t('Table 2'), true) $$, '42501', null, 'nor opens tables');
select is_empty($$ select * from public.floor_seats('00000000-0000-4000-8000-000000000001') $$, 'nor sees the seat map');
select is_empty($$ select * from public.seat_session $$, 'nor the sessions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.floor_seats('00000000-0000-4000-8000-000000000001')), 1, 'a cashier sees who sits where');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select is((select count(*)::integer from public.seat_session), 1, 'Vihaan sees his own session');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 3'), 1, '9000000212') $$, '42501', null, 'and seats no one');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'seat.taken'), 3, 'seat.taken for each seating');
select is((select count(*)::integer from public.outbox_event where event_type = 'seat.moved'), 1, 'seat.moved for the move');

select * from finish();
rollback;
