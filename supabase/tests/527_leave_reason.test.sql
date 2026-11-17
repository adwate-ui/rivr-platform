-- Why a player left the table, asked on every leave (#1060, the owner, 17 Nov). Ishaan (211) sits at Table 5; 103 Aditya
-- is the floor.
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
create function pg_temp.open_session() returns public.seat_session language sql as $$
  select * from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text), pg_temp.open_session() to authenticated;
create temp table sess (n integer, id uuid) on commit drop;
grant select, insert on sess to authenticated;

-- The floor seats Ishaan and he busts.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 0) $$, 'the floor seats Ishaan');
reset role;
insert into sess values (1, (pg_temp.open_session()).id);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.end_seat((select id from sess where n = 1), 'left', 'tired') $$, '22023', null,
  'a reason is one of the club''s list');
select lives_ok($$ select public.end_seat((select id from sess where n = 1), 'left', 'busted') $$, 'he leaves, busted');
reset role;
select is((select leave_reason from public.seat_session where id = (select id from sess where n = 1)), 'busted', 'the seat keeps why he left');
-- His first seat ran from 90 to 50 minutes ago: within this test's one transaction both leaves would share a moment.
update public.seat_session set started_at = now() - interval '90 minutes', seated_here_at = now() - interval '90 minutes', ended_at = now() - interval '50 minutes'
where id = (select id from sess where n = 1);

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select leave_reasons from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1)),
  array['busted'], 'his record''s visit says why he left the table');

-- Seated again with thirty minutes, played out: leaving from the app, he has met his call time.
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 3, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 30) $$, 'the floor seats him again');
reset role;
insert into sess values (2, (pg_temp.open_session()).id);
update public.seat_session set started_at = now() - interval '40 minutes', seated_here_at = now() - interval '40 minutes'
where id = (select id from sess where n = 2);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.leave_my_seat(), 'left', 'he leaves from the app, owing nothing');
reset role;
select is((select leave_reason from public.seat_session where id = (select id from sess where n = 2)), 'call_time_met',
  'leaving from the app owing nothing, his call time was met');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select leave_reasons from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1)),
  array['busted', 'call_time_met'], 'and the visit says why he left each table, in order (task review)');
reset role;

-- A seat still open has no reason to have left.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 4, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 0) $$, 'the floor seats him a third time');
reset role;
select throws_ok($$ update public.seat_session set leave_reason = 'busted' where id = (pg_temp.open_session()).id $$,
  '23514', null, 'a seat still open has no reason to have left');

select * from finish();
rollback;
