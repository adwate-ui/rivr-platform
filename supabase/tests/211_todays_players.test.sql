-- Today's players (#641): every member at the club on a club day, for staff who read members (103 Aditya), with their
-- status, check-in and check-out, waiting and the seconds on each table. The day here is yesterday's club day, from 07:00
-- IST, so the clock never splits it: 211 Ishaan played an hour at Table 3, then moved to Table 2 and plays on; 212 Vihaan
-- waits; 213 Mihir played forty minutes and left. 106 Pema, a dealer, reads none.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Another venue's admin, who reads nothing here (made first: a venue's settings start now).
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');

delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create function pg_temp.at(p_minutes integer) returns timestamptz language sql as $$
  select ((private.club_day_now() - 1) + time '07:00') at time zone 'Asia/Kolkata' + make_interval(mins => p_minutes);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text), pg_temp.at(integer) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create temp table yesterday as select private.club_day_now() - 1 as club_day;
grant select on yesterday to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Table 3'), 2, '9000000211');
insert into ids select 'mihir', public.seat_member(pg_temp.t('Table 1'), 5, '9000000213');
select isnt(public.add_to_waitlist(pg_temp.t('Table 1'), '9000000212', gen_random_uuid()), null,
  'Vihaan waits for 50/100');
reset role;
-- Ishaan: an hour at Table 3 from 07:00, then Table 2 from 08:00. Mihir: 07:10 to 07:50, checked out at 07:55. Vihaan: since 07:30.
update public.visit set opened_at = pg_temp.at(0)
where member_id in ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000213') and closed_at is null;
update public.seat_session set started_at = pg_temp.at(0), seated_here_at = pg_temp.at(60), table_id = pg_temp.t('Table 2'), seat = 7
where id = (select id from ids where name = 'ishaan');
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'ishaan'), pg_temp.t('Table 3'), 2, pg_temp.t('Table 2'), 7, pg_temp.at(60));
update public.seat_session set started_at = pg_temp.at(10), seated_here_at = pg_temp.at(10), ended_at = pg_temp.at(50), end_reason = 'left'
where id = (select id from ids where name = 'mihir');
update public.visit set closed_at = pg_temp.at(55), close_reason = 'door'
where member_id = '00000000-0000-4000-8000-000000000213' and closed_at is null;
update public.waitlist_entry set joined_at = pg_temp.at(30) where member_id = '00000000-0000-4000-8000-000000000212' and status = 'waiting';
insert into public.waitlist_entry (venue_id, member_id, table_type_id, status, joined_at, called_at, call_table_id, call_seat, hold_until, seated_at,
                                   idempotency_key)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', g.table_type_id, 'seated', pg_temp.at(0), pg_temp.at(5),
       g.id, 5, pg_temp.at(25), pg_temp.at(10), gen_random_uuid()
from public.game_table g where g.id = pg_temp.t('Table 1');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table seen as select * from public.todays_players('00000000-0000-4000-8000-000000000001', (select club_day from yesterday));
reset role;

select results_eq($$ select status, checked_in_at = pg_temp.at(0), checked_out_at is null, tables -> 1, (tables -> 0 ->> 'table'),
                            (tables -> 0 ->> 'seconds')::integer > 3600
                     from seen where full_name = 'Ishaan Verma' $$,
  $$ values ('playing'::text, true, true, '{"table": "Table 3", "seconds": 3600}'::jsonb, 'Table 2'::text, true) $$,
  'Ishaan plays on, checked in at 07:00: an hour at Table 3, then Table 2 since 08:00');
select results_eq($$ select status, waiting_seconds > 1800, tables from seen where full_name = 'Vihaan Kapoor' $$,
  $$ values ('waiting'::text, true, '[]'::jsonb) $$, 'Vihaan waits, since 07:30, at no table yet');
select results_eq($$ select status, checked_out_at = pg_temp.at(55), waiting_seconds, tables from seen where full_name = 'Mihir Shah' $$,
  $$ values ('left'::text, true, 600, '[{"table": "Table 1", "seconds": 2400}]'::jsonb) $$,
  'Mihir waited ten minutes until seated, and left at 07:55 after forty minutes at Table 1');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.todays_players('00000000-0000-4000-8000-000000000001') where full_name = 'Mihir Shah'), 0,
  'today, he is not on the list: he came yesterday');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.todays_players('00000000-0000-4000-8000-000000000001', (select club_day from yesterday))), 0, 'a dealer reads none');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is((select count(*)::integer from public.todays_players('00000000-0000-4000-8000-000000000001', (select club_day from yesterday))), 0,
  'another venue''s admin reads none');
reset role;

select is(has_function_privilege('anon', 'public.todays_players(uuid, date)', 'execute'), false, 'nobody signed out reads them');

select * from finish();
rollback;
