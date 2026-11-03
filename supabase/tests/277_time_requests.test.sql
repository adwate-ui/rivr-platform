-- More call time as the owner set it on 3 Nov (decision 0305): the lengths offered are a setting, the floor's managers
-- add them without a request, met or not, and time requests are a queue of their own. Ishaan (211) sits at Table 5 with
-- three hours; 103 is a floor manager (admin), 108 a host, 106 a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.session() returns public.seat_session language sql as $$
  select * from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
$$;
create function pg_temp.waiting(p_queue text) returns integer language sql as $$
  select coalesce((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = p_queue), 0);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.session(), pg_temp.waiting(text) to authenticated;

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'call_time.view', true, 'test 277');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'),
                     2, p_member_number => (select member_number from public.member where id = '00000000-0000-4000-8000-000000000211'),
                     p_call_minutes => 180) $$, 'the floor seats Ishaan for three hours');
reset role;
create temp table sess on commit drop as select (pg_temp.session()).id as id;
grant select on sess to authenticated;

-- None ticked: 30 minutes, 1 hour and 2 hours, to the floor and on the member's seat.
select is(public.add_time_choices('00000000-0000-4000-8000-000000000001'), array[30, 60, 120], 'none set: 30 min, 1 hour, 2 hours');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(public.add_time_choices('00000000-0000-4000-8000-000000000001'), array[30, 60, 120], 'a host reads them too');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.add_time_choices('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a dealer does not');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select add_time_choices from public.my_seat()), array[30, 60, 120], 'the seat offers them');
reset role;

-- The club ticks 45 minutes and 1 hour 30: those are offered, shortest first, and nothing else is asked for or added.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'call_time.add_choices', '', '{"minutes": ["90", "45"]}', '-infinity', 'test 277');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'call_time.add_choices', '', '{"minutes": ["50"]}', now() + interval '1 day', 'test 277') $$,
  null, null, 'a length that is not a preset is no setting');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select add_time_choices from public.my_seat()), array[45, 90], 'the seat offers 45 minutes and 1 hour 30');
select throws_ok($$ select public.request_call_time(60, gen_random_uuid()) $$, '22023', null, 'an hour is not offered now');
create temp table asked on commit drop as select public.request_call_time(45, gen_random_uuid()) as id;
grant select on asked to authenticated;
reset role;

-- The request is the Time requests queue's, red on the rail; the live floor no longer counts it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.waiting('timeRequests'), 1, 'one time request waits');
select is(pg_temp.waiting('liveFloor'), 0, 'the live floor does not count it');
select lives_ok($$ select public.decide_call_time_request((select id from asked), true) $$, 'the floor approves 45 minutes');
select is(pg_temp.waiting('timeRequests'), 0, 'approved, none waits');
reset role;
select is((pg_temp.session()).call_time_minutes, 225, 'three hours and 45 minutes');

-- The floor's managers add a length offered themselves; a host does not, and nothing but a length offered is added.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.add_seat_call_time((select id from sess), 90, gen_random_uuid()) $$, '42501', null, 'a host adds no call time');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), 60, gen_random_uuid()) $$, '22023', null, 'an hour is not offered');
select throws_ok($$ select public.add_seat_call_time((select id from sess), 90, null) $$, '22023', null, 'nor anything without a request id');
select lives_ok($$ select public.add_seat_call_time((select id from sess), 90, '277a0000-0000-4000-8000-000000000001') $$, 'a floor manager adds 1 hour 30');
-- The same request again (a retry after a lost answer) adds nothing more; the same id for another length is refused.
select lives_ok($$ select public.add_seat_call_time((select id from sess), 90, '277a0000-0000-4000-8000-000000000001') $$, 'the same request again');
select throws_ok($$ select public.add_seat_call_time((select id from sess), 45, '277a0000-0000-4000-8000-000000000001') $$, '22023', null,
  'that request id was for another addition');
reset role;
select is((pg_temp.session()).call_time_minutes, 315, '5 hours 15, added once');
select is((select row(status, minutes, decided_by_staff_id is not null)::text from public.call_time_request
           where idempotency_key = '277a0000-0000-4000-8000-000000000001'), '(approved,90,t)', 'kept as approved, with who added it');
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.updated' and payload ->> 'minutes' = '315'),
  1, 'the member''s devices are told, once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select public.add_seat_call_time((select id from sess), 45, gen_random_uuid()) $$, 'a cashier, with the floor''s permissions, adds too');
reset role;
select is((pg_temp.session()).call_time_minutes, 360, 'six hours');

-- Met: time added runs from the minutes played, the seat owes it again, and the sweep completes it again once played. The
-- first completion still counts for promotions.
update public.seat_session set started_at = now() - interval '7 hours', seated_here_at = now() - interval '7 hours' where id = (select id from sess);
select private.sweep_seated_time();
select ok((pg_temp.session()).call_time_completed_at is not null, 'seven hours played: the call time is met');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.add_seat_call_time((select id from sess), 45, gen_random_uuid()) $$, 'the floor adds 45 minutes once it is met');
reset role;
select is((pg_temp.session()).call_time_minutes, 465, 'seven hours played, and 45 minutes from now');
select is((pg_temp.session()).call_time_completed_at, null, 'the call time is owed again');
select ok((pg_temp.session()).call_time_first_met_at is not null, 'when it was first met is kept');
select ok((private.promotion_facts('00000000-0000-4000-8000-000000000211', (pg_temp.session()).table_id, now()) ->> 'call_time_complete')::boolean,
  'so promotions still count a call time completed');
update public.seat_session set started_at = now() - interval '8 hours', seated_here_at = now() - interval '8 hours' where id = (select id from sess);
select private.sweep_seated_time();
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.completed'
             and payload ->> 'session_id' = (select id from sess)::text), 2, 'met again: a second call_time.completed');

-- Never past a day, from the time played as from the call time.
update public.seat_session set call_time_minutes = 1380, call_time_completed_at = null where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), 90, gen_random_uuid()) $$, '22023', null, 'not past a day');
reset role;

-- A seat that ended takes nothing; a frozen venue adds nothing.
update public.seat_session set ended_at = now(), end_reason = 'left' where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), 45, gen_random_uuid()) $$, '22023', null, 'an ended seat takes nothing');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'test 277');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), 45, gen_random_uuid()) $$, 'RVFRZ', null, 'a frozen venue adds nothing');
reset role;

select * from finish();
rollback;
