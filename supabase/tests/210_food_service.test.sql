-- Food service (#640): the Service role holds fnb.manage and nothing of the floor or the cage. It reads tonight's orders
-- with when each was accepted and delivered and its age, and accepts and delivers them. 214 Yash orders from the app at
-- Table 1; 103 Aditya (admin) reads the same; 106 Pema, a dealer, reads none.
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
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', '919000000971', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f1', 'Sameer Rao', 'Steward', 'service');

select set_eq($$ select permission from public.role_permission where role = 'service' $$,
  $$ values ('fnb.serve'), ('sops.acknowledge'), ('incidents.log') $$, 'Service serves food and drink, and nothing else');

-- Yash orders a masala chai at Table 1.
insert into ids select 'chai', i.id from public.fnb_item i where i.venue_id = '00000000-0000-4000-8000-000000000001' and i.name = 'Masala chai';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1'), 6,
  '9000000214'), null, 'the floor seats Yash at Table 1');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
insert into ids select 'order', o.order_id
from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', (select id from ids where name = 'chai'), 'quantity', 1))) o;
reset role;
update public.fnb_order set created_at = created_at - interval '6 minutes' where id = (select id from ids where name = 'order');

select pg_temp.as_person('00000000-0000-4000-8000-0000000000f1');
select results_eq($$ select table_name, seat, accepted_at is null, age_seconds between 359 and 400 from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')
                     where order_id = (select id from ids where name = 'order') $$,
  $$ values ('Table 1'::text, 6, true, true) $$, 'Service sees the order waiting six minutes at Table 1, seat 6');
select lives_ok($$ select public.accept_fnb_order((select id from ids where name = 'order')) $$, 'accepts it');
select lives_ok($$ select public.deliver_fnb_order((select id from ids where name = 'order')) $$, 'and delivers it');
select results_eq($$ select accepted_at is not null, delivered_at is not null from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')
                     where order_id = (select id from ids where name = 'order') $$, $$ values (true, true) $$, 'it is delivered');
select is((select count(*)::integer from public.floor_seats('00000000-0000-4000-8000-000000000001')), 0, 'Service reads no seat map');
select is((select count(*)::integer from public.waitlist_board('00000000-0000-4000-8000-000000000001')), 0, 'nor the waitlist');
select throws_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001',
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1'), 6,
  jsonb_build_array(jsonb_build_object('item_id', (select id from ids where name = 'chai'), 'quantity', 1)), true) $$, '42501', null,
  'nor comps an order');
select is((select count(*)::integer from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001') > 0, true, 'but reads the menu');
select isnt(public.save_fnb_item('00000000-0000-4000-8000-000000000001', 'Filter coffee', 'soft_drink', true, 40), null, 'and sets it up');
select throws_ok($$ select * from public.glaza_statement('00000000-0000-4000-8000-000000000001', date '2026-11-01') $$, '42501', null,
  'and reads no Glaza statement');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select age_seconds between 359 and 400 from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') where order_id = (select id from ids where name = 'order')),
  true, 'the floor reads how long it took to deliver');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')), 0, 'a dealer reads no orders');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is((select count(*)::integer from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')), 0, 'another venue''s admin reads no orders here');
reset role;

select * from finish();
rollback;
