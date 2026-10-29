-- Call, seat and step away (#63). The seed puts Kabir (202), Naina (203) and Rohan (204) on 100/200;
-- Tables 2, 3 and 5 are open at 100/200, Table 4 is closed, and the hold is 20 minutes. 103 Aditya is
-- the floor; 106 Pema a dealer. Ishaan (211) and Vihaan (212, a black card) have finished the check.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
-- A join from the app is a request the floor approves (#633); here each is approved as it is made.
create function pg_temp.approve_joins() returns void language sql security definer set search_path = '' as $$
  update public.waitlist_entry set approved_at = joined_at where approved_at is null;
$$;
grant execute on function pg_temp.approve_joins() to authenticated;
create function pg_temp.entry(p_member uuid) returns uuid language sql as $$
  select id from public.waitlist_entry where member_id = p_member and table_type_id = pg_temp.type_id('nlh_100_200') and status = 'waiting';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.type_id(text), pg_temp.table_id(text), pg_temp.entry(uuid), pg_temp.as_person(text) to authenticated;

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
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
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
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000204'), pg_temp.table_id('Table 3'), 9) $$,
  'RVHLD', null, 'nor anyone to a seat held for another call');
reset role;
select results_eq($$ select payload ->> 'table_name', (payload ->> 'seat')::integer, payload ? 'hold_until'
                     from public.outbox_event where event_type = 'waitlist.called'
                       and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000202' $$,
  $$ values ('Table 3'::text, 9, true) $$, 'the call sends the seat call: table, seat and hold, never a number');

-- Kabir is seated, while his hold lasts and the table is open: off every list, and the seat is taken.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select results_eq($$ select call_table_name, call_seat from public.my_waitlist() $$, $$ values ('Table 3'::text, 9) $$,
  'the member sees the seat they are called to');
reset role;
update public.waitlist_entry set hold_until = now() - interval '1 second' where id = pg_temp.entry('00000000-0000-4000-8000-000000000202');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000202')) $$, 'RVLAT', null,
  'a member is not seated once the hold has run out');
reset role;
update public.waitlist_entry set hold_until = now() + interval '20 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000202');
update public.game_table set is_open = false where id = pg_temp.table_id('Table 3');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000202')) $$, '22023', null,
  'nor at a table closed since the call');
reset role;
update public.game_table set is_open = true where id = pg_temp.table_id('Table 3');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000202')) $$, 'the floor seats them');
select is((select full_name from public.waitlist_board('00000000-0000-4000-8000-000000000001') where place = 1
           and table_type_id = pg_temp.type_id('nlh_100_200')), 'Naina Kapoor', 'the place is off the list, and the next is first');
select throws_ok($$ select public.seat_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000203')) $$, '22023', null,
  'a member who has not been called is not seated');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is_empty($$ select * from public.my_waitlist() $$, 'and the member is on no list');
reset role;
select ok(exists (select 1 from public.outbox_event where event_type = 'seat.taken'
                  and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000202'), 'seating emits seat.taken');

-- Naina steps away: her place is kept, and the floor cannot call her while she is away.
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select lives_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000203'), true) $$, 'a member steps away');
select results_eq($$ select place, away_until = now() + interval '20 minutes' from public.my_waitlist() $$, $$ values (1, true) $$,
  'and keeps their place for 20 minutes');
select pg_temp.as_person('00000000-0000-4000-8000-000000000204');
select throws_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000203'), false) $$, '42501', null,
  'another member cannot bring them back');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000203'), pg_temp.table_id('Table 2'), 1) $$,
  '22023', null, 'the floor does not call a member who is away');
reset role;

-- Time away is counted once per place: away 5 minutes and back leaves 15.
update public.waitlist_entry set stepped_away_at = now() - interval '5 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000203');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select lives_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000203'), false) $$, 'back after 5 minutes');
select lives_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000203'), true) $$, 'and away again');
select results_eq($$ select away_until = now() + interval '15 minutes' from public.my_waitlist() $$, $$ values (true) $$,
  'with 15 minutes left, not a fresh 20');
reset role;
update public.waitlist_entry set stepped_away_at = now() - interval '14 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000203');
select private.expire_waitlist_holds();
select is((select status from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000203'
           and table_type_id = pg_temp.type_id('nlh_100_200')), 'waiting', 'away 14 more minutes, the place is kept');
update public.waitlist_entry set stepped_away_at = now() - interval '16 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000203');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select throws_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000203'), false) $$, 'RVLAT', null,
  'away 16 more, the member cannot come back to it');
reset role;
select private.expire_waitlist_holds();
select is((select left_reason from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000203'
           and table_type_id = pg_temp.type_id('nlh_100_200')), 'stepped_away', 'and the place goes');
update public.waitlist_entry set away_used = interval '20 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000204');
select pg_temp.as_person('00000000-0000-4000-8000-000000000204');
select throws_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000204'), true) $$, 'RVAWY', null,
  'a place with no time away left cannot step away');
reset role;
update public.waitlist_entry set away_used = interval '0' where id = pg_temp.entry('00000000-0000-4000-8000-000000000204');

-- A call unanswered when its hold runs out rolls to the next name, for the same seat.
select pg_temp.as_person('00000000-0000-4000-8000-000000000210');
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'Dev joins behind Rohan');
select pg_temp.approve_joins();
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
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

-- A called member who leaves rolls the seat on too; the floor's Skip ends a call and rolls it on.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'Ishaan joins behind Dev');
select pg_temp.approve_joins();
select pg_temp.as_person('00000000-0000-4000-8000-000000000210');
select lives_ok($$ select public.leave_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000210')) $$, 'Dev leaves while called');
reset role;
select results_eq($$ select ct.name, e.call_seat from public.waitlist_entry e join public.game_table ct on ct.id = e.call_table_id
                     where e.member_id = '00000000-0000-4000-8000-000000000211' and e.status = 'waiting' $$,
  $$ values ('Table 5'::text, 4) $$, 'and Ishaan is called to the seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000211'), true) $$, '22023', null,
  'a called member cannot step away themselves');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000211'), true) $$, 'the floor skips Ishaan');
reset role;
select results_eq($$ select called_at is null, stepped_away_at = now() from public.waitlist_entry
                     where member_id = '00000000-0000-4000-8000-000000000211' and status = 'waiting' $$,
  $$ values (true, true) $$, 'which ends the call and keeps his place as away');
select is((select count(*)::integer from public.waitlist_entry
           where table_type_id = pg_temp.type_id('nlh_100_200') and status = 'waiting' and called_at is not null), 0,
  'with nobody else waiting, nobody is called');

-- A frozen member is not called.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000211'), false) $$, 'the floor brings Ishaan back');
reset role;
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000211', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000211'), pg_temp.table_id('Table 5'), 4) $$,
  'RVMBR', null, 'the floor cannot call a frozen member');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'waitlist.called'
           and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000211'), 1, 'and no seat call goes to them');

-- While the venue is frozen a hold pauses: nobody loses a place, and nobody is called.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'Vihaan joins');
select pg_temp.approve_joins();
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000212'), pg_temp.table_id('Table 5'), 4) $$,
  'and is called to Table 5, seat 4');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
update public.waitlist_entry set hold_until = now() - interval '1 second' where id = pg_temp.entry('00000000-0000-4000-8000-000000000212');
select private.expire_waitlist_holds();
select results_eq($$ select called_at is not null, hold_until = now() + interval '59 seconds' from public.waitlist_entry
                     where member_id = '00000000-0000-4000-8000-000000000212' and status = 'waiting' $$,
  $$ values (true, true) $$, 'a frozen minute moves the hold on a minute: Vihaan is still called');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000212'), true) $$, 'RVFRZ', null,
  'and a member cannot step away while the venue is frozen');

-- Only the floor calls, seats and skips.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000211'), pg_temp.table_id('Table 2'), 1) $$,
  '42501', null, 'a dealer calls nobody');
select throws_ok($$ select public.seat_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000212')) $$, '42501', null, 'nor seats anyone');
select throws_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000212'), true) $$, '42501', null, 'nor skips anyone');
reset role;
select ok(exists (select 1 from cron.job where jobname = 'waitlist-holds'), 'pg_cron lets holds run out every minute');

select * from finish();
rollback;
