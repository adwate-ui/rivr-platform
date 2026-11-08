-- A session per table (the owner, 9 Nov). Ishaan (211) came for one visit: an hour at Table 1, then moved to Table 2 for
-- forty minutes. He sees two sessions, newest first, each with its own table, times and time played; the month counts
-- two. He hides the Table 1 one and still sees Table 2's; a visit hidden the old way, by its id, hides both.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table at (name text, id uuid) on commit drop;
insert into at select g.name, g.id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name in ('Table 1', 'Table 2');
create temp table one_visit as select gen_random_uuid() as visit_id, gen_random_uuid() as session_id;
grant select on at, one_visit to authenticated;

-- In at 2 h 10 min ago, seated at Table 1 two hours ago, moved to Table 2 an hour ago, left forty minutes later.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
select visit_id, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
       now() - interval '130 minutes', now() - interval '15 minutes', 'door' from one_visit;
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, call_time_minutes)
select session_id, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', visit_id,
       (select id from at where name = 'Table 2'), 4, now() - interval '120 minutes', now() - interval '60 minutes', now() - interval '20 minutes', 'left', 0
from one_visit;
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
select '00000000-0000-4000-8000-000000000001', session_id, (select id from at where name = 'Table 1'), 3,
       (select id from at where name = 'Table 2'), 4, now() - interval '60 minutes'
from one_visit;

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq(
  $$ select table_name, extract(epoch from now() - opened_at)::integer / 60, extract(epoch from now() - closed_at)::integer / 60, played_seconds / 60
     from public.my_sessions() where visit_id = (select visit_id from one_visit) order by opened_at desc $$,
  $$ values ('Table 2'::text, 60, 20, 40::bigint), ('Table 1', 120, 60, 60) $$,
  'a session for each table, newest first: Table 2 for forty minutes, Table 1 for an hour before it');
select is((select count(distinct session_id)::integer from public.my_sessions() where visit_id = (select visit_id from one_visit)), 2,
  'each its own session');
select is((select month_sessions from public.my_sessions() where visit_id = (select visit_id from one_visit) limit 1)
          - (select count(*)::integer from public.my_sessions() where visit_id <> (select visit_id from one_visit)
               and month = (select month from public.my_sessions() where visit_id = (select visit_id from one_visit) limit 1)),
  2, 'and the month counts both');

select lives_ok($$ select public.hide_my_session((select session_id from public.my_sessions() where table_name = 'Table 1'
                                                    and visit_id = (select visit_id from one_visit))) $$, 'he hides the Table 1 session');
select results_eq($$ select table_name from public.my_sessions() where visit_id = (select visit_id from one_visit) $$,
  $$ values ('Table 2'::text) $$, 'and still sees Table 2''s');
reset role;

-- Hidden by the visit's id, as sessions were before: all of the visit's go.
update public.member_preference set hidden_sessions = array[(select visit_id from one_visit)] where member_id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.my_sessions() where visit_id = (select visit_id from one_visit) $$,
  'a visit hidden the old way hides every table of it');
reset role;

-- A visit of two tables each under a minute keeps the longer: it never drops out of the history.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
values ('00000000-0000-4000-8000-0000000c3301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
        now() - interval '10 minutes', now() - interval '5 minutes', 'door');
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, call_time_minutes)
values ('00000000-0000-4000-8000-0000000c3302', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
        '00000000-0000-4000-8000-0000000c3301', (select id from at where name = 'Table 2'), 5, now() - interval '9 minutes',
        now() - interval '540 seconds' + interval '30 seconds', now() - interval '540 seconds' + interval '70 seconds', 'left', 0);
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c3302', (select id from at where name = 'Table 1'), 3,
        (select id from at where name = 'Table 2'), 5, now() - interval '540 seconds' + interval '30 seconds');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select table_name from public.my_sessions() where visit_id = '00000000-0000-4000-8000-0000000c3301' $$,
  $$ values ('Table 2'::text) $$, 'a visit of two tables each under a minute keeps the longer');
reset role;

select * from finish();
rollback;
