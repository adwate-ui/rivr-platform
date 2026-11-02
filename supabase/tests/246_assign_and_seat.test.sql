-- Assign from the waitlist and seat by membership number, each with a call time (decision 0299). The seed puts Kabir
-- (202), Naina (203) and Rohan (204) on 100/200; Tables 2, 3 and 5 are open at 100/200. 103 Aditya is the floor (an
-- admin); 106 Pema a dealer. Ishaan (211) has finished the check.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- This test's club night began twelve hours before it (#716), as 034's.
create temp table night_shift on commit drop as select now() - private.tonight_began(now()) - interval '12 hours' as shift;
grant select on night_shift to authenticated, anon, service_role;
create or replace function private.tonight_began(p_at timestamptz) returns timestamptz language sql stable set search_path = '' as $$
  select ((date_trunc('day', ((p_at - s.shift) at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata')
         + s.shift
  from pg_temp.night_shift s;
$$;

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.entry(p_member uuid) returns uuid language sql as $$
  select e.id from public.waitlist_entry e join public.table_type t on t.id = e.table_type_id
  where e.member_id = p_member and t.code = 'nlh_100_200' and e.status = 'waiting';
$$;
create function pg_temp.session(p_member uuid) returns public.seat_session language sql as $$
  select * from public.seat_session where member_id = p_member and ended_at is null;
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.table_id(text), pg_temp.entry(uuid), pg_temp.session(uuid), pg_temp.as_person(text) to authenticated;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', m.id, 'verified', 'digilocker', '1990-01-01', m.pan,
       '00000000-0000-4000-8000-000000000001/' || m.id || '/selfie.jpg', now()
from (values ('00000000-0000-4000-8000-000000000202'::uuid, 'ABCPK2022K'), ('00000000-0000-4000-8000-000000000204'::uuid, 'ABCPR2044R')) as m (id, pan);

-- Assign: Kabir to Table 3, seat 9, for four hours. He is seated at once, and the seat-ready message still goes.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table kabir_entry as select pg_temp.entry('00000000-0000-4000-8000-000000000202') as id;
grant select on kabir_entry to authenticated;
select lives_ok($$ select public.assign_from_waitlist((select id from kabir_entry), pg_temp.table_id('Table 3'), 9, 240) $$,
  'the floor assigns Kabir to Table 3, seat 9, for four hours');
reset role;
select results_eq($$ select s.seat, s.call_time_minutes, g.name from public.seat_session s join public.game_table g on g.id = s.table_id
                     where s.member_id = '00000000-0000-4000-8000-000000000202' and s.ended_at is null $$,
  $$ values (9, 240, 'Table 3'::text) $$, 'he is seated there, with his four hours');
select is((select status from public.waitlist_entry where id = (select id from kabir_entry)), 'seated', 'and off the list as seated');
select is((select count(*)::integer from public.outbox_event where event_type = 'waitlist.called'
           and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000202'), 1, 'the seat-ready message goes out');

-- A dealer is not the floor; a call time over a day is refused, and nothing is left half done.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.assign_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000204'), pg_temp.table_id('Table 2'), 1, 180) $$,
  '42501', null, 'a dealer assigns nobody');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.assign_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000204'), pg_temp.table_id('Table 2'), 1, 1500) $$,
  '22023', null, 'a call time is at most a day');
reset role;
select ok(pg_temp.session('00000000-0000-4000-8000-000000000204') is null
          and pg_temp.entry('00000000-0000-4000-8000-000000000204') is not null, 'Rohan is neither seated nor called');

-- Seat by membership number, with five hours; and by mobile number with the stake's own call time.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 300) $$,
  'the floor seats Ishaan by his membership number, for five hours');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 2'), 3, '90000 00204') $$, 'and Rohan by his number, as before');
select throws_ok($$ select public.seat_member(pg_temp.table_id('Table 2'), 4, p_member_number => 999999) $$, 'RVNOM', null,
  'a membership number nobody has is refused');
reset role;
select is((pg_temp.session('00000000-0000-4000-8000-000000000211')).call_time_minutes, 300, 'Ishaan has his five hours');
select is((pg_temp.session('00000000-0000-4000-8000-000000000204')).call_time_minutes,
  (private.setting_at('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'nlh_100_200', now()) ->> 'minutes')::integer,
  'Rohan has the stake''s own');

select * from finish();
rollback;
