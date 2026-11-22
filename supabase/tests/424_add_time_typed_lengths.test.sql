-- A call time's request holds a length of whole minutes, never nought or more than a day, and a stake's call time written with
-- a point is the whole number it is (redesign RD-19). The lengths the club once typed (call_time.add_choices) went when call
-- time came to be set to a time (the owner, 22 Nov; 526 and 277). Ishaan (211) sits at Table 5 with three hours; 103 is a
-- floor manager (admin).
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
grant execute on function pg_temp.as_person(text), pg_temp.session() to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'),
                     2, p_member_number => (select member_number from public.member where id = '00000000-0000-4000-8000-000000000211'),
                     p_call_minutes => 180) $$, 'the floor seats Ishaan for three hours');
reset role;
create temp table sess on commit drop as select (pg_temp.session()).id as id;
grant select on sess to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.add_seat_call_time((select id from sess), now() + interval '200 minutes', gen_random_uuid()) $$,
  'a floor manager sets a time 3 hours 20 from now');
reset role;
select is((pg_temp.session()).call_time_minutes, 200, 'three hours and 20 minutes');
select is((select array_agg(minutes) from public.call_time_request where session_id = (select id from sess)), array[200], 'its request keeps the length to the time');

-- A request holds a length, never nought or more than a day.
select throws_ok($$ update public.call_time_request set minutes = 0 where session_id = (select id from sess) $$, '23514', null, 'a request is never for nought minutes');
select throws_ok($$ update public.call_time_request set minutes = 1441 where session_id = (select id from sess) $$, '23514', null, 'nor for more than a day');

-- A stake's call time written with a point is read as the whole number it is.
insert into public.setting (venue_id, key, subject, value, reason)
select t.venue_id, 'call_time.minutes', t.code, '{"minutes": 180.0}', 'test 424'
from public.table_type t where t.venue_id = '00000000-0000-4000-8000-000000000001' order by t.code limit 1;
select is(private.stake_call_time('00000000-0000-4000-8000-000000000001',
            (select t.code from public.table_type t where t.venue_id = '00000000-0000-4000-8000-000000000001' order by t.code limit 1)),
  180, 'a call time written 180.0 is 180 minutes');

select * from finish();
rollback;
