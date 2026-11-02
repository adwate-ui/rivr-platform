-- League points by hand (L-01): staff with points.give give them to members by their numbers, one or many at once from a
-- CSV, and the standings add them in. 103 Aditya gives (admin); 107 Ishita keeps the rewards (marketing) and does not;
-- 213 Mihir and 214 Yash are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table given as
select (select m.member_number from public.member m where m.id = '00000000-0000-4000-8000-000000000213') as mihir,
       (select m.member_number from public.member m where m.id = '00000000-0000-4000-8000-000000000214') as yash,
       gen_random_uuid() as request, private.league_month(now()) as month;
grant select on given to authenticated;

create function pg_temp.give(p_rows jsonb, p_reason text, p_request uuid) returns table (members integer, points bigint) language sql as $$
  select * from public.give_league_points('00000000-0000-4000-8000-000000000001', p_rows, p_reason, p_request);
$$;
grant execute on function pg_temp.give(jsonb, text, uuid) to authenticated;
create function pg_temp.row_of(p_number bigint, p_points bigint) returns jsonb language sql as $$
  select jsonb_build_object('member_number', p_number, 'points', p_points);
$$;
grant execute on function pg_temp.row_of(bigint, bigint) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select mihir from given), 40), pg_temp.row_of((select yash from given), 25)),
       'November League night', (select request from given)) $$,
  $$ values (2, 65::bigint) $$,
  'a CSV of two members gives each their points, in one go');
select results_eq(
  $$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select mihir from given), 40), pg_temp.row_of((select yash from given), 25)),
       'November League night', (select request from given)) $$,
  $$ values (2, 65::bigint) $$,
  'the same request again gives nothing more, and says what it gave');
select is((select l.hand_points from public.venue_league('00000000-0000-4000-8000-000000000001', (select month from given), (select month from given)) l
           where l.member_id = '00000000-0000-4000-8000-000000000213'), 40::bigint,
  'the console''s standings show them apart, in this League month');
select is((select count(*)::int from public.league_adjustment where venue_id = '00000000-0000-4000-8000-000000000001'), 2,
  'staff who give League points read what was given');
select is((select l.points - l.cash_points - l.tournament_points from public.venue_league('00000000-0000-4000-8000-000000000001', (select month from given), (select month from given)) l
           where l.member_id = '00000000-0000-4000-8000-000000000213'), 40::bigint,
  'and they count in the total, beside cash and tournament points');
reset role;
select is((select b.points from private.league_board('00000000-0000-4000-8000-000000000001') b where b.standing = 'month' and b.member_id = '00000000-0000-4000-8000-000000000213'),
          (select s.o_points from private.league_standings('00000000-0000-4000-8000-000000000001', (select month from given), (select month from given)) s where s.o_member_id = '00000000-0000-4000-8000-000000000213'),
  'the TVs, the website and the app rank this month by that total');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');

select throws_ok($$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of(987654321, 10)), 'A night', gen_random_uuid()) $$,
  'RVNOM', 'No such member at this venue', 'a number not at the club gives nothing');
select throws_ok($$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select mihir from given), 10), pg_temp.row_of((select mihir from given), 5)),
       'A night', gen_random_uuid()) $$, '22023', null, 'nor does a member twice in one CSV');
select throws_ok($$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select mihir from given), 0)), 'A night', gen_random_uuid()) $$,
  '22023', null, 'nor no points');
select throws_ok($$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select mihir from given), 10)), 'No', gen_random_uuid()) $$,
  '22023', null, 'nor a reason under three characters');
select throws_ok($$ select * from pg_temp.give('[]'::jsonb, 'A night', gen_random_uuid()) $$, '22023', null, 'nor an empty CSV');
reset role;
select is((select count(*)::int from public.league_adjustment a where a.request_id = (select request from given)), 2,
  'two points given, kept once each');
select throws_ok($$ update public.league_adjustment set points = 1 where request_id = (select request from given) $$,
  null, null, 'and never changed');

-- Elsewhere, a venue made here with its own admin (points.give, rewards.manage and fnb.manage there, nothing at the club).
-- Made as the system, as in 221: no one signed in.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Admin', 'admin');

-- Another venue's staff, with points.give there, see none of the club's League points and give none at the club.
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is((select count(*)::int from public.league_adjustment where venue_id = '00000000-0000-4000-8000-000000000001'), 0,
  'staff of another venue read none of the club''s League points');
select throws_ok($$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select mihir from given), 10)), 'A night', gen_random_uuid()) $$,
  '42501', null, 'and give none at the club');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select mihir from given), 10)), 'A night', gen_random_uuid()) $$,
  '42501', null, 'marketing keeps the rewards but gives no League points');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select yash from given), 10)), 'A night', gen_random_uuid()) $$,
  '42501', null, 'nor does a member');
select is((select count(*)::int from public.league_adjustment), 0, 'and a member reads none of them');
reset role;

-- A member who is staff too gives no League points to themselves: 213 Mihir, made a floor manager here for this.
insert into public.staff (venue_id, user_id, full_name, job_title, role)
select '00000000-0000-4000-8000-000000000001', m.user_id, m.full_name, 'Floor manager', 'admin'
from public.member m where m.id = '00000000-0000-4000-8000-000000000213';
select pg_temp.as_person((select m.user_id::text from public.member m where m.id = '00000000-0000-4000-8000-000000000213'));
select throws_ok($$ select * from pg_temp.give(jsonb_build_array(pg_temp.row_of((select mihir from given), 10)), 'A night', gen_random_uuid()) $$,
  '42501', null, 'nobody gives themselves League points');
reset role;

select * from finish();
rollback;
