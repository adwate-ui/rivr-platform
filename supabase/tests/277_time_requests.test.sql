-- More call time as the owner set it on 3 Nov (decision 0305), 18 Nov (#1076) and 22 Nov: the floor's managers set a seat's
-- call time to a time on the clock by the member's own rule: until a call time is set, the time must fall after the minimum
-- the seat started with, and setting one counts as setting it; once set, a time past the end extends it. Ishaan (211) sits
-- at Table 5 with three hours; 103 is a floor manager (admin), 108 a host, 104 a cashier. One transaction is one moment.
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

-- Seated just now, a time before the three hours end is refused: the floor's Set waits as the member's does.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '90 minutes', gen_random_uuid()) $$, '22023', null,
  'a time an hour and a half from now ends before the three hours, and is refused');
reset role;
update public.seat_session set started_at = now() - interval '150 minutes', seated_here_at = now() - interval '150 minutes' where id = (select id from sess);

-- The floor's managers set a time themselves; a host does not, and nothing without a time or a request id.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '90 minutes', gen_random_uuid()) $$, '42501', null,
  'a host sets no call time');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '90 minutes', null) $$, '22023', null,
  'nor anything without a request id');
select throws_ok($$ select public.add_seat_call_time((select id from sess), null, gen_random_uuid()) $$, '22023', null, 'nor without a time');
select lives_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '90 minutes', '277a0000-0000-4000-8000-000000000001') $$,
  'two and a half hours in, a floor manager sets a time an hour and a half from now');
-- The same request again (a retry after a lost answer) sets nothing more; the same id for another time is refused.
select lives_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '90 minutes', '277a0000-0000-4000-8000-000000000001') $$,
  'the same request again');
select throws_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '2 hours', '277a0000-0000-4000-8000-000000000001') $$, '22023', null,
  'that request id was for another call time');
reset role;
select is((pg_temp.session()).call_time_minutes, 240, 'four hours: two and a half played and an hour and a half to the time, set once');
select ok((pg_temp.session()).call_time_set_at is not null, 'the floor''s Set counts as setting it');
select is((select row(status, minutes, decided_by_staff_id is not null)::text from public.call_time_request
           where idempotency_key = '277a0000-0000-4000-8000-000000000001'), '(approved,90,t)', 'kept as approved, with who set it');
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.updated' and payload ->> 'minutes' = '240'),
  1, 'the member''s devices are told, once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '90 minutes', gen_random_uuid()) $$, '22023', null,
  'once set, a time at the current end does not extend it');
select lives_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '135 minutes', gen_random_uuid()) $$,
  'a cashier, with the floor''s permissions, extends it too');
reset role;
select is((pg_temp.session()).call_time_minutes, 285, 'once set, a time 45 minutes past the end makes four hours 45');

-- Met: a time picked runs from the time played, the seat owes it again, and the sweep completes it again once played. The
-- first completion still counts for promotions.
update public.seat_session set started_at = now() - interval '7 hours', seated_here_at = now() - interval '7 hours' where id = (select id from sess);
select private.sweep_seated_time();
select ok((pg_temp.session()).call_time_completed_at is not null, 'seven hours played: the call time is met');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '45 minutes', gen_random_uuid()) $$,
  'the floor sets a time 45 minutes on once it is met');
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

-- Never past a day: eight hours played, a time making exactly a day is open, a minute later is not.
update public.seat_session set call_time_minutes = 1380, call_time_completed_at = null where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '961 minutes', gen_random_uuid()) $$, '22023', null,
  'not past a day');
select lives_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '960 minutes', gen_random_uuid()) $$, 'a day at most');
reset role;
select is((pg_temp.session()).call_time_minutes, 1440, 'a whole day');

-- A seat that ended takes nothing; a frozen venue sets nothing.
update public.seat_session set ended_at = now(), end_reason = 'left' where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '45 minutes', gen_random_uuid()) $$, '22023', null,
  'an ended seat takes nothing');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'test 277');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '45 minutes', gen_random_uuid()) $$, 'RVFRZ', null,
  'a frozen venue sets nothing');
reset role;

select * from finish();
rollback;
