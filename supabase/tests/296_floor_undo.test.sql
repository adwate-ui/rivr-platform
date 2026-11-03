-- Undo on the Live floor (decision 0447): each change the floor makes is taken back by a compensating function, for two
-- minutes, by staff who may make it, never while frozen, and never once something has moved on. At the club's Table 5:
-- Ishaan (211), Vihaan (212), Mihir (213), Yash (214), Ritika (215). 103 is a floor manager (admin), 108 a host, 106 a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.table5(p_venue text default '00000000-0000-4000-8000-000000000001') returns uuid language sql as $$
  select id from public.game_table where name = 'Table 5' and venue_id = p_venue::uuid;
$$;
create function pg_temp.seated(p_member text) returns public.seat_session language sql as $$
  select * from public.seat_session where member_id = p_member::uuid and ended_at is null;
$$;
create function pg_temp.seat(p_number bigint, p_seat integer, p_venue text default '00000000-0000-4000-8000-000000000001') returns uuid language sql as $$
  select public.seat_member(pg_temp.table5(p_venue), p_seat, p_member_number => p_number, p_call_minutes => 180);
$$;
create function pg_temp.ago(p_minutes integer) returns timestamptz language sql as $$ select now() - make_interval(mins => p_minutes); $$;
grant execute on function pg_temp.as_person(text), pg_temp.table5(text), pg_temp.seated(text), pg_temp.seat(bigint, integer, text), pg_temp.ago(integer)
  to authenticated;

-- Grants: nobody signed out undoes anything.
set local role anon;
select throws_ok($$ select public.undo_seat(gen_random_uuid()) $$, '42501', null, 'anon: no undo_seat');
select throws_ok($$ select public.undo_leave(gen_random_uuid()) $$, '42501', null, 'anon: no undo_leave');
select throws_ok($$ select public.undo_call_time(gen_random_uuid()) $$, '42501', null, 'anon: no undo_call_time');
select throws_ok($$ select public.undo_top_up(gen_random_uuid()) $$, '42501', null, 'anon: no undo_top_up');
select throws_ok($$ select public.undo_waitlist_decision(gen_random_uuid()) $$, '42501', null, 'anon: no undo_waitlist_decision');
reset role;

-- undo_seat: Ritika is assigned from Table 5's list and taken back; she waits again, uncalled, in her place.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key)
select g.venue_id, '00000000-0000-4000-8000-000000000215', g.table_type_id, g.id, '29600000-0000-4000-8000-000000000001'
from public.game_table g where g.id = pg_temp.table5();
create temp table ritika on commit drop as select id from public.waitlist_entry where idempotency_key = '29600000-0000-4000-8000-000000000001';
grant select on ritika to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.assign_from_waitlist((select id from ritika), pg_temp.table5(), 6, 180);
reset role;
create temp table ritika_seat on commit drop as select (pg_temp.seated('00000000-0000-4000-8000-000000000215')).id as id;
grant select on ritika_seat to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.undo_seat((select id from ritika_seat)) $$, '42501', null, 'a dealer undoes no seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.undo_seat((select id from ritika_seat)) $$, 'a host undoes the seat');
reset role;
select is((pg_temp.seated('00000000-0000-4000-8000-000000000215')).id, null, 'Ritika no longer sits');
select is((select row(status, called_at, seated_at, call_seat)::text from public.waitlist_entry where id = (select id from ritika)), '(waiting,,,)',
  'and waits on the list again, uncalled');
select is((select payload ->> 'reason' from public.outbox_event where idempotency_key = 'seat.left:' || (select id from ritika_seat) || ':undone'),
  'undone', 'her lock screen hears the seat go');

-- Seated by number two minutes ago and more, or moved since: not undone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table sess on commit drop as select pg_temp.seat(7, 2) as ishaan, pg_temp.seat(8, 3) as vihaan, pg_temp.seat(9, 4) as mihir;
reset role;
grant select on sess to authenticated;
update public.seat_session set started_at = pg_temp.ago(3), seated_here_at = pg_temp.ago(3) where id = (select mihir from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.undo_seat((select mihir from sess)) $$, '22023', null, 'a seat of three minutes ago stays');
select public.move_seat((select vihaan from sess), pg_temp.table5(), 7);
select throws_ok($$ select public.undo_seat((select vihaan from sess)) $$, '22023', null, 'a seat moved since stays');

-- undo_leave: Mihir leaves and is back; once someone else sits there, he is not.
select public.end_seat((select mihir from sess), 'left');
select lives_ok($$ select public.undo_leave((select mihir from sess)) $$, 'the floor undoes Mihir leaving');
select is((select ended_at from public.seat_session where id = (select mihir from sess)), null, 'Mihir sits again');
select public.end_seat((select mihir from sess), 'left');
select pg_temp.seat(10, 4);
select throws_ok($$ select public.undo_leave((select mihir from sess)) $$, 'RVOCC', null, 'his seat is taken since: not undone');
-- Let go early: the early departure is the cage's record, so the leave stays.
select public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'Emergency');
select public.end_seat((select ishaan from sess), 'left');
select throws_ok($$ select public.undo_leave((select ishaan from sess)) $$, '22023', null, 'a player let go early is not seated again');
reset role;

-- Vihaan (in seat 7) asked for a top-up and an hour; he leaves, and the leave is undone: both wait again, and his lock
-- screen hears him seated. Left again, that leave is told too.
update public.seat_session set top_up_requested_at = pg_temp.ago(1) where id = (select vihaan from sess);
insert into public.top_up_request (venue_id, member_id, session_id, table_id, seat, requested_at)
select venue_id, member_id, id, table_id, seat, pg_temp.ago(1) from public.seat_session where id = (select vihaan from sess);
insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key, requested_at)
select venue_id, member_id, id, 60, gen_random_uuid(), pg_temp.ago(1) from public.seat_session where id = (select vihaan from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.end_seat((select vihaan from sess), 'left');
reset role;
select is((select count(*)::integer from public.top_up_request where session_id = (select vihaan from sess) and closed_at is null), 0, 'leaving closed his top-up');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.undo_leave((select vihaan from sess)) $$, 'the floor undoes Vihaan leaving');
reset role;
select is((select count(*)::integer from public.top_up_request where session_id = (select vihaan from sess) and closed_at is null), 1, 'his top-up waits again');
select is((select status from public.call_time_request where session_id = (select vihaan from sess)), 'requested', 'and his hour');
select ok(exists (select 1 from public.outbox_event where event_type = 'seat.taken' and idempotency_key like 'seat.taken:' || (select vihaan from sess) || ':%'),
  'his lock screen hears him seated again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.end_seat((select vihaan from sess), 'left');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'seat.left' and payload ->> 'session_id' = (select vihaan from sess)::text), 2,
  'the second leave is told as well as the first');

-- Not while his seat is held for a member called from the list, nor at a table closed since, nor a leave of his own.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key)
select g.venue_id, '00000000-0000-4000-8000-000000000216', g.table_type_id, g.id, '29600000-0000-4000-8000-000000000005'
from public.game_table g where g.id = pg_temp.table5();
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.call_from_waitlist((select id from public.waitlist_entry where idempotency_key = '29600000-0000-4000-8000-000000000005'), pg_temp.table5(), 7);
select throws_ok($$ select public.undo_leave((select vihaan from sess)) $$, 'RVHLD', null, 'his seat is held for a call: not undone');
create temp table neel on commit drop as select pg_temp.seat(13, 8) as id;
reset role;
grant select on neel to authenticated;
-- Neel leaves from the app, as leave_my_seat does: ended, and the event keyed by the seat alone.
update public.seat_session set ended_at = now(), end_reason = 'left' where id = (select id from neel);
select private.emit('00000000-0000-4000-8000-000000000001', 'seat.left', '{}'::jsonb, 'seat.left:' || (select id from neel));
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.undo_leave((select id from neel)) $$, '22023', null, 'a leave from the app is the member''s');
create temp table arjun on commit drop as
  select public.seat_member((select id from public.game_table where name = 'Table 3' and venue_id = '00000000-0000-4000-8000-000000000001'), 1,
    p_member_number => 1, p_call_minutes => 180) as id;
select public.end_seat((select id from arjun), 'left');
select public.set_table_open((select id from public.game_table where name = 'Table 3' and venue_id = '00000000-0000-4000-8000-000000000001'), false);
select throws_ok($$ select public.undo_leave((select id from arjun)) $$, '22023', null, 'a table closed since: not undone');
reset role;

-- undo_call_time: Yash (214, in Mihir's seat) asks for an hour, approved and taken back: the request waits again and the
-- call time is 180.
create temp table yash on commit drop as select (pg_temp.seated('00000000-0000-4000-8000-000000000214')).id as id;
grant select on yash to authenticated;
insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key, requested_at)
select venue_id, member_id, id, 60, '29600000-0000-4000-8000-000000000002', pg_temp.ago(1) from public.seat_session where id = (select id from yash);
create temp table asked on commit drop as select id from public.call_time_request where idempotency_key = '29600000-0000-4000-8000-000000000002';
grant select on asked to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select public.decide_call_time_request((select id from asked), true);
reset role;
select is((select call_time_minutes from public.seat_session where id = (select id from yash)), 240, 'an hour approved: four hours');
select is((select minutes_before from public.call_time_request where id = (select id from asked)), 180, 'the call time before is kept');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.undo_call_time((select id from asked)) $$, 'the host undoes the approval');
reset role;
select is((select call_time_minutes from public.seat_session where id = (select id from yash)), 180, 'three hours again');
select is((select row(status, decided_at, minutes_before)::text from public.call_time_request where id = (select id from asked)), '(requested,,)',
  'the request waits again');
-- Declined and taken back: it waits again too.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.decide_call_time_request((select id from asked), false);
select lives_ok($$ select public.undo_call_time((select id from asked)) $$, 'a decline undone');
reset role;
select is((select status from public.call_time_request where id = (select id from asked)), 'requested', 'it waits again');
-- An addition by the floor: a host may not undo it; the manager's undo marks it undone, never asked for.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.add_seat_call_time((select id from yash), 30, '29600000-0000-4000-8000-000000000003');
reset role;
create temp table added on commit drop as select id from public.call_time_request where idempotency_key = '29600000-0000-4000-8000-000000000003';
grant select on added to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.undo_call_time((select id from added)) $$, '42501', null, 'a host does not undo an addition');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.undo_call_time('29600000-0000-4000-8000-000000000003') $$, 'the manager undoes the addition by its request id');
reset role;
select is((select row(status, call_time_minutes)::text from public.call_time_request r join public.seat_session s on s.id = r.session_id
           where r.id = (select id from added)), '(undone,180)', 'undone, and three hours again');
-- Not the latest decision of the seat, or of three minutes ago: stays.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.decide_call_time_request((select id from asked), true);
reset role;
-- A second earlier, as it would be: in this test everything happens at the same moment.
update public.call_time_request set decided_at = decided_at - interval '1 second' where id = (select id from asked);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.add_seat_call_time((select id from yash), 30, gen_random_uuid());
select throws_ok($$ select public.undo_call_time((select id from asked)) $$, '22023', null, 'a later addition: the approval stays');
reset role;
update public.call_time_request set requested_at = pg_temp.ago(4), decided_at = pg_temp.ago(3) where id = (select id from asked);
delete from public.call_time_request where session_id = (select id from yash) and id <> (select id from asked);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.undo_call_time((select id from asked)) $$, '22023', null, 'three minutes ago: stays');
reset role;

-- undo_top_up: started, back to asked for; done, open again as started.
update public.seat_session set top_up_requested_at = pg_temp.ago(1) where id = (select id from yash);
insert into public.top_up_request (venue_id, member_id, session_id, table_id, seat, requested_at)
select venue_id, member_id, id, table_id, seat, pg_temp.ago(1) from public.seat_session where id = (select id from yash);
create temp table topup on commit drop as select id from public.top_up_request where session_id = (select id from yash);
grant select on topup to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select public.set_top_up((select id from yash), true);
select lives_ok($$ select public.undo_top_up((select id from topup)) $$, 'a start undone');
reset role;
select is((select row(r.started_at, s.top_up_started_at, s.top_up_requested_at is not null)::text from public.top_up_request r
           join public.seat_session s on s.id = r.session_id where r.id = (select id from topup)), '(,,t)', 'asked for again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select public.set_top_up((select id from yash), true);
select public.set_top_up((select id from yash), false);
select lives_ok($$ select public.undo_top_up((select id from topup)) $$, 'a top-up done undone');
reset role;
select is((select row(r.closed_at, r.outcome, s.top_up_started_at is not null)::text from public.top_up_request r
           join public.seat_session s on s.id = r.session_id where r.id = (select id from topup)), '(,,t)', 'open again, started');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.undo_top_up((select id from topup)) $$, '42501', null, 'a dealer undoes no top-up');
reset role;

-- undo_waitlist_decision: a join approved is a request again; declined, it is back; not while she waits elsewhere.
update public.waitlist_entry set approved_at = null where id = (select id from ritika);
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select public.approve_waitlist_request((select id from ritika));
select lives_ok($$ select public.undo_waitlist_decision((select id from ritika)) $$, 'an approval undone');
reset role;
select is((select approved_at from public.waitlist_entry where id = (select id from ritika)), null, 'a request again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.decline_waitlist_request((select id from ritika)) $$, '42501', null, 'a dealer declines no join');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select public.decline_waitlist_request((select id from ritika));
reset role;
select is((select row(status, left_reason)::text from public.waitlist_entry where id = (select id from ritika)), '(left,declined)', 'the floor declines her');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.decline_waitlist_request((select id from ritika)) $$, '22023', null, 'a join is declined once');
select lives_ok($$ select public.undo_waitlist_decision((select id from ritika)) $$, 'a decline undone');
reset role;
select is((select row(status, approved_at)::text from public.waitlist_entry where id = (select id from ritika)), '(waiting,)', 'asking again');
-- A place its member gave up is theirs: the floor does not put it back.
update public.waitlist_entry set status = 'left', left_at = now(), left_reason = 'left' where id = (select id from ritika);
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.undo_waitlist_decision((select id from ritika)) $$, '22023', null, 'a place the member gave up stays given up');
reset role;
update public.waitlist_entry set left_reason = 'declined' where id = (select id from ritika);
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key)
select g.venue_id, '00000000-0000-4000-8000-000000000215', g.table_type_id, g.id, gen_random_uuid()
from public.game_table g where g.name = 'Table 2' and g.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.undo_waitlist_decision((select id from ritika)) $$, 'RVONE', null, 'she waits on Table 2 now: not undone');
reset role;

-- Frozen: nothing is undone.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'test 296');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.undo_top_up((select id from topup)) $$, 'RVFRZ', null, 'a frozen venue undoes nothing');
reset role;

-- The practice venue: an approval undone there tells the member's devices, and no consumer ever takes it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table practice on commit drop as select pg_temp.seat(20, 2, '00000000-0000-4000-8000-000000000002') as id;
reset role;
grant select on practice to authenticated;
insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key, requested_at)
select venue_id, member_id, id, 60, '29600000-0000-4000-8000-000000000004', pg_temp.ago(1) from public.seat_session where id = (select id from practice);
create temp table practice_ask on commit drop as select id from public.call_time_request where idempotency_key = '29600000-0000-4000-8000-000000000004';
grant select on practice_ask to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.decide_call_time_request((select id from practice_ask), true);
select lives_ok($$ select public.undo_call_time((select id from practice_ask)) $$, 'the practice floor undoes an approval');
reset role;
select is((select call_time_minutes from public.seat_session where id = (select id from practice)), 180, 'its call time is back');
select is_empty($$ select * from public.claim_outbox_deliveries('push', array['call_time.updated'], false, 500)
                   where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'no consumer takes the practice venue''s');

-- Another venue's floor undoes nothing here: Imran (153) is an admin at the club alone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000153');
select throws_ok($$ select public.undo_call_time((select id from practice_ask)) $$, '42501', null, 'not the practice venue''s call time');
select throws_ok($$ select public.undo_seat((select id from practice)) $$, '42501', null, 'nor its seat');
select throws_ok($$ select public.undo_leave((select id from practice)) $$, '42501', null, 'nor its leave');
reset role;

select * from finish();
rollback;
