-- Sessions' month totals count only the sessions a member still sees (decision 0320). Ishaan (211) played two sessions
-- just now, ten minutes and twenty; he hides the ten, and the month counts one session of twenty minutes.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Two closed visits just now, each with a session at Table 3: ten minutes played at seat 1, and twenty at seat 2.
create temp table played (id uuid, minutes integer, seat integer) on commit drop;
insert into played values (gen_random_uuid(), 10, 1), (gen_random_uuid(), 20, 2);
grant select on played to authenticated;

insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
select p.id, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
       now() - make_interval(mins => p.minutes + 2), now() - interval '30 seconds', 'door'
from played p;
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', p.id,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), p.seat,
       now() - make_interval(mins => p.minutes + 1), now() - make_interval(mins => p.minutes + 1), now() - interval '1 minute', 'left', 0
from played p;

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select month_sessions, month_played_seconds from public.my_sessions() where visit_id in (select id from played) limit 1 $$,
  $$ values (2, 1800::bigint) $$, 'two sessions this month, half an hour in all');
select lives_ok($$ select public.hide_my_session((select id from played where minutes = 10)) $$, 'he hides the ten minutes');
select results_eq($$ select month_sessions, month_played_seconds from public.my_sessions() where visit_id in (select id from played) $$,
  $$ values (1, 1200::bigint) $$, 'the month counts the session he still sees, and its twenty minutes');
reset role;

select * from finish();
rollback;
