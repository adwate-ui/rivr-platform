-- The member sets their call time from the seat (#1059, the owner, 17 Nov), to a time on the clock (the owner, 22 Nov):
-- until set, a time after the minimum playing time the seat started with; once set, after the current end; owed as well
-- as the call time they had. Ishaan (211) sits at Table 5; 103 Aditya is the floor. Call time is open to Ishaan here
-- whatever his tier says. One transaction is one moment, so now() is the same throughout.
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
select throws_ok($$ select public.set_my_call_time(now() + interval '1 hour', gen_random_uuid()) $$, '22023', null, 'a member not seated sets nothing');
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
select is((select call_time_after_at from public.my_seat()), now() + interval '80 minutes',
  'a time opens once the three hours he started with end, eighty minutes from now');
select throws_ok($$ select public.set_my_call_time(now() + interval '1 hour', gen_random_uuid()) $$, 'RVCTE', null,
  'a time an hour from now ends before the three hours he owes, and is refused');
select throws_ok($$ select public.set_my_call_time(now() + interval '80 minutes', gen_random_uuid()) $$, 'RVCTE', null,
  'a time just as the three hours end is not after them, and is refused');
select throws_ok($$ select public.set_my_call_time(null, gen_random_uuid()) $$, '22023', null, 'a call time is set to a time');
select is(public.set_my_call_time(now() + interval '2 hours', '00000000-0000-4000-8000-00000000c526'::uuid), 220,
  'a time two hours from now makes three hours forty');
select is(public.set_my_call_time(now() + interval '2 hours', '00000000-0000-4000-8000-00000000c526'::uuid), 220, 'the same tap sets it once');
select throws_ok($$ select public.set_my_call_time(now() + interval '3 hours', '00000000-0000-4000-8000-00000000c526'::uuid) $$, '22023', null,
  'a request id is for one call time');
select ok((select call_time_set_at is not null from public.my_seat()), 'his seat now says he set it');
select is((select add_time_choices || call_time_choices_open from public.my_seat()), '{}'::integer[],
  'for this release the old lengths read empty, so an app open from before offers none');
select is((select call_time_minutes from public.my_seat()), 220, 'and shows three hours forty');
-- Once set, a time extends it past its current end, two hours from now.
select is((select call_time_after_at from public.my_seat()), now() + interval '2 hours', 'once set, a time opens after the current end');
select throws_ok($$ select public.set_my_call_time(now() + interval '2 hours', gen_random_uuid()) $$, 'RVCTE', null,
  'a time just at the current end does not extend it');
select is(public.set_my_call_time(now() + interval '150 minutes', gen_random_uuid()), 250, 'half an hour past the end extends it to four hours ten');
reset role;
select is((select count(*)::integer from public.call_time_request where session_id = (select id from sess)), 2,
  'each set and extension is a row of the seat''s history');

select is((pg_temp.session()).call_time_minutes, 250, 'the seat owes four hours ten');
select ok((pg_temp.session()).ending_warned_at is null, 'its 15-minute warning is owed again');
select results_eq(
  $$ select minutes, status, minutes_before, decided_by_staff_id is null, until_at from public.call_time_request where session_id = (select id from sess)
    order by until_at $$,
  $$ values (120, 'approved', 180, true, now() + interval '2 hours'), (150, 'approved', 220, true, now() + interval '150 minutes') $$,
  'the seat''s history keeps each time picked, the length from now to it, and the call time before, with no staff member');
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.updated' and payload ->> 'session_id' = (select id from sess)::text),
  2, 'call_time.updated goes out once for each');

-- A request the floor decides is not a member's set: its id is not taken as a repeat.
insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', (select id from sess), 60,
        '00000000-0000-4000-8000-00000000d526');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.set_my_call_time(now() + interval '5 hours', '00000000-0000-4000-8000-00000000d526'::uuid) $$, '22023', null,
  'a request waiting on the floor is not his set');
reset role;
delete from public.call_time_request where idempotency_key = '00000000-0000-4000-8000-00000000d526';

-- Once the call time set has run out, a time counts from the time played.
update public.seat_session set started_at = now() - interval '260 minutes', seated_here_at = now() - interval '260 minutes'
where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select call_time_after_at from public.my_seat()), now(), 'run out, any time ahead is open');
select throws_ok($$ select public.set_my_call_time(now() - interval '1 minute', gen_random_uuid()) $$, 'RVCTE', null, 'a time gone by is refused');
select is(public.set_my_call_time(now() + interval '30 minutes', gen_random_uuid()), 290, 'half an hour from now, after it ran out, makes four hours fifty');
reset role;

-- Past a day has its own refusal, so the app says which (money review).
update public.seat_session set started_at = now() - interval '1420 minutes', seated_here_at = now() - interval '1420 minutes'
where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.set_my_call_time(now() + interval '30 minutes', gen_random_uuid()) $$, 'RVCTX', null,
  'half an hour on, at 23 h 40 played, would pass a day');
select throws_ok($$ select public.set_my_call_time(now() + interval '4000 years', gen_random_uuid()) $$, 'RVCTX', null,
  'a time thousands of years on is past a day, never an error of size');
select throws_ok($$ select public.set_my_call_time(now() - interval '4000 years', gen_random_uuid()) $$, 'RVCTE', null,
  'and one thousands of years gone is gone by');
select throws_ok($$ select public.set_my_call_time(null, '00000000-0000-4000-8000-00000000c526'::uuid) $$, '22023', null,
  'a request id sent again with no time is refused, not taken as a repeat');
reset role;

-- Six changes in ten minutes at most (security review): each tells the floor and his devices. Three made so far; three more.
update public.seat_session set started_at = now() - interval '260 minutes', seated_here_at = now() - interval '260 minutes'
where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.set_my_call_time(now() + interval '40 minutes', gen_random_uuid()), 300, 'a fourth change');
select is(public.set_my_call_time(now() + interval '50 minutes', gen_random_uuid()), 310, 'a fifth');
select is(public.set_my_call_time(now() + interval '60 minutes', gen_random_uuid()), 320, 'a sixth');
select throws_ok($$ select public.set_my_call_time(now() + interval '70 minutes', gen_random_uuid()) $$, 'RVRAT', null,
  'a seventh in ten minutes waits');
reset role;

-- A seat with no call time sets none: none is made from nothing (security review).
update public.seat_session set call_time_minutes = 0, call_time_completed_at = null where id = (select id from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select call_time_after_at from public.my_seat()), null, 'no call time, no time opens');
select throws_ok($$ select public.set_my_call_time(now() + interval '30 minutes', gen_random_uuid()) $$, 'RVCTN', null, 'a seat with no call time sets none');
reset role;

-- The lengths are gone, with their settings and the old way of setting by one.
select ok(to_regprocedure('public.set_my_call_time(integer, uuid)') is null and to_regprocedure('public.add_seat_call_time(uuid, integer, uuid)') is null
          and to_regprocedure('public.add_time_choices(uuid)') is null, 'call time is no longer set by a length');
select is_empty($$ select key from public.setting_key where key in ('call_time.add_choices', 'call_time.extend_choices') $$,
  'nor are lengths a setting');

select * from finish();
rollback;
