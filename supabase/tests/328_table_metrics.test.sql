-- The MIS "Tables" view (the owner, 8 Nov). Ten club days ago Table 2 ran 07:00 to 11:00 IST. Ira sat 07:30 to 09:30 and
-- Mihir 08:30 to 10:30, then Ira again 10:00 to 10:30: 4 hours run, 2 members, at most 2 seated at once (Ira's return at
-- 10:00 is beside Mihir alone), 4 h 30 min played. Aditya (103, an admin who reads reports) reads it; a dealer (106)
-- reads nothing.
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
  select ((select d from day)::timestamp + p_time::time) at time zone 'Asia/Kolkata';
$$;
create temp table t2 as select id, seats from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2';
grant select on day, t2 to authenticated;
grant execute on function pg_temp.at(text) to authenticated;

insert into public.table_run (venue_id, table_id, opened_at, closed_at)
select '00000000-0000-4000-8000-000000000001', id, pg_temp.at('07:00'), pg_temp.at('11:00') from t2;
create function pg_temp.sat(p_visit uuid, p_member uuid, p_seat integer, p_from text, p_to text) returns void language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
  values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, pg_temp.at(p_from) - interval '5 minutes', pg_temp.at(p_to) + interval '5 minutes', 'door')
  on conflict (id) do nothing;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, (select id from t2), p_seat, pg_temp.at(p_from), pg_temp.at(p_from), pg_temp.at(p_to), 'left';
$$;
select pg_temp.sat('00000000-0000-4000-8000-0000000c3281', '00000000-0000-4000-8000-000000000211', 1, '07:30', '09:30');
select pg_temp.sat('00000000-0000-4000-8000-0000000c3282', '00000000-0000-4000-8000-000000000213', 2, '08:30', '10:30');
select pg_temp.sat('00000000-0000-4000-8000-0000000c3283', '00000000-0000-4000-8000-000000000211', 3, '10:00', '10:30');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select run_seconds, players, peak, player_seconds, seats from public.table_metrics('00000000-0000-4000-8000-000000000001',
       (select d from day), (select d from day)) where table_id = (select id from t2) $$,
  $$ select 14400::bigint, 2, 2, 16200::bigint, (select seats from t2) $$,
  'Table 2 ran 4 hours, two members sat there, two at most at once, 4 h 30 min played');
select is_empty($$ select 1 from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day) - 1, (select d from day) - 1)
                   where table_id = (select id from t2) $$, 'the club day before shows none of it');
select throws_ok($$ select * from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day) - 1) $$,
  '22023', null, 'a span that ends before it starts is refused');
select throws_ok($$ select * from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day) - 92, (select d from day)) $$,
  '22023', null, 'and one longer than 92 club days');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$,
  'a dealer, who reads no reports, reads nothing');
reset role;

select * from finish();
rollback;
