-- The floor's call time warns instead of refusing (the owner, 25 Nov; #1132): a time before the minimum or the current end,
-- or one gone, is refused until confirmed, then set; a day at most stays hard; the member's own Set keeps its rule; Undo
-- gives back a call time the sweep had marked done. Ishaan (211) sits at Table 5 with a three-hour minimum, an hour and
-- forty minutes in; 103 Aditya is a floor manager (admin), 104 a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.seat() returns uuid language sql security definer as $$
  select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
$$;
create function pg_temp.minutes() returns integer language sql security definer as $$
  select call_time_minutes from public.seat_session where id = pg_temp.seat();
$$;
grant execute on function pg_temp.as_person(text), pg_temp.seat(), pg_temp.minutes() to authenticated;

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'call_time.view', true, 'test 602');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5'),
                          2, '9000000211', p_call_minutes => 180);
reset role;
update public.seat_session set started_at = now() - interval '100 minutes' where id = pg_temp.seat();

-- Before the end of the minimum: refused until confirmed, then set, shortening it to 2 h 40.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() + interval '1 hour', '00000000-0000-4000-8000-00000000c602') $$,
  'RVCTE', null, 'a time before the end of the minimum is refused until the floor confirms it');
select is(pg_temp.minutes(), 180, 'and nothing is set');
select throws_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() + interval '1 hour', '00000000-0000-4000-8000-00000000c602', false) $$,
  'RVCTE', null, 'nor when it is sent unconfirmed by name');
select lives_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() + interval '1 hour', '00000000-0000-4000-8000-00000000c602', true) $$,
  'confirmed, the floor sets it with the same request id');
select is(pg_temp.minutes(), 160, 'to the minutes played and ahead');
select lives_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() + interval '1 hour', '00000000-0000-4000-8000-00000000c602', true) $$,
  'the same request again sets nothing more');
reset role;
select is((select count(*)::integer from public.call_time_request where session_id = pg_temp.seat()), 1, 'one request, kept once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');

-- Set: before the current end is refused, then shortened when confirmed; after it, no warning.
select throws_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() + interval '30 minutes', gen_random_uuid()) $$,
  'RVCTE', null, 'once set, a time before the current end is refused until confirmed');
select lives_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() + interval '2 hours', gen_random_uuid()) $$,
  'a time after the current end needs no confirming');
select is(pg_temp.minutes(), 220, 'and extends it');

-- A day at most stays hard, confirmed or not.
select throws_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() + interval '23 hours', gen_random_uuid(), true) $$,
  'RVCTX', null, 'more than a day in all is refused even confirmed');

-- A cashier picks a time gone: refused until confirmed; then the call time ends now and is owed no more.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() - interval '2 minutes', '00000000-0000-4000-8000-00000000d602') $$,
  'RVCTG', null, 'a time gone is refused until confirmed, for a cashier too');
select lives_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() - interval '2 minutes', '00000000-0000-4000-8000-00000000d602', true) $$,
  'confirmed, it is set');
select is(pg_temp.minutes(), 100, 'to the whole minutes played');
reset role;
select is((select minutes from public.call_time_request where idempotency_key = '00000000-0000-4000-8000-00000000d602'), 0,
  'the request keeps none ahead');
select ok(not private.owes_call_time((select s from public.seat_session s where s.id = pg_temp.seat()), now()), 'the seat owes no call time');
select private.sweep_seated_time();
select isnt((select call_time_completed_at from public.seat_session where id = pg_temp.seat()), null, 'the minute sweep marks it done');

-- Undo gives back the call time as it was, owing again.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select public.undo_call_time('00000000-0000-4000-8000-00000000d602') $$, 'the cashier undoes it');
reset role;
select is(pg_temp.minutes(), 220, 'Undo gives the call time back');
select is((select call_time_completed_at from public.seat_session where id = pg_temp.seat()), null, 'and it is owed again, not done');

-- Staff never set call time on their own seat, now that it can be cut: Ishaan's number made Aditya's.
update public.member set phone = (select s.phone from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000103'
                                    and s.venue_id = '00000000-0000-4000-8000-000000000001')
where id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_seat_call_time(pg_temp.seat(), now() - interval '1 minute', gen_random_uuid(), true) $$,
  'RVOWN', null, 'staff never set call time on their own seat');
reset role;
update public.member set phone = '+919000000211' where id = '00000000-0000-4000-8000-000000000211';

-- The member's own Set keeps the member's rule.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.set_my_call_time(now() + interval '30 minutes', gen_random_uuid()) $$,
  'RVCTE', null, 'a member never sets a time before the current end');
reset role;

select * from finish();
rollback;
