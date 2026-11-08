-- The MIS "Tables" view (the owner, 8 Nov), one club day ten days ago (06:00 to 06:00 IST).
-- Table 2 ran 07:00 to 11:00. Ira sat 07:30 to 09:30 and again 10:00 to 10:30; Mihir 08:30 to 10:30; Kunal sat down at
-- Table 3 at 06:30 and was moved to Table 2 at 07:30, leaving at 08:00; Kavya sat down at 09:30 as Ira stood up. So
-- Table 2: 4 hours run, 4 members, at most 2 seated at once (a stand-up before a sit-down at the same moment), 5 h 30 min
-- played. Table 3 ran from 05:00 (the club day before) to 07:00, then from 10:00 to 08:00 the next morning: 1 hour and 20
-- hours inside the day, its one member's hour there. Aditya (103, an admin who reads reports) reads it; a dealer (106)
-- is refused, and so is the practice venue, as every report.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table day as select private.club_day_of(now()) - 10 as d;
create function pg_temp.at(p_time text) returns timestamptz language sql as $$
  select ((select d from day)::timestamp + p_time::interval) at time zone 'Asia/Kolkata';
$$;
create temp table tbl as select name, id, seats from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name in ('Table 2', 'Table 3');
grant select on day, tbl to authenticated;
grant execute on function pg_temp.at(text) to authenticated;

insert into public.table_run (venue_id, table_id, opened_at, closed_at)
select '00000000-0000-4000-8000-000000000001'::uuid, id, pg_temp.at('07:00'), pg_temp.at('11:00') from tbl where name = 'Table 2'
union all
select '00000000-0000-4000-8000-000000000001'::uuid, id, pg_temp.at('05:00'), pg_temp.at('07:00') from tbl where name = 'Table 3'
union all
select '00000000-0000-4000-8000-000000000001'::uuid, id, pg_temp.at('10:00'), pg_temp.at('32:00') from tbl where name = 'Table 3';

create function pg_temp.sat(p_visit uuid, p_member uuid, p_table text, p_seat integer, p_from text, p_to text) returns uuid language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
  values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, pg_temp.at(p_from) - interval '5 minutes', pg_temp.at(p_to) + interval '5 minutes', 'door')
  on conflict (id) do nothing;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, (select id from tbl where name = p_table), p_seat, pg_temp.at(p_from), pg_temp.at(p_from),
         pg_temp.at(p_to), 'left'
  returning id;
$$;
select pg_temp.sat('00000000-0000-4000-8000-0000000c3281', '00000000-0000-4000-8000-000000000211', 'Table 2', 1, '07:30', '09:30');
select pg_temp.sat('00000000-0000-4000-8000-0000000c3282', '00000000-0000-4000-8000-000000000213', 'Table 2', 2, '08:30', '10:30');
select pg_temp.sat('00000000-0000-4000-8000-0000000c3283', '00000000-0000-4000-8000-000000000211', 'Table 2', 3, '10:00', '10:30');
select pg_temp.sat('00000000-0000-4000-8000-0000000c3285', '00000000-0000-4000-8000-000000000290', 'Table 2', 4, '09:30', '10:00');
-- Kunal: seated on Table 2 at the end, moved there from Table 3 at 07:30.
create temp table kunal as select pg_temp.sat('00000000-0000-4000-8000-0000000c3284', '00000000-0000-4000-8000-000000000216', 'Table 2', 5, '06:30', '08:00') as id;
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
select '00000000-0000-4000-8000-000000000001', k.id, (select id from tbl where name = 'Table 3'), 6, (select id from tbl where name = 'Table 2'), 5, pg_temp.at('07:30')
from kunal k;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select t.name, m.run_seconds, m.players, m.peak, m.player_seconds
     from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) m
     join tbl t on t.id = m.table_id order by t.name $$,
  $$ values ('Table 2'::text, 14400::bigint, 4, 2, 19800::bigint), ('Table 3'::text, 75600::bigint, 1, 1, 3600::bigint) $$,
  'each table''s hours run, members, most at once and hours played: runs clipped to the day, the move split between tables');
select is_empty($$ select 1 from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day) - 2, (select d from day) - 2)
                   where table_id in (select id from tbl) $$, 'two club days before shows none of it');
select throws_ok($$ select * from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day) - 1) $$,
  '22023', null, 'a span that ends before it starts is refused');
select throws_ok($$ select * from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day) - 92, (select d from day)) $$,
  '22023', null, 'and one longer than 92 club days');
select throws_ok($$ select * from public.table_metrics('00000000-0000-4000-8000-000000000002', (select d from day), (select d from day)) $$,
  '22023', null, 'the practice venue has no reports');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select * from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$,
  '42501', null, 'a dealer, who reads no reports, is refused');
reset role;

select * from finish();
rollback;
