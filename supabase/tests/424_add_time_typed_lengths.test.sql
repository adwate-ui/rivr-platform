-- More call time in lengths the club types (redesign RD-19): the setting takes whole minutes from 1 to 1,440, up to twelve;
-- a member asks for any length offered and the floor adds one, however odd. Ishaan (211) sits at Table 5 with three hours;
-- 103 is a floor manager (admin). The rule itself is proved on the golden file (024); the choices from before, kept as text,
-- in 277.
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
-- A value for the club's lengths, set from tomorrow, so each try stands alone.
create function pg_temp.set_lengths(p_minutes jsonb, p_days integer) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'call_time.add_choices', '', jsonb_build_object('minutes', p_minutes), now() + make_interval(days => p_days), 'test 424');
$$;
grant execute on function pg_temp.as_person(text), pg_temp.session() to authenticated;

-- What the setting takes.
select set_config('request.jwt.claims', '', true);
select lives_ok($$ select pg_temp.set_lengths('[1, 50, 1440]', 1) $$, 'any whole minutes from 1 to a day are a setting');
select lives_ok($$ select pg_temp.set_lengths('[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]', 2) $$, 'up to twelve of them');
select throws_ok($$ select pg_temp.set_lengths('[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130]', 3) $$, null, null, 'not thirteen');
select throws_ok($$ select pg_temp.set_lengths('[]', 3) $$, null, null, 'nor none at all');
select throws_ok($$ select pg_temp.set_lengths('[0]', 3) $$, null, null, 'nought minutes is no length');
select throws_ok($$ select pg_temp.set_lengths('[1441]', 3) $$, null, null, 'nor a minute past a day');
select throws_ok($$ select pg_temp.set_lengths('[45.5]', 3) $$, null, null, 'nor half a minute');
select throws_ok($$ select pg_temp.set_lengths('["50"]', 3) $$, null, null, 'nor a length as text, as the ticked presets were kept');

-- The club types 50 minutes and 3 hours 20: the seat offers them, shortest first. A length written with a point (50.0) is a
-- whole number to the schema, and one typed twice is offered once.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'call_time.add_choices', '', '{"minutes": [200, 50.0, 200]}', '-infinity', 'test 424');
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'call_time.view', true, 'test 424');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'),
                     2, p_member_number => (select member_number from public.member where id = '00000000-0000-4000-8000-000000000211'),
                     p_call_minutes => 180) $$, 'the floor seats Ishaan for three hours');
reset role;
create temp table sess on commit drop as select (pg_temp.session()).id as id;
grant select on sess to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.add_time_choices('00000000-0000-4000-8000-000000000001'), array[50, 200], 'the floor is offered 50 minutes and 3 hours 20');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select add_time_choices from public.my_seat()), array[50, 200], 'and so is the seat');

-- A member asks for a length offered, which was no preset; one not offered is refused as before.
select throws_ok($$ select public.request_call_time(60, gen_random_uuid()) $$, '22023', null, 'an hour is not offered');
create temp table asked on commit drop as select public.request_call_time(50, gen_random_uuid()) as id;
grant select on asked to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.decide_call_time_request((select id from asked), true) $$, 'the floor approves 50 minutes');
reset role;
select is((pg_temp.session()).call_time_minutes, 230, 'three hours and 50 minutes');

-- The floor adds the other length itself.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.add_seat_call_time((select id from sess), 200, gen_random_uuid()) $$, 'a floor manager adds 3 hours 20');
reset role;
select is((pg_temp.session()).call_time_minutes, 430, '7 hours 10 in all');
select is((select array_agg(minutes order by minutes) from public.call_time_request where session_id = (select id from sess)), array[50, 200], 'each request keeps its length');

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
