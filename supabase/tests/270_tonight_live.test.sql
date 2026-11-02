-- The redesigned Tonight (decision 0320): my_seat's absolute end of the call time, null while away, and the seat's game;
-- floor_taken_seats, the seat numbers taken at the member's venue and nothing else. Ishaan (211) has finished the check;
-- 103 Aditya is the floor. Table 5 is open at 100/200.
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
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text) to authenticated;

-- Ishaan sits at Table 5, seat 2, for five hours; the floor also holds seat 7 there for nobody yet (none called).
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 300) $$, 'the floor seats Ishaan at Table 5');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
create temp table seat_now on commit drop as select * from public.my_seat();
grant select on seat_now to authenticated;
reset role;
select is((select count(*)::integer from seat_now), 1, 'Ishaan reads his one seat');
select ok((select case when private.has_feature('00000000-0000-4000-8000-000000000211', 'call_time.view')
                       then abs(extract(epoch from call_time_ends_at - now()) - call_time_left) < 2
                       else call_time_ends_at is null end from seat_now),
  'his call time ends at now plus the time left, with call time open to him');
select results_eq($$ select table_type_name, small_blind_paise, big_blind_paise from seat_now $$,
  $$ select t.name, t.small_blind_paise, t.big_blind_paise from public.game_table g join public.table_type t on t.id = g.table_type_id
     where g.id = pg_temp.table_id('Table 5') $$, 'and the seat names its game and stakes');

-- Away, the clock stands still: no end to count down to.
update public.seat_session set away_since = now() where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select ok((select call_time_ends_at is null from public.my_seat()), 'away from the table, the seat gives no end');
reset role;

-- The seat numbers taken: his seat at Table 5, with the table's id, and only numbers.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
create temp table taken on commit drop as select * from public.floor_taken_seats();
grant select on taken to authenticated;
reset role;
select ok(exists (select 1 from taken where table_id = pg_temp.table_id('Table 5') and seat = 2), 'his seat is taken at Table 5');
select is((select count(*)::integer from information_schema.routines r
           join information_schema.parameters p on p.specific_name = r.specific_name
           where r.routine_schema = 'public' and r.routine_name = 'floor_taken_seats' and p.parameter_mode = 'OUT'), 2,
  'the taken seats carry a table and a seat number, never a name');
select ok(not exists (select 1 from taken t join public.game_table g on g.id = t.table_id
                      where g.venue_id <> '00000000-0000-4000-8000-000000000001'), 'only his own venue''s tables');

-- Nobody signed in reads nothing; anon may not call it.
select throws_ok($$ set local role anon; select * from public.floor_taken_seats() $$, '42501', null, 'anon may not read taken seats');
reset role;

-- A member whose tier has no live floor reads no taken seats.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'floor.live_view', false, 'test 270');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.floor_taken_seats() $$, 'without floor.live_view, no taken seats');
reset role;

select * from finish();
rollback;
