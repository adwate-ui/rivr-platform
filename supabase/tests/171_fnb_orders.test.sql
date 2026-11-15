-- Table-side food and drink (#123): Yash (214), seated at Table 3, orders from the app, paid; the dealer's tablet orders
-- for his seat, paid; an admin at the console comps one. Each is posted to his visit with a KOT numbered for the night,
-- and fnb.ordered carries the KOT, naming no member. The bar is given a KOT by hand. 103 Aditya is an admin (fnb.manage),
-- 104 Sana a cashier, 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- The menu's ids, read now: members and tablets do not read the menu table, only fnb_menu.
create temporary table items on commit drop as select name, id::text as id from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on items to authenticated, service_role;
create function pg_temp.item(p_name text) returns text language sql as $$ select id from items where name = p_name; $$;
grant execute on function pg_temp.item(text) to authenticated;

-- The seed's floor is set aside: Tablet A at Table 3 with Pema's down, as in 037_log_hand.
delete from public.tablet_assignment;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select a.venue_id, a.table_id, s.id, a.device_id from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id;
-- Yash may order, and is 25 by his KYC.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'fnb.table_side', true, 'Test');
insert into public.kyc_record (venue_id, member_id, date_of_birth)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', (now() - interval '25 years')::date)
on conflict (member_id) do update set date_of_birth = excluded.date_of_birth;

select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select * from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Masala chai'), 'quantity', 1))) $$,
  'RVFNS', null, 'a member orders from their seat: not seated, no order');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5, '9000000214'),
  null, 'Yash sits at Table 3, seat 5');

select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select ok((select count(*) from public.fnb_menu('00000000-0000-4000-8000-000000000001') where kind = 'alcohol') > 0, 'at 25 the menu has alcohol');
select results_eq($$ select * from public.my_fnb_menu() $$, $$ select * from public.fnb_menu('00000000-0000-4000-8000-000000000001') $$,
  'his own menu is his venue''s');
create temporary table app_order on commit drop as
select * from public.place_fnb_order(jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.item('Masala chai'), 'quantity', 2, 'note', ' Less sugar '),
  jsonb_build_object('item_id', pg_temp.item('Beer'), 'quantity', 1)));
select is((select kot_number from app_order), 1, 'his order from the app is the night''s first KOT');
select throws_ok($$ select * from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Mineral water'), 'quantity', 1))) $$,
  'RVFST', null, 'one order a minute from the app');
reset role;

select results_eq(
  $$ select o.visit_id, o.is_comp, o.source, o.seat from public.fnb_order o where o.id = (select order_id from app_order) $$,
  $$ select s.visit_id, false, 'app'::text, 5 from public.seat_session s where s.member_id = '00000000-0000-4000-8000-000000000214' and s.ended_at is null $$,
  'posted to his seat''s visit, paid, from the app');
select is((select lines -> 0 ->> 'note' from public.fnb_order where id = (select order_id from app_order)), null,
  'and no line note is kept, so none outlives an erasure (#567)');
select results_eq(
  $$ select payload ->> 'kot_number', payload ->> 'table_name', (payload ->> 'seat')::integer, jsonb_array_length(payload -> 'items'), payload ? 'member_id'
     from public.outbox_event where event_type = 'fnb.ordered' and payload ->> 'order_id' = (select order_id::text from app_order) $$,
  $$ values ('1'::text, 'Table 3'::text, 5, 2, false) $$, 'fnb.ordered carries the KOT for the bar, and names no member');

-- At 20, no alcohol from the app.
update public.kyc_record set date_of_birth = (now() - interval '20 years')::date where member_id = '00000000-0000-4000-8000-000000000214';
update public.fnb_order set created_at = now() - interval '2 minutes' where id = (select order_id from app_order);
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is((select count(*)::integer from public.fnb_menu('00000000-0000-4000-8000-000000000001') where kind = 'alcohol'), 0, 'at 20 the menu has none');
select throws_ok($$ select * from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Whisky'), 'quantity', 1))) $$,
  'RVAGE', null, 'nor can he order it');
select throws_ok($$ select * from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Masala chai'), 'quantity', 0))) $$,
  '22023', null, 'a line is a quantity of 1 to 9');
reset role;
update public.fnb_item set is_available = false where id = pg_temp.item('Paneer tikka')::uuid;
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select * from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Paneer tikka'), 'quantity', 1))) $$,
  'RVFNI', null, 'an item switched off is not on the menu');
reset role;

-- The dealer orders for his seat, paid; an admin comps one from the console; a cashier cannot.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table tablet_order on commit drop as
select * from public.tablet_fnb_order(5, jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Club sandwich'), 'quantity', 1)));
select is((select kot_number from tablet_order), 2, 'the tablet orders for seat 5: the second KOT');
select throws_ok($$ select * from public.tablet_fnb_order(9, jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Club sandwich'), 'quantity', 1))) $$,
  'RVFNS', null, 'not for an empty seat');
reset role;
update public.dealer_down set ended_at = now() where device_id = '00000000-0000-4000-8000-00000000d001' and ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select * from public.tablet_fnb_order(5, jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Club sandwich'), 'quantity', 1))) $$,
  'RVDWN', null, 'nor with no dealer on their down');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temporary table comp_order on commit drop as
select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001',
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5,
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('French fries'), 'quantity', 1)), true);
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001', gen_random_uuid(), 5, '[]'::jsonb, true) $$,
  '42501', null, 'a cashier does not order from the console');
reset role;
select results_eq($$ select source, is_comp, placed_by_staff_id is not null from public.fnb_order order by kot_number $$,
  $$ values ('app'::text, false, false), ('tablet', false, true), ('console', true, true) $$,
  'app and tablet orders are paid; the console''s comp names the admin, as the tablet''s names the dealer');
select throws_ok($$ insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, kot_number, lines, is_comp, source)
                    select venue_id, visit_id, member_id, table_id, seat, club_day, 99, lines, true, 'app' from public.fnb_order limit 1 $$,
  '23514', null, 'only the console comps');

-- Tonight's orders for staff who run F&B; the bar is handed the app's KOT by hand.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')), 3, 'staff who run F&B see tonight''s orders');
select lives_ok($$ select public.mark_kot_sent((select order_id from app_order)) $$, 'and mark the app''s KOT given to the bar by hand');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.fnb_order), 0, 'another member sees none of Yash''s orders');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is((select count(*)::integer from public.fnb_order), 3, 'Yash sees his own');
reset role;

select results_eq($$ select kot_number, kot_sent_by from public.fnb_order order by kot_number $$,
  $$ values (1, 'staff'::text), (2, null), (3, null) $$,
  'the KOT given by hand says so, and the others wait on the console''s list');

-- An order's way to the seat (#635): Yash follows his own orders tonight; staff who run F&B accept one, then deliver it.
select set_config('request.jwt.claims', '', true);
create temp table yash_app_order as
select id from public.fnb_order where member_id = '00000000-0000-4000-8000-000000000214' and source = 'app' order by created_at limit 1;
grant select on yash_app_order to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select ok((select count(*) from public.my_fnb_orders()) >= 1 and (select bool_and(accepted_at is null and delivered_at is null) from public.my_fnb_orders()),
  'Yash sees his orders tonight, each still placed');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.accept_fnb_order((select id from yash_app_order)) $$, '42501', null, 'a cashier does not accept orders');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.deliver_fnb_order((select id from yash_app_order)) $$, '22023', null, 'an order is accepted before it is delivered');
select lives_ok($$ select public.accept_fnb_order((select id from yash_app_order)) $$, 'Aditya accepts it');
select throws_ok($$ select public.accept_fnb_order((select id from yash_app_order)) $$, '22023', null, 'once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select isnt((select accepted_at from public.my_fnb_orders() where order_id = (select id from yash_app_order)), null, 'Yash sees it in progress');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.deliver_fnb_order((select id from yash_app_order)) $$, 'and delivers it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select isnt((select delivered_at from public.my_fnb_orders() where order_id = (select id from yash_app_order)), null, 'Yash sees it delivered');
reset role;
select is(has_function_privilege('anon', 'public.my_fnb_orders()', 'execute'), false, 'nobody signed out reads orders');

select * from finish();
rollback;
