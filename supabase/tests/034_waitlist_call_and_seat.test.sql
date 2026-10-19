-- Call, seat and step away (#63). The seed puts Kabir (202), Naina (203) and Rohan (204) on 100/200;
-- Tables 2, 3 and 5 are open at 100/200, Table 4 is closed, and the hold is 20 minutes. 103 Aditya is
-- the floor; 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.entry(p_member uuid) returns uuid language sql as $$
  select id from public.waitlist_entry where member_id = p_member and table_type_id = pg_temp.type_id('nlh_100_200') and status = 'waiting';
$$;
grant execute on function pg_temp.type_id(text), pg_temp.table_id(text), pg_temp.entry(uuid) to authenticated;

-- Kabir, Rohan and Dev have finished the identity check; nobody reaches a seat without it.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', m.id, 'verified', 'digilocker', '1990-01-01', m.pan,
       '00000000-0000-4000-8000-000000000001/' || m.id || '/selfie.jpg', now()
from (values ('00000000-0000-4000-8000-000000000202'::uuid, 'ABCPK2022K'), ('00000000-0000-4000-8000-000000000204'::uuid, 'ABCPR2044R'),
             ('00000000-0000-4000-8000-000000000210'::uuid, 'ABCPD2100E')) as m (id, pan);

-- The seeded order, pinned: Kabir, Naina, Rohan.
update public.waitlist_entry set joined_at = now() - interval '30 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000202');
update public.waitlist_entry set joined_at = now() - interval '29 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000203');
update public.waitlist_entry set joined_at = now() - interval '28 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000204');

-- The floor calls Kabir to Table 3, seat 9.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select lives_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000202'), pg_temp.table_id('Table 3'), 9) $$,
  'the floor calls the first name to Table 3, seat 9');
select results_eq($$ select full_name, call_table_name, call_seat, hold_until = now() + interval '20 minutes'
                     from public.waitlist_board('00000000-0000-4000-8000-000000000001') where place = 1 and call_table_name is not null $$,
  $$ values ('Kabir Sethi'::text, 'Table 3'::text, 9, true) $$, 'who is held there for 20 minutes, on the floor''s list');
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000202'), pg_temp.table_id('Table 2'), 1) $$,
  '22023', null, 'a called member is not called again');
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000203'), pg_temp.table_id('Table 4'), 1) $$,
  '22023', null, 'nor anyone to a closed table');
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000203'), pg_temp.table_id('Table 1'), 1) $$,
  '22023', null, 'nor to another game''s table');
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000203'), pg_temp.table_id('Table 2'), 10) $$,
  '22023', null, 'nor to a seat the table does not have');
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000203'), pg_temp.table_id('Table 2'), 1) $$,
  'RVKYC', null, 'nor anyone without a finished identity check: they could not take the seat');
reset role;
select results_eq($$ select payload ->> 'table_name', (payload ->> 'seat')::integer, payload ? 'hold_until'
                     from public.outbox_event where event_type = 'waitlist.called'
                       and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000202' $$,
  $$ values ('Table 3'::text, 9, true) $$, 'the call sends the seat call: table, seat and hold, never a number');

-- Kabir is seated: off every list, and the seat is taken.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select results_eq($$ select call_table_name, call_seat from public.my_waitlist() $$, $$ values ('Table 3'::text, 9) $$,
  'the member sees the seat they are called to');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select lives_ok($$ select public.seat_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000202')) $$, 'the floor seats them');
select is((select full_name from public.waitlist_board('00000000-0000-4000-8000-000000000001') where place = 1
           and table_type_id = pg_temp.type_id('nlh_100_200')), 'Naina Kapoor', 'the place is off the list, and the next is first');
select throws_ok($$ select public.seat_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000203')) $$, '22023', null,
  'a member who has not been called is not seated');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select is_empty($$ select * from public.my_waitlist() $$, 'and the member is on no list');
reset role;
select ok(exists (select 1 from public.outbox_event where event_type = 'seat.taken'
                  and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000202'), 'seating emits seat.taken');

-- Naina steps away: her place is kept, and the floor cannot call her while she is away.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select lives_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000203'), true) $$, 'a member steps away');
select results_eq($$ select place, away_until = now() + interval '20 minutes' from public.my_waitlist() $$, $$ values (1, true) $$,
  'and keeps their place for 20 minutes');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000204", "role": "authenticated"}';
select throws_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000203'), false) $$, '42501', null,
  'another member cannot bring them back');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000203'), pg_temp.table_id('Table 2'), 1) $$,
  '22023', null, 'the floor does not call a member who is away');
reset role;

-- Away past the hold, the place goes; a minute short, it stays.
update public.waitlist_entry set stepped_away_at = now() - interval '19 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000203');
select private.expire_waitlist_holds();
select is((select status from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000203'
           and table_type_id = pg_temp.type_id('nlh_100_200')), 'waiting', 'a member away 19 minutes keeps their place');
update public.waitlist_entry set stepped_away_at = now() - interval '21 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000203');
select private.expire_waitlist_holds();
select is((select left_reason from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000203'
           and table_type_id = pg_temp.type_id('nlh_100_200')), 'stepped_away', 'one away 21 minutes loses it');

-- A call unanswered when its hold runs out rolls to the next name, for the same seat.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000210", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'Dev joins behind Rohan');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select lives_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000204'), pg_temp.table_id('Table 5'), 4) $$,
  'the floor calls Rohan to Table 5, seat 4');
reset role;
update public.waitlist_entry set hold_until = now() - interval '1 second' where id = pg_temp.entry('00000000-0000-4000-8000-000000000204');
select private.expire_waitlist_holds();
select is((select left_reason from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000204'
           and table_type_id = pg_temp.type_id('nlh_100_200')), 'missed', 'the unanswered call lets Rohan''s place go');
select results_eq($$ select ct.name, e.call_seat from public.waitlist_entry e join public.game_table ct on ct.id = e.call_table_id
                     where e.member_id = '00000000-0000-4000-8000-000000000210' and e.status = 'waiting' $$,
  $$ values ('Table 5'::text, 4) $$, 'and calls the next name, Dev, to the same seat');

-- While the venue is frozen nobody is called, by the floor or by the roll-on.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
update public.waitlist_entry set hold_until = now() - interval '1 second' where id = pg_temp.entry('00000000-0000-4000-8000-000000000210');
select private.expire_waitlist_holds();
select is((select count(*)::integer from public.waitlist_entry
           where table_type_id = pg_temp.type_id('nlh_100_200') and status = 'waiting' and called_at is not null), 0,
  'the roll-on calls nobody while the venue is frozen');

-- Only the floor calls, seats and skips.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
select throws_ok($$ select public.call_from_waitlist(gen_random_uuid(), pg_temp.table_id('Table 2'), 1) $$, '42501', null, 'a dealer calls nobody');
select throws_ok($$ select public.seat_from_waitlist(gen_random_uuid()) $$, '42501', null, 'nor seats anyone');
reset role;
select ok(exists (select 1 from cron.job where jobname = 'waitlist-holds'), 'pg_cron lets holds run out every minute');

select * from finish();
rollback;
