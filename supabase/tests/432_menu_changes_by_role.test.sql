-- Who changes the food and drink menu (redesign RD-33): staff who serve hide an item and show it again, and nothing else;
-- admins and super admins add, change, upload and delete; a deleted item stays on the orders that had it.
-- 103 Aditya is an admin and 101 Vikram a super admin (the seed); Sameer Rao, made here, is Service; 214 Yash orders.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
-- An item as the table holds it, whoever asks.
create function pg_temp.item(p_name text) returns public.fnb_item language sql security definer as $$
  select i from public.fnb_item i where i.venue_id = '00000000-0000-4000-8000-000000000001' and i.name = p_name;
$$;
grant execute on function pg_temp.item(text) to authenticated;

insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000004f2', 'authenticated', 'authenticated', '919999000432', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000004f2', 'Sameer Rao', 'Steward', 'service');
insert into ids select 'chai', (pg_temp.item('Masala chai')).id;

-- Service: hides an item and shows it again, and that is all.
select pg_temp.as_person('00000000-0000-4000-8000-0000000004f2');
select lives_ok($$ select public.set_fnb_item_available((select id from ids where name = 'chai'), false) $$, 'Service hides an item');
select is((pg_temp.item('Masala chai')).is_available, false, 'which is off the menu');
select lives_ok($$ select public.set_fnb_item_available((select id from ids where name = 'chai'), true) $$, 'and shows it again');
select is((pg_temp.item('Masala chai')).is_available, true, 'which is back on it');
select throws_ok($$ select public.save_fnb_item('00000000-0000-4000-8000-000000000001', 'Filter coffee', 'soft_drink', true, 40) $$, '42501', null,
  'Service adds no item');
select throws_ok($$ select public.save_fnb_item('00000000-0000-4000-8000-000000000001', 'Masala tea', 'soft_drink', true, 1, (select id from ids where name = 'chai')) $$,
  '42501', null, 'nor renames one');
select throws_ok($$ select public.save_fnb_menu('00000000-0000-4000-8000-000000000001', jsonb_build_array(jsonb_build_object('name', 'Filter coffee', 'kind', 'soft_drink'))) $$,
  '42501', null, 'nor uploads the menu');
select throws_ok($$ select public.delete_fnb_item((select id from ids where name = 'chai')) $$, '42501', null, 'nor deletes an item');
select throws_ok($$ insert into public.fnb_item (venue_id, name, kind) values ('00000000-0000-4000-8000-000000000001', 'Filter coffee', 'soft_drink') $$,
  '42501', null, 'nor writes to the table itself');
select is((pg_temp.item('Filter coffee')).id, null, 'so there is no such item');
select throws_ok($$ select public.set_fnb_item_available(gen_random_uuid(), false) $$, '42501', null, 'an item that is not there is hidden by nobody');
select throws_ok($$ select public.set_fnb_item_available((select id from ids where name = 'chai'), null) $$, '22023', null, 'and an item is on the menu or off it');

-- Yash orders a chai, so an order has it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1'), 6,
  '9000000214'), null, 'the floor seats Yash at Table 1');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
insert into ids select 'order', o.order_id
from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', (select id from ids where name = 'chai'), 'quantity', 2))) o;

-- An admin adds, changes, uploads and deletes.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.save_fnb_item('00000000-0000-4000-8000-000000000001', 'Filter coffee', 'soft_drink', true, 40), null, 'an admin adds an item');
select isnt(public.save_fnb_item('00000000-0000-4000-8000-000000000001', 'Filter kaapi', 'soft_drink', true, 40, (pg_temp.item('Filter coffee')).id), null, 'changes it');
select is(public.save_fnb_menu('00000000-0000-4000-8000-000000000001', jsonb_build_array(jsonb_build_object('name', 'Lime soda', 'kind', 'soft_drink'))), 1,
  'uploads the menu');
select lives_ok($$ select public.set_fnb_item_available((pg_temp.item('Lime soda')).id, false) $$, 'hides an item as Service does');
select lives_ok($$ select public.delete_fnb_item((select id from ids where name = 'chai')) $$, 'and deletes an item');
select is((pg_temp.item('Masala chai')).id, null, 'which is gone from the menu');
select throws_ok($$ select public.delete_fnb_item((select id from ids where name = 'chai')) $$, '42501', null, 'and cannot be deleted twice');
reset role;
select is((select o.lines -> 0 ->> 'name' from public.fnb_order o where o.id = (select id from ids where name = 'order')), 'Masala chai',
  'the order that had it still names it');
select is((select (o.lines -> 0 ->> 'quantity')::integer from public.fnb_order o where o.id = (select id from ids where name = 'order')), 2, 'with how many');
select is((select count(*)::integer from public.audit_log a where a.entity = 'fnb_item' and a.entity_id = (select id::text from ids where name = 'chai') and a.action like '%delete%'),
  1, 'and the deletion is in the audit log');

-- A super admin does the same.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.delete_fnb_item((pg_temp.item('Lime soda')).id) $$, 'a super admin deletes an item too');

-- Another venue's admin changes nothing here. The venue is made as the system, as in 221.
reset role;
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000004e1', 'Elsewhere', 'elsewhere-menu', false, 'Elsewhere Ltd', 'Somewhere', 'ELM');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000004e2', 'authenticated', 'authenticated', '919999000433', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000004e1', '00000000-0000-4000-8000-0000000004e2', 'Elsewhere Admin', 'Floor manager', 'admin');
select pg_temp.as_person('00000000-0000-4000-8000-0000000004e2');
select throws_ok($$ select public.delete_fnb_item((pg_temp.item('Filter kaapi')).id) $$, '42501', null, 'another venue''s admin deletes nothing here');
select throws_ok($$ select public.set_fnb_item_available((pg_temp.item('Filter kaapi')).id, false) $$, '42501', null, 'and hides nothing here');

-- No one signed out runs either.
reset role;
select is(has_function_privilege('anon', 'public.delete_fnb_item(uuid)', 'execute'), false, 'no one signed out deletes an item');
select is(has_function_privilege('anon', 'public.set_fnb_item_available(uuid, boolean)', 'execute'), false, 'or hides one');

select * from finish();
rollback;
