-- Call time at the cage (#79; additions flow 13). Yash Gupta (214) and Ritika Das (215) have finished
-- their identity checks (seed). A floor manager (103, an admin) seats Yash in the Private Room, where
-- call time is three hours. 104 is a cashier; 106 a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.table_id(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'yash', public.seat_member(pg_temp.table_id('Private Room'), 1, '9000000214');

-- The cashier sees what Yash owes, and cannot cash him out.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select call_time_owed_seconds between 10600 and 10800, is_let_go_early from public.cage_members('00000000-0000-4000-8000-000000000001', 'Yash') $$,
  $$ values (true, false) $$, 'the cage shows the three hours Yash still owes');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 100000, 'cash',
  gen_random_uuid(), true) $$, 'RVCTS', null, 'a cash-out before call time is refused');
select throws_ok($$ select public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'Family emergency') $$,
  '42501', null, 'a cashier cannot let him go early');

-- An admin lets him go, with a reason; the early departure is kept once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', ' ok ') $$,
  '22023', null, 'an admin says why');
insert into ids select 'early', public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'Family emergency');
select is(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'Again'),
  (select id from ids where name = 'early'), 'letting him go twice keeps one early departure');
select results_eq($$ select session_id, reason, shortfall_seconds between 10600 and 10800, s.full_name from public.early_departure e
                     join public.staff s on s.id = e.overridden_by_staff_id where e.id = (select id from ids where name = 'early') $$,
  $$ select (select id from ids where name = 'yash'), 'Family emergency'::text, true, (select full_name from public.staff
             where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001') $$,
  'it keeps his seat, the shortfall, the reason and the admin');

-- Now the cash-out goes through: the final one ends his seat and closes his visit.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select is_let_go_early from public.cage_members('00000000-0000-4000-8000-000000000001', 'Yash') $$, $$ values (true) $$,
  'the cage sees he may go');
select results_eq($$ select to_member_paise, is_visit_closed from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000214', 100000, 'cash', gen_random_uuid(), true) $$, $$ values (100000::bigint, true) $$,
  'and cashes him out');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'After') $$,
  'RVCTD', null, 'once he has gone there is nothing to let go');

-- A player who left the table before call time still owes it at the cage.
insert into ids select 'ritika', public.seat_member(pg_temp.table_id('Private Room'), 2, '9000000215');
select public.end_seat((select id from ids where name = 'ritika'), 'left');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 100000, 'cash',
  gen_random_uuid()) $$, 'RVCTS', null, 'Ritika left the table early, so the cage still needs an admin');
reset role;
select is(private.call_time_shortfall('00000000-0000-4000-8000-000000000215', now()) > 0, true, '#78''s shortfall reads the same seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.left_owing_call_time('00000000-0000-4000-8000-000000000001') $$, 'the cashier has no list to let her go from');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select full_name, table_name, owed_seconds > 0 from public.left_owing_call_time('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Ritika Das'::text, 'Private Room'::text, true) $$, 'the admin sees her among those who left before call time');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 'Feeling unwell'), null,
  'and lets her go though her seat has ended');
select is_empty($$ select * from public.left_owing_call_time('00000000-0000-4000-8000-000000000001') $$, 'so she leaves the list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215',
  100000, 'cash', gen_random_uuid()) $$, $$ values (100000::bigint) $$, 'and the cage cashes her out');
reset role;

-- Who sees early departures.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.early_departure), 2, 'the cashier sees the early departures');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select id from public.early_departure $$, 'a dealer does not');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is_empty($$ select id from public.early_departure $$, 'nor does Yash read the record itself');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select id from public.early_departure $$, 'nor the practice venue''s cashier');
reset role;
select throws_ok($$ update public.early_departure set reason = 'Changed' $$, null, null, 'an early departure is never changed');

-- Frozen: nobody is let go.
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000215', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 'Family emergency') $$,
  'RVMBR', null, 'a frozen member is not let go early');
reset role;

select * from finish();
rollback;
