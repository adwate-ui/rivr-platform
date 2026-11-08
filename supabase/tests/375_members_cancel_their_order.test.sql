-- A member cancels an order they just sent (audit 8 Nov, F-048): Yash (214), seated at Table 3. 103 Aditya is an admin who
-- runs F&B; 213 Mihir is another member.
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

select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
insert into orders select 'first', order_id from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Masala chai'), 'quantity', 1)));

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.cancel_my_fnb_order((select id from orders where name = 'first')) $$, '42501', null, 'another member cannot cancel it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'fnb' $$, $$ values (1) $$, 'the console counts it');

select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select lives_ok($$ select public.cancel_my_fnb_order((select id from orders where name = 'first')) $$, 'he cancels it before the bar accepts it');
select lives_ok($$ select public.cancel_my_fnb_order((select id from orders where name = 'first')) $$, 'a second tap changes nothing');
select results_eq($$ select cancel_reason, accepted_at from public.my_fnb_orders() where order_id = (select id from orders where name = 'first') $$,
  $$ values ('Cancelled by the member'::text, null::timestamptz) $$, 'his tracker reads it as cancelled, with the fixed reason');
reset role;
select is((select count(*)::integer from public.audit_log where entity = 'fnb_order' and action = 'fnb_order.cancel' and entity_id = (select id::text from orders where name = 'first')),
  1, 'audited, once');
select is((select cancelled_by_staff_id from public.fnb_order where id = (select id from orders where name = 'first')), null, 'and no staff member did it');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'fnb' $$, 'the console''s count falls with it');
select results_eq($$ select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'fnbCancelled' $$, $$ values (1) $$, 'and the minute''s queue makes it chime');
reset role;

-- One order a minute: the second is placed as if the first were older.
update public.fnb_order set created_at = now() - interval '2 minutes' where id = (select id from orders where name = 'first');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
insert into orders select 'second', order_id from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Beer'), 'quantity', 1)));
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.accept_fnb_order((select id from orders where name = 'second')) $$, 'the bar accepts the next');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.cancel_my_fnb_order((select id from orders where name = 'second')) $$, '22023', null, 'and then it is not his to cancel');
reset role;

delete from public.member_feature_override where member_id = '00000000-0000-4000-8000-000000000214' and feature_key = 'fnb.table_side';
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'fnb.table_side', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.cancel_my_fnb_order((select id from orders where name = 'second')) $$, '42501', null, 'nor anything with table-side ordering taken away');

select * from finish();
rollback;
