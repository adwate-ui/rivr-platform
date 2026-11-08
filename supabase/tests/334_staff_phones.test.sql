-- Colleagues' mobile numbers reach signed-in staff only through functions (decision 0513; audit F-022). Aditya (103, an
-- admin, staff.manage) reads them on the staff list; a dealer (106) reads the list without them; only a super admin
-- (101, control.engage) finds a staff member by number, for the kill switch.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temporary table cashier as
select s.id, s.phone from public.staff s
where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id = '00000000-0000-4000-8000-000000000104';
grant select on cashier to authenticated;
select isnt((select phone from cashier), null, 'the seeded cashier has a number');

-- A column added later without its grant fails here.
select is_empty($$ select c.column_name from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name = 'staff' and c.column_name <> 'phone'
                     and not has_column_privilege('authenticated', 'public.staff', c.column_name, 'select') $$,
                'signed-in callers read every staff column but phone');
select ok(not has_column_privilege('authenticated', 'public.staff', 'phone', 'select'), 'and never phone');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select phone from public.staff limit 1 $$, '42501', null, 'a dealer cannot read a colleague''s number from the table');
select is((select phone from public.venue_staff('00000000-0000-4000-8000-000000000001') where staff_id = (select id from cashier)),
          null, 'nor from the staff list');
select ok((select count(*) from public.venue_staff('00000000-0000-4000-8000-000000000001')) > 1, 'but sees the colleagues on it');
select is(public.staff_id_for_phone('00000000-0000-4000-8000-000000000001', (select phone from cashier)), null,
          'and finds nobody by number');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select phone from public.venue_staff('00000000-0000-4000-8000-000000000001') where staff_id = (select id from cashier)),
          (select phone from cashier), 'an admin who manages staff reads each number on the list');
select is((select staff_id from public.venue_staff('00000000-0000-4000-8000-000000000001') limit 1),
          (select s.id from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001'
           order by s.is_active desc, s.full_name limit 1), 'active first, then by name');
select is(public.staff_id_for_phone('00000000-0000-4000-8000-000000000001', (select phone from cashier)), null,
          'but only the kill switch finds a staff member by number');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(public.staff_id_for_phone('00000000-0000-4000-8000-000000000001', (select phone from cashier)), (select id from cashier),
          'a super admin finds the staff member with that number');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-0000000000e9');
select is((select count(*)::integer from public.venue_staff('00000000-0000-4000-8000-000000000001')), 0,
          'someone who is not staff there sees nobody');
reset role;

select * from finish();
rollback;
