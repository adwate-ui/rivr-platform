-- Reports › Tables over longer spans (8 Nov audit, I-77, F-107), one club day ten days ago. Table 2 ran 07:00 to 11:00 with Ishaan seated 07:30
-- to 09:30; Table 3 ran 08:00 to 12:00 with Mihir seated 08:30 to 09:30 and Ishaan 10:00 to 11:00. So each table's most at once is 1 while the
-- room's is 2, and the two members count once each. The day before, Mihir sat an hour at Table 2. Table 1 did not run. Table 4 is inactive and
-- ran an hour; Table 5 is inactive and did not.
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
create temp table tbl as select name, id, seats from public.game_table
  where venue_id = '00000000-0000-4000-8000-000000000001' and name in ('Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5');
grant select on day, tbl to authenticated;
grant execute on function pg_temp.at(text) to authenticated;

insert into public.table_run (venue_id, table_id, opened_at, closed_at)
select '00000000-0000-4000-8000-000000000001'::uuid, id, pg_temp.at('07:00'), pg_temp.at('11:00') from tbl where name = 'Table 2'
union all
select '00000000-0000-4000-8000-000000000001'::uuid, id, pg_temp.at('08:00'), pg_temp.at('12:00') from tbl where name = 'Table 3'
union all
select '00000000-0000-4000-8000-000000000001'::uuid, id, pg_temp.at('09:00'), pg_temp.at('10:00') from tbl where name = 'Table 4';

create function pg_temp.sat(p_visit uuid, p_member uuid, p_table text, p_seat integer, p_from text, p_to text) returns uuid language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
  values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, pg_temp.at(p_from) - interval '5 minutes', pg_temp.at(p_to) + interval '5 minutes', 'door')
  on conflict (id) do nothing;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, (select id from tbl where name = p_table), p_seat, pg_temp.at(p_from), pg_temp.at(p_from),
         pg_temp.at(p_to), 'left'
  returning id;
$$;
select pg_temp.sat('00000000-0000-4000-8000-0000000c3891', '00000000-0000-4000-8000-000000000211', 'Table 2', 1, '07:30', '09:30');
select pg_temp.sat('00000000-0000-4000-8000-0000000c3892', '00000000-0000-4000-8000-000000000213', 'Table 3', 2, '08:30', '09:30');
select pg_temp.sat('00000000-0000-4000-8000-0000000c3893', '00000000-0000-4000-8000-000000000211', 'Table 3', 3, '10:00', '11:00');
-- The club day before: 07:00 to 08:00, seventeen hours before the day's midnight.
select pg_temp.sat('00000000-0000-4000-8000-0000000c3894', '00000000-0000-4000-8000-000000000213', 'Table 2', 4, '-17:00', '-16:00');

update public.game_table set is_open = false, active = false where id in (select id from tbl where name in ('Table 4', 'Table 5'));

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select t.name, m.run_seconds, m.players, m.peak, m.player_seconds, m.previous_player_seconds
     from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) m
     join tbl t on t.id = m.table_id order by t.name $$,
  $$ values ('Table 1'::text, 0::bigint, 0, 0, 0::bigint, 0::bigint),
            ('Table 2', 14400, 1, 1, 7200, 3600),
            ('Table 3', 14400, 2, 1, 7200, 0),
            ('Table 4', 3600, 0, 0, 0, 0) $$,
  'an active table at nothing is listed, an inactive one only if it ran; each with its player hours the day before');

select results_eq(
  $$ select run_seconds, seat_seconds, players, peak, player_seconds, previous_player_seconds
     from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$,
  $$ select 32400::bigint, 14400 * (select seats from tbl where name = 'Table 2')::bigint + 14400 * (select seats from tbl where name = 'Table 3') + 3600 * (select seats from tbl where name = 'Table 4'),
            2::bigint, 2::bigint, 14400::bigint, 3600::bigint $$,
  'the room: a member at two tables once, the most at once across it, hours and seat-seconds summed');
select is((select seats from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day))),
          (select sum(seats)::bigint from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day))),
          'the seats of the tables listed');

select results_eq(
  $$ select t.name, m.player_seconds, m.previous_player_seconds
     from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day) - 1, (select d from day)) m
     join tbl t on t.id = m.table_id where t.name = 'Table 2' $$,
  $$ values ('Table 2'::text, 10800::bigint, 0::bigint) $$, 'the span before is of the same length, here two days');
select is((select count(*)::integer from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day) - 91, (select d from day))
           where table_name = 'Table 1'), 1, '92 days may be asked for');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day) - 92, (select d from day)) $$,
                 '22023', null, 'and no more');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day) - 1) $$,
                 '22023', null, 'nor backwards');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000002', (select d from day), (select d from day)) $$,
                 '22023', null, 'and the practice venue has no reports');

-- A span still running is set against the span before only as far as the same point in it: today so far, and a sitting that filled yesterday,
-- which counts up to this hour yesterday. As Aditya, kept in the claims, with the role put back to write the fixtures.
reset role;
create temp table today as select private.club_day_of(now()) as d, (private.club_day_of(now())::timestamp + interval '6 hours') at time zone 'Asia/Kolkata' as starts_at;
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000103', 'role', 'authenticated')::text, true);
create temp table earlier as
  select (select m.previous_player_seconds from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from today), (select d from today)) m where m.table_name = 'Table 1') as on_table,
         (select t.previous_player_seconds from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from today), (select d from today)) t) as in_room;
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-0000000c3895', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', starts_at - interval '1 day', starts_at - interval '1 minute', 'door' from today;
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-0000000c3895', (select id from tbl where name = 'Table 1'), 7,
       starts_at - interval '1 day', starts_at - interval '1 day', starts_at - interval '1 minute', 'left' from today;
create temp table up_to_now as
  select extract(epoch from (least(now() - interval '1 day', starts_at - interval '1 minute') - (starts_at - interval '1 day')))::bigint as seconds from today;
select ok(abs((select m.previous_player_seconds from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from today), (select d from today)) m where m.table_name = 'Table 1')
              - (select on_table from earlier) - (select seconds from up_to_now)) <= 1,
          'a table''s player hours before count only as far as this hour yesterday');
select ok(abs((select t.previous_player_seconds from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from today), (select d from today)) t)
              - (select in_room from earlier) - (select seconds from up_to_now)) <= 1,
          'and the room''s');

-- Every other role is refused, as every report.
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$, '42501', null, 'an investor reads no totals');
select throws_ok($$ select * from public.table_metrics('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$, '42501', null, 'nor the tables');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$, '42501', null, 'nor marketing');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$, '42501', null, 'nor service staff');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$, '42501', null, 'nor a dealer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$, '42501', null, 'nor a member');
reset role;
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000216', 'Practice Owner', 'Owner', 'super_admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select throws_ok($$ select * from public.table_metrics_total('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$, '42501', null, 'nor another venue''s super admin');
reset role;
select ok(not has_function_privilege('anon', 'public.table_metrics_total(uuid, date, date)', 'execute'), 'nor anybody signed out');
select ok(not has_function_privilege('authenticated', 'private.table_stints(uuid, date, date, timestamptz)', 'execute'), 'and the helpers are the definer''s alone');
select ok(not has_function_privilege('authenticated', 'private.table_run_seconds(uuid, date, date)', 'execute'), 'each of them');
select ok(not has_function_privilege('authenticated', 'private.assert_table_span(uuid, date, date)', 'execute'), 'each of them');

select * from finish();
rollback;
