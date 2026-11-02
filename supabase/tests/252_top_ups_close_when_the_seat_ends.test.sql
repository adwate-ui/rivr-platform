-- A top-up closes when its seat ends (decision 0302). 103 Aditya (admin) seats 211 Ishaan and 212 Vihaan; each asks for a
-- top-up; Ishaan's seat ends with his still open, Vihaan's is fulfilled first.
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
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Table 3'), 2, '9000000211');
insert into ids select 'vihaan', public.seat_member(pg_temp.t('Table 2'), 4, '9000000212');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select public.request_top_up();
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select public.request_top_up();
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.set_top_up((select id from ids where name = 'vihaan'), true);
select public.set_top_up((select id from ids where name = 'vihaan'), false);
select public.end_seat((select id from ids where name = 'ishaan'), 'left');
select public.end_seat((select id from ids where name = 'vihaan'), 'left');
reset role;

select results_eq($$ select r.outcome, r.closed_at = s.ended_at from public.top_up_request r join public.seat_session s on s.id = r.session_id
                     where r.session_id = (select id from ids where name = 'ishaan') $$,
  $$ values ('left'::text, true) $$, 'Ishaan''s open top-up closed as left, when his seat ended');
select is((select outcome from public.top_up_request where session_id = (select id from ids where name = 'vihaan')), 'fulfilled',
  'Vihaan''s, fulfilled before, stays fulfilled');
select is((select count(*)::integer from public.top_up_request where closed_at is null), 0, 'no top-up is left open');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select status from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') where full_name = 'Ishaan Verma'), 'left',
  'and Top-ups says he left');
reset role;

select * from finish();
rollback;
