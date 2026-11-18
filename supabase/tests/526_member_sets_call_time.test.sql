-- The member sets their call time from the seat (#1059, the owner, 17 Nov): a length the club offers, from now, owed as
-- well as the call time they had. Ishaan (211) sits at Table 5; 103 Aditya is the floor. Call time is open to Ishaan here
-- whatever his tier says.
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
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'call_time.view', true, 'test 526');

-- Not seated, there is no call time to set.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.set_my_call_time(60, gen_random_uuid()) $$, '22023', null, 'a member not seated sets nothing');
reset role;

-- Seated with three hours, an hour and forty minutes ago.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 180) $$, 'the floor seats Ishaan with three hours');
reset role;
update public.seat_session set started_at = now() - interval '100 minutes', seated_here_at = now() - interval '100 minutes', ending_warned_at = now()
where id = (pg_temp.session()).id;
create temp table sess on commit drop as select (pg_temp.session()).id as id;
grant select on sess to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select call_time_set_at from public.my_seat()), null, 'his seat says he has set no call time yet');
-- Set call time opens once a length would end after the three hours (#1076): an hour would not, two hours would.
select ok((select not (60 = any (call_time_choices_open)) and 120 = any (call_time_choices_open) from public.my_seat()),
  'the lengths open to him end after the three hours he started with');
select throws_ok($$ select public.set_my_call_time(45, gen_random_uuid()) $$, 'RVCTC', null, '45 minutes is not a length the club offers');
select throws_ok($$ select public.set_my_call_time(60, gen_random_uuid()) $$, 'RVCTE', null,
  'an hour from now would end before the three hours he owes, and is refused');
select is(public.set_my_call_time(120, '00000000-0000-4000-8000-00000000c526'::uuid), 220, 'two hours from now make three hours forty');
select is(public.set_my_call_time(120, '00000000-0000-4000-8000-00000000c526'::uuid), 220, 'the same tap sets it once');
select throws_ok($$ select public.set_my_call_time(60, '00000000-0000-4000-8000-00000000c526'::uuid) $$, '22023', null,
  'a request id is for one call time');
select ok((select call_time_set_at is not null from public.my_seat()), 'his seat now says he set it');
select is((select call_time_minutes from public.my_seat()), 220, 'and shows three hours forty');
-- Once set, a length extends it (#1076): thirty minutes on three hours forty make four hours ten.
select ok((select 30 = any (call_time_choices_open) from public.my_seat()), 'once set, every length is open, to extend it');
select is(public.set_my_call_time(30, gen_random_uuid()), 250, 'thirty minutes extend it to four hours ten');
reset role;
select is((select count(*)::integer from public.call_time_request where session_id = (select id from sess)), 2,
  'each set and extension is a row of the seat''s history');

select is((pg_temp.session()).call_time_minutes, 250, 'the seat owes four hours ten');
select ok((pg_temp.session()).ending_warned_at is null, 'its 15-minute warning is owed again');
select results_eq(
  $$ select minutes, status, minutes_before, decided_by_staff_id is null from public.call_time_request where session_id = (select id from sess)
    order by decided_at, minutes desc $$,
  $$ values (120, 'approved', 180, true), (30, 'approved', 220, true) $$,
  'the seat''s history keeps two hours set by the member from three hours, then thirty minutes from three hours forty, with no staff member');
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.updated' and payload ->> 'session_id' = (select id from sess)::text),
  2, 'call_time.updated goes out once for each');

-- A request the floor decides is not a member's set: its id is not taken as a repeat.
insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', (select id from sess), 60,
        '00000000-0000-4000-8000-00000000d526');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.set_my_call_time(60, '00000000-0000-4000-8000-00000000d526'::uuid) $$, '22023', null,
  'a request waiting on the floor is not his set');
reset role;
delete from public.call_time_request where idempotency_key = '00000000-0000-4000-8000-00000000d526';

-- Once the call time set has run out, a length runs from the minutes played.
update public.seat_session set started_at = now() - interval '260 minutes', seated_here_at = now() - interval '260 minutes'
where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.set_my_call_time(30, gen_random_uuid()), 290, 'thirty minutes after it ran out make four hours fifty');
reset role;

-- Past a day has its own refusal, so the app says which (money review).
update public.seat_session set started_at = now() - interval '1420 minutes', seated_here_at = now() - interval '1420 minutes'
where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.set_my_call_time(30, gen_random_uuid()) $$, 'RVCTX', null, 'thirty minutes at 23 h 40 played would pass a day');
reset role;

-- A seat with no call time sets none: none is made from nothing (security review).
update public.seat_session set call_time_minutes = 0, call_time_completed_at = null where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.set_my_call_time(30, gen_random_uuid()) $$, 'RVCTN', null, 'a seat with no call time sets none');
reset role;

-- The SQL rule refuses what the app greys out (its golden cases are in 024).
select is(private.call_time_choice_end(180, 100, 180, false, 60), null, 'ending before the call time owed is refused');
select is(private.call_time_choice_end(180, 120, 180, false, 60), null, 'ending just as the call time started with is refused');
select is(private.call_time_choice_end(180, 121, 180, false, 60), 181, 'ending a minute after it is open');
select is(private.call_time_choice_end(180, 1400, 180, false, 60), null, 'past a day is refused');
select is(private.call_time_choice_end(0, 10, 0, false, 30), null, 'no call time to set from is refused');

select * from finish();
rollback;
