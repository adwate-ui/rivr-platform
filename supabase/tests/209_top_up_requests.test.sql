-- Top-up requests (#639): each one is kept, and the floor and the cashier (members.read: 103 Aditya, 104 Sana) see tonight's
-- by table with its status and, once fulfilled, the time it took. 211 Ishaan and 212 Vihaan are seated; 106 Pema a dealer.
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
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.status_of(p_name text) returns text language sql as $$
  select status from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') where full_name = p_name order by requested_at desc limit 1;
$$;
grant execute on function pg_temp.status_of(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Table 3'), 2, '9000000211');
insert into ids select 'vihaan', public.seat_member(pg_temp.t('Table 2'), 4, '9000000212');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select lives_ok($$ select public.request_top_up() $$, 'Ishaan asks for a top-up');
select lives_ok($$ select public.request_top_up() $$, 'and again, which keeps one request');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.request_top_up() $$, 'Vihaan asks for one');
reset role;
select is((select count(*)::integer from public.top_up_request), 2, 'two requests are kept');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select table_name, seat, status, fulfilled_seconds from public.top_ups_tonight('00000000-0000-4000-8000-000000000001')
                     order by table_name $$,
  $$ values ('Table 2'::text, 4, 'requested'::text, null::integer), ('Table 3', 2, 'requested', null) $$,
  'the floor sees both by table, requested');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'ishaan'), true) $$, 'takes Ishaan''s in hand');
select is(pg_temp.status_of('Ishaan Verma'), 'in_progress', 'it is in progress');
reset role;
update public.top_up_request set requested_at = requested_at - interval '4 minutes', started_at = started_at - interval '1 minute'
where session_id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'ishaan'), false) $$, 'and resets it once done');
select results_eq($$ select status, fulfilled_seconds between 239 and 245 from public.top_ups_tonight('00000000-0000-4000-8000-000000000001')
                     where full_name = 'Ishaan Verma' $$,
  $$ values ('fulfilled'::text, true) $$, 'so it is fulfilled, in four minutes');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'vihaan'), false) $$, 'Vihaan''s, never taken in hand, is reset');
select is(pg_temp.status_of('Vihaan Kapoor'), 'reset', 'and reads as reset, with no time');
reset role;

-- A player who leaves with a request open: it reads as left.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select lives_ok($$ select public.request_top_up() $$, 'Ishaan asks again');
reset role;
update public.seat_session set ended_at = now(), end_reason = 'left' where id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is(pg_temp.status_of('Ishaan Verma'), 'left', 'the cashier sees his last one as left with him');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.top_ups_tonight('00000000-0000-4000-8000-000000000001')), 0, 'a dealer sees none');
select throws_ok($$ select * from public.top_up_request $$, '42501', null, 'nor reads the table');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is((select count(*)::integer from public.top_ups_tonight('00000000-0000-4000-8000-000000000001')), 0, 'another venue''s admin reads none');
reset role;

select is(has_function_privilege('anon', 'public.top_ups_tonight(uuid)', 'execute'), false, 'nobody signed out reads them');

select * from finish();
rollback;
