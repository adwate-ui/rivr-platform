-- Add time as a request the floor approves (decision 0320). Ishaan (211) sits at Table 5; 103 Aditya is the floor; 106 Pema
-- a dealer. Call time is open to Ishaan here whatever his tier says.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.session() returns public.seat_session language sql as $$
  select * from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text), pg_temp.session() to authenticated;

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'call_time.view', true, 'test 272');

-- Not seated, there is nothing to add to.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.request_call_time(60, gen_random_uuid()) $$, '22023', null, 'a member not seated asks for nothing');
reset role;

-- Seated with no call time: nothing to add to either.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 0) $$, 'the floor seats Ishaan with no call time');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.request_call_time(60, gen_random_uuid()) $$, '22023', null, 'with no call time there is none to add to');
reset role;

-- Three hours, then an hour asked for: one request, the same id for the same tap and for a second tap while it waits.
update public.seat_session set call_time_minutes = 180 where id = (pg_temp.session()).id;
create temp table sess on commit drop as select (pg_temp.session()).id as id;
grant select on sess to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.request_call_time(45, gen_random_uuid()) $$, '22023', null, '45 minutes is not a choice');
create temp table asked on commit drop as select public.request_call_time(60, '00000000-0000-4000-8000-00000000c272'::uuid) as id;
grant select on asked to authenticated;
select is(public.request_call_time(60, '00000000-0000-4000-8000-00000000c272'::uuid), (select id from asked), 'the same tap asks once');
select is(public.request_call_time(30, gen_random_uuid()), (select id from asked), 'another tap while it waits gives the same request back');
select is((select time_request_minutes from public.my_seat()), 60, 'his seat shows the hour asked for');
reset role;
select is((select count(*)::integer from public.call_time_request where session_id = (pg_temp.session()).id), 1, 'one request is kept');

-- A dealer is not the floor; nobody reads the table directly.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.decide_call_time_request((select id from asked), true) $$, '42501', null, 'a dealer decides nothing');
select throws_ok($$ select count(*) from public.call_time_request $$, '42501', null, 'the requests are read only through my_seat and floor_seats');
reset role;

-- The floor sees it beside the seat and approves: three hours become four, the warning is owed again, and the member's
-- devices hear of it. A completion already recorded stands.
update public.seat_session set call_time_completed_at = now(), ending_warned_at = now() where id = (pg_temp.session()).id;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select time_request_minutes from public.floor_seats('00000000-0000-4000-8000-000000000001') where session_id = (select id from sess)),
  60, 'the floor sees the hour asked for beside the seat');
select lives_ok($$ select public.decide_call_time_request((select id from asked), true) $$, 'the floor approves');
select throws_ok($$ select public.decide_call_time_request((select id from asked), false) $$, '22023', null, 'a request is decided once');
reset role;
select is((pg_temp.session()).call_time_minutes, 240, 'his call time is four hours');
select ok((pg_temp.session()).ending_warned_at is null, 'its 15-minute warning is owed again');
select ok((pg_temp.session()).call_time_completed_at is not null, 'the completion recorded stands');
select is((select status from public.call_time_request where id = (select id from asked)), 'approved', 'the request is approved');
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.updated' and payload ->> 'session_id' = (pg_temp.session()).id::text),
  1, 'call_time.updated goes out once');

-- Declined: nothing changes.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
create temp table second on commit drop as select public.request_call_time(120, gen_random_uuid()) as id;
grant select on second to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.decide_call_time_request((select id from second), false) $$, 'the floor declines two hours');
reset role;
select is((pg_temp.session()).call_time_minutes, 240, 'his call time is still four hours');

-- Past a day is refused, never cut down.
update public.seat_session set call_time_minutes = 1400 where id = (pg_temp.session()).id;
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.request_call_time(60, gen_random_uuid()) $$, '22023', null, 'an hour onto 1,400 minutes is refused');
reset role;

-- With the venue frozen, nothing is asked or decided.
update public.seat_session set call_time_minutes = 180 where id = (pg_temp.session()).id;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'test 272');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.request_call_time(60, gen_random_uuid()) $$, 'RVFRZ', null, 'a frozen venue takes no request');
reset role;

select * from finish();
rollback;
