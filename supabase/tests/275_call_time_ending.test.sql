-- The call time's 15-minute warning (decision 0320): the minute sweep emits call_time.ending once a call time has 15
-- minutes or less to run, once, and again only after time is added. Ishaan (211) and Vihaan (212) sit at Table 5 with an
-- hour each; 103 is the floor.
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
create function pg_temp.number_of(p_member uuid) returns bigint language sql as $$
  select member_number from public.member where id = p_member;
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text), pg_temp.number_of(uuid) to authenticated;

create function pg_temp.session_of(p_member uuid) returns public.seat_session language sql as $$
  select * from public.seat_session where member_id = p_member and ended_at is null;
$$;
create function pg_temp.warnings(p_member uuid) returns integer language sql as $$
  select count(*)::integer from public.outbox_event where event_type = 'call_time.ending' and payload ->> 'member_id' = p_member::text;
$$;
-- Played `p_minutes` of the call time.
create function pg_temp.played(p_member uuid, p_minutes integer) returns void language sql as $$
  update public.seat_session set started_at = now() - make_interval(mins => p_minutes), seated_here_at = now() - make_interval(mins => p_minutes)
  where member_id = p_member and ended_at is null;
$$;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => pg_temp.number_of('00000000-0000-4000-8000-000000000211'),
                     p_call_minutes => 60) $$, 'the floor seats Ishaan for an hour');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 3, p_member_number => pg_temp.number_of('00000000-0000-4000-8000-000000000212'),
                     p_call_minutes => 60) $$, 'and Vihaan');
reset role;

-- Twenty minutes to run: no warning yet.
select pg_temp.played('00000000-0000-4000-8000-000000000211', 40);
select private.sweep_seated_time();
select is(pg_temp.warnings('00000000-0000-4000-8000-000000000211'), 0, 'twenty minutes to run: no warning');

-- Ten minutes to run: one warning, with the table, the seat and when it ends; a second sweep sends no other.
select pg_temp.played('00000000-0000-4000-8000-000000000211', 50);
select private.sweep_seated_time();
select private.sweep_seated_time();
select is(pg_temp.warnings('00000000-0000-4000-8000-000000000211'), 1, 'ten minutes to run: one warning, however often the sweep runs');
select is((select payload - 'ends_at' - 'session_id' from public.outbox_event where event_type = 'call_time.ending'
             and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000211'),
  jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000211', 'table_name', 'Table 5', 'seat', 2), 'it names the table and seat');
select ok((select (payload ->> 'ends_at')::timestamptz between now() + interval '9 minutes' and now() + interval '11 minutes'
           from public.outbox_event where event_type = 'call_time.ending' and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000211'),
  'and when the call time ends');
select ok((pg_temp.session_of('00000000-0000-4000-8000-000000000211')).ending_warned_at is not null, 'the session keeps that it was warned');

-- Time added (the floor's approval clears the warning, 272): an hour more runs past the warning; near its new end, a second.
update public.seat_session set call_time_minutes = 120, ending_warned_at = null where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select private.sweep_seated_time();
select is(pg_temp.warnings('00000000-0000-4000-8000-000000000211'), 1, 'an hour added: no warning while it has an hour to run');
select pg_temp.played('00000000-0000-4000-8000-000000000211', 110);
select private.sweep_seated_time();
select is(pg_temp.warnings('00000000-0000-4000-8000-000000000211'), 2, 'ten minutes before the new end: a second warning');

-- Away, the clock stands still: no warning until back.
select pg_temp.played('00000000-0000-4000-8000-000000000212', 50);
update public.seat_session set away_since = now() where member_id = '00000000-0000-4000-8000-000000000212' and ended_at is null;
select private.sweep_seated_time();
select is(pg_temp.warnings('00000000-0000-4000-8000-000000000212'), 0, 'away: no warning');

-- Run out between sweeps: call_time.completed says so, and no warning comes after it.
update public.seat_session set away_since = null where member_id = '00000000-0000-4000-8000-000000000212' and ended_at is null;
select pg_temp.played('00000000-0000-4000-8000-000000000212', 61);
select private.sweep_seated_time();
select is(pg_temp.warnings('00000000-0000-4000-8000-000000000212'), 0, 'run out: no warning');
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.completed'
             and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000212'), 1, 'call_time.completed instead');

select * from finish();
rollback;
