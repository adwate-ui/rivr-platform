-- Games history (#643): the tables run on each club day and the hours each ran, for the super admin (tables.manage: 101
-- Vikram). Yesterday Table 3 ran twice, an hour then half an hour, and Table 2 two hours; a host (111 Zoya) reads none.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create function pg_temp.at(p_minutes integer) returns timestamptz language sql as $$
  select ((private.club_day_now() - 1) + time '18:00') at time zone 'Asia/Kolkata' + make_interval(mins => p_minutes);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
create temp table yesterday as select private.club_day_now() - 1 as club_day;
grant select on yesterday to authenticated;

insert into public.table_run (venue_id, table_id, opened_at, closed_at) values
  ('00000000-0000-4000-8000-000000000001', pg_temp.t('Table 3'), pg_temp.at(0), pg_temp.at(60)),
  ('00000000-0000-4000-8000-000000000001', pg_temp.t('Table 3'), pg_temp.at(120), pg_temp.at(150)),
  ('00000000-0000-4000-8000-000000000001', pg_temp.t('Table 2'), pg_temp.at(0), pg_temp.at(120));

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select table_name, runs, seconds from public.games_history('00000000-0000-4000-8000-000000000001',
                       (select club_day from yesterday), (select club_day from yesterday)) order by table_name $$,
  $$ values ('Table 2'::text, 1, 7200), ('Table 3', 2, 5400) $$, 'yesterday: Table 2 ran two hours, Table 3 twice for an hour and a half');
select is((select count(*)::integer from public.games_history('00000000-0000-4000-8000-000000000001', (select club_day from yesterday) - 7,
                                                              (select club_day from yesterday) - 1)), 0, 'and nothing the week before');
select pg_temp.as_person('00000000-0000-4000-8000-000000000111');
select is((select count(*)::integer from public.games_history('00000000-0000-4000-8000-000000000001', (select club_day from yesterday),
                                                              (select club_day from yesterday))), 0, 'a host reads no games history');
reset role;

select is(has_function_privilege('anon', 'public.games_history(uuid, date, date)', 'execute'), false, 'nobody signed out reads it');

select * from finish();
rollback;
