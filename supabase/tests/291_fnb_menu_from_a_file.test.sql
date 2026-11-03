-- The menu from a file (#799): staff who run or serve F&B save many items at once, all or none. A name the menu has (in
-- any case) takes the file's kind, and whether it is on offer when the file says; a new one goes after the last item, in the
-- file's order. No price is kept.
-- 103 Aditya (admin) and a Service steward save; 106 Pema, a dealer, and another venue's admin do not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', '919000000971', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f1', 'Menu Steward', 'Steward', 'service');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.item(p_name text, p_kind text, p_is_available boolean) returns jsonb language sql as $$
  select jsonb_build_object('name', p_name, 'kind', p_kind, 'is_available', p_is_available);
$$;
grant execute on function pg_temp.item(text, text, boolean) to authenticated;
create function pg_temp.save(p_items jsonb) returns integer language sql as $$
  select public.save_fnb_menu('00000000-0000-4000-8000-000000000001', p_items);
$$;
grant execute on function pg_temp.save(jsonb) to authenticated;

create temp table before as
select max(i.position) as last, (select i2.position from public.fnb_item i2 where i2.venue_id = '00000000-0000-4000-8000-000000000001'
                                  and i2.name = 'Masala chai') as chai
from public.fnb_item i where i.venue_id = '00000000-0000-4000-8000-000000000001';
grant select on before to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.save(jsonb_build_array(pg_temp.item(' Old Monk and cola ', 'alcohol', true), pg_temp.item('Masala chai', 'soft_drink', false),
                                         pg_temp.item('Kokum sherbet', 'soft_drink', true))), 3,
  'the admin saves a file of three items in one go');
select results_eq(
  $$ select name, kind::text, is_available, position from public.fnb_item
     where venue_id = '00000000-0000-4000-8000-000000000001' and name in ('Old Monk and cola', 'Kokum sherbet') order by position $$,
  $$ values ('Old Monk and cola'::text, 'alcohol'::text, true, ((select last from before) + 1)::smallint),
            ('Kokum sherbet'::text, 'soft_drink'::text, true, ((select last from before) + 3)::smallint) $$,
  'new items go after the last one, in the file''s order, named without spaces around them');
select results_eq(
  $$ select is_available, position from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Masala chai' $$,
  $$ values (false, (select chai from before)) $$,
  'an item the menu has is changed where it stands');
select is(pg_temp.save(jsonb_build_array(pg_temp.item('Old Monk and cola', 'alcohol', false))), 1, 'the same file again changes what it says');
select is((select count(*)::integer from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Old Monk and cola'), 1,
  'and adds nothing twice');
select is(pg_temp.save(jsonb_build_array(pg_temp.item('MASALA CHAI', 'soft_drink', null), pg_temp.item('Aam panna', 'soft_drink', null))), 2,
  'a file that does not say whether its items are on offer saves');
select results_eq(
  $$ select name, is_available from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001'
     and lower(name) in ('masala chai', 'aam panna') order by name $$,
  $$ values ('Aam panna'::text, true), ('Masala chai'::text, false) $$,
  'leaving an item the menu has as it is, matched in any case and keeping its name, and putting a new one on offer');

select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.item('Lassi', 'soft_drink', true), pg_temp.item('LASSI', 'soft_drink', false))) $$,
  '22023', null, 'a name twice in one file, in any case, saves nothing');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.item('Lassi', 'dessert', true))) $$, '22023', null, 'nor a kind the menu has not');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.item('', 'food', true))) $$, '22023', null, 'nor an item with no name');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.item(repeat('x', 61), 'food', true))) $$, '22023', null, 'nor one over 60 characters');
select throws_ok($$ select pg_temp.save(jsonb_build_array(jsonb_build_object('name', 'Lassi', 'kind', 'food', 'is_available', 'maybe'))) $$,
  '22023', null, 'nor on offer that is not yes or no');
select throws_ok($$ select pg_temp.save('[]'::jsonb) $$, '22023', null, 'nor an empty file');
select throws_ok($$ select pg_temp.save((select jsonb_agg(pg_temp.item('Item ' || n, 'food', true)) from generate_series(1, 301) n)) $$,
  '22023', null, 'nor one over 300 items');
select is((select count(*)::integer from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Lassi'), 0,
  'none of those saved a line');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-0000000000f1');
select is(pg_temp.save(jsonb_build_array(pg_temp.item('Cold coffee', 'soft_drink', true))), 1, 'Service sets up the menu from a file too');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.item('Lassi', 'soft_drink', true))) $$, '42501', null, 'a dealer does not');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.item('Lassi', 'soft_drink', true))) $$, '42501', null,
  'nor another venue''s admin');
reset role;

insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Inspection');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.item('Lassi', 'soft_drink', true))) $$, 'RVFRZ', null, 'nothing is saved while the venue is frozen');
reset role;

select * from finish();
rollback;
