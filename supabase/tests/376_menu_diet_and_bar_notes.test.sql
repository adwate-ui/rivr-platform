-- The menu says what a dish is, and an order carries a note from a fixed list (audit 8 Nov, F-052). 103 Aditya runs F&B;
-- Yash (214) sits at Table 3.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table items on commit drop as select name, id::text as id from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on items to authenticated, service_role;
create function pg_temp.item(p_name text) returns text language sql as $$ select id from items where name = p_name; $$;
grant execute on function pg_temp.item(text) to authenticated;
create temporary table orders (name text primary key, id uuid) on commit drop;
grant select, insert on orders to authenticated;

-- Yash may order, and sits at Table 3, seat 5.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'fnb.table_side', true, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5, '9000000214'), null, 'Yash sits down');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.save_fnb_item('00000000-0000-4000-8000-000000000001', 'Test paneer roll', 'food', true, 900, null, 'veg', '  With mint chutney  '), null, 'an item is saved with its diet and description');
select results_eq($$ select diet, description from public.fnb_menu('00000000-0000-4000-8000-000000000001') where name = 'Test paneer roll' $$,
  $$ values ('veg'::text, 'With mint chutney'::text) $$, 'the menu has them, the description trimmed');
select results_eq($$ select diet, description from public.fnb_item where name = 'Test paneer roll' $$,
  $$ values ('veg'::text, 'With mint chutney'::text) $$, 'staff read them from the table too, as the console''s menu does');
select throws_ok($$ select public.save_fnb_item('00000000-0000-4000-8000-000000000001', 'Test bad', 'food', true, 901, null, 'fish') $$, '23514', null, 'a diet not on the list is refused');
select throws_ok($$ select public.save_fnb_item('00000000-0000-4000-8000-000000000001', 'Test long', 'food', true, 901, null, null, repeat('x', 141)) $$, '23514', null, 'and a description over 140 characters');

select is(public.save_fnb_menu('00000000-0000-4000-8000-000000000001', jsonb_build_array(
  jsonb_build_object('name', 'Test paneer roll', 'kind', 'food', 'is_available', null, 'diet', null, 'description', ''),
  jsonb_build_object('name', 'Test omelette', 'kind', 'food', 'is_available', null, 'diet', 'egg', 'description', 'Two eggs'))), 2, 'a file saves two');
select results_eq($$ select diet, description from public.fnb_menu('00000000-0000-4000-8000-000000000001') where name = 'Test paneer roll' $$,
  $$ values ('veg'::text, 'With mint chutney'::text) $$, 'blank in a file leaves an item as it is');
select results_eq($$ select diet, description from public.fnb_menu('00000000-0000-4000-8000-000000000001') where name = 'Test omelette' $$,
  $$ values ('egg'::text, 'Two eggs'::text) $$, 'a new one takes them from the file');
select throws_ok($$ select public.save_fnb_menu('00000000-0000-4000-8000-000000000001', jsonb_build_array(jsonb_build_object('name', 'Test bad', 'kind', 'food', 'diet', 'fish'))) $$, '22023', null,
  'a diet not on the list refuses the file');

select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select results_eq($$ select diet from public.my_fnb_menu() where name = 'Test omelette' $$, $$ values ('egg'::text) $$, 'the member''s menu has the mark');
insert into orders select 'noted', order_id from public.place_fnb_order(jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.item('Masala chai'), 'quantity', 1),
  jsonb_build_object('item_id', pg_temp.item('Beer'), 'quantity', 1, 'note', 'less_spicy,no_ice,my phone is 98765')));
reset role;
select results_eq($$ select lines -> 0 ->> 'note', lines -> 1 ->> 'note' from public.fnb_order where id = (select id from orders where name = 'noted') $$,
  $$ values (null::text, 'No ice, Less spicy'::text) $$, 'a note keeps the list''s words, in its order, and drops anything else');
select results_eq($$ select payload -> 'items' -> 1 ->> 'note' from public.outbox_event where event_type = 'fnb.ordered' and payload ->> 'order_id' = (select id::text from orders where name = 'noted') $$,
  $$ values ('No ice, Less spicy'::text) $$, 'and the KOT carries them to the bar');

select * from finish();
rollback;
