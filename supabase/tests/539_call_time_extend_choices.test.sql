-- Set and Extend call time from lists of their own (#1089, the owner, 19 Nov): a seat with no call time set offers and takes
-- the Set list (call_time.add_choices); once one is set, the Extend list (call_time.extend_choices), on the member's own Set
-- or Extend and on the floor's alike. Ishaan (211) and Vihaan (212) sit at Table 5 with three hours, 190 minutes in; 103
-- Aditya is a floor manager. The club sets Set to 60 and 120 minutes and Extend to 30 and 45.
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
create function pg_temp.seated(p_member text) returns public.seat_session language sql as $$
  select * from public.seat_session where member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid and ended_at is null;
$$;
create function pg_temp.floor(p_member text) returns table (lengths integer[], open integer[]) language sql as $$
  select add_time_choices, call_time_choices_open from public.floor_seats('00000000-0000-4000-8000-000000000001')
  where member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid;
$$;
create function pg_temp.free_seat() returns integer language sql as $$
  select min(n)::integer from generate_series(1, 10) n
  where not exists (select 1 from public.seat_session s where s.table_id = pg_temp.table_id('Table 5') and s.seat = n and s.ended_at is null);
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text), pg_temp.seated(text), pg_temp.floor(text), pg_temp.free_seat()
  to authenticated;

-- Both lists start alike: the Extend list is each venue's Set list, copied as the lists were split.
select ok((select bool_and(private.extend_time_choices(v.id) = private.add_time_choices(v.id)) from public.venue v),
  'every venue extends by the lengths it sets by until it changes either');

insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'call_time.add_choices', '', '{"minutes": [60, 120]}', now(), 'test 539'),
  ('00000000-0000-4000-8000-000000000001', 'call_time.extend_choices', '', '{"minutes": [30, 45]}', now(), 'test 539');
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || m)::uuid, 'call_time.view', true, 'test 539'
from unnest(array['211', '212']) m;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.table_id('Table 5'), pg_temp.free_seat(), p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 180);
select public.seat_member(pg_temp.table_id('Table 5'), pg_temp.free_seat(), p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000212'), p_call_minutes => 180);
reset role;
-- 190 minutes in, at this table since no earlier than tonight's 06:00 (no forgotten seat, private.seat_end_stamp).
update public.seat_session set started_at = now() - interval '190 minutes',
                               seated_here_at = greatest(now() - interval '190 minutes', private.tonight_began(now()))
where member_id in ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000212') and ended_at is null;
create temp table vihaan on commit drop as select (pg_temp.seated('212')).id as id;
grant select on vihaan to authenticated;

-- The member: Set from the Set list, then Extend from the Extend list.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select add_time_choices, call_time_choices_open from public.my_seat() $$,
  $$ values (array[60, 120], array[60, 120]) $$, 'none set yet: the app offers the Set list');
select throws_ok($$ select public.set_my_call_time(30, gen_random_uuid()) $$, 'RVCTC', null, 'a length only to extend by does not set it');
select lives_ok($$ select public.set_my_call_time(60, gen_random_uuid()) $$, 'an hour sets it');
select results_eq($$ select add_time_choices, call_time_choices_open from public.my_seat() $$,
  $$ values (array[30, 45], array[30, 45]) $$, 'once set, the app offers the Extend list');
select throws_ok($$ select public.set_my_call_time(120, gen_random_uuid()) $$, 'RVCTC', null, 'a length only to set by does not extend it');
select lives_ok($$ select public.set_my_call_time(45, gen_random_uuid()) $$, 'and 45 minutes extends it');

-- The floor: the same lists by the seat's state.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select lengths, open from pg_temp.floor('212') $$, $$ values (array[60, 120], array[60, 120]) $$,
  'the floor sees the Set list for a seat with none set');
select results_eq($$ select lengths, open from pg_temp.floor('211') $$, $$ values (array[30, 45], array[30, 45]) $$,
  'and the Extend list for one set');
select throws_ok($$ select public.add_seat_call_time((select id from vihaan), 45, gen_random_uuid()) $$, '22023', null,
  'the floor does not set a call time by a length only to extend by');
select lives_ok($$ select public.add_seat_call_time((select id from vihaan), 120, gen_random_uuid()) $$, 'two hours sets it');
select throws_ok($$ select public.add_seat_call_time((select id from vihaan), 60, gen_random_uuid()) $$, '22023', null,
  'nor extends by a length only to set by');
select lives_ok($$ select public.add_seat_call_time((select id from vihaan), 30, gen_random_uuid()) $$, 'and 30 minutes extends it');
select results_eq($$ select lengths from pg_temp.floor('212') $$, $$ values (array[30, 45]) $$, 'its seat now offers the Extend list');
reset role;

select * from finish();
rollback;
