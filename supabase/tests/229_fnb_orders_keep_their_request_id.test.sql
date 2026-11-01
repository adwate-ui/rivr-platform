-- A food and drink order from the app or the tablet keeps its request id (F3-18, F4-10): the same id again returns the
-- order it placed, with no second KOT; an id used for another order is refused (22023). Yash (214) at Table 3, seat 5,
-- as in 171_fnb_orders; Tablet A at Table 3 with Pema's (106) down; 103 Aditya seats him.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table chai on commit drop as
select jsonb_build_array(jsonb_build_object('item_id', id::text, 'quantity', 1)) as lines
from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Masala chai';
grant select on chai to authenticated;

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
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'fnb.table_side', true, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5, '9000000214'),
  null, 'Yash sits at Table 3, seat 5');

-- The app: the same request twice is one order.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
create temporary table first_app on commit drop as
select * from public.place_fnb_order((select lines from chai), '00000000-0000-4000-8000-0000000f0001');
select results_eq($$ select * from public.place_fnb_order((select lines from chai), '00000000-0000-4000-8000-0000000f0001') $$,
  $$ select * from first_app $$, 'the app''s order sent again with its request id is the same order, the same KOT');
select throws_ok($$ select * from public.place_fnb_order((select lines from chai), '00000000-0000-4000-8000-0000000f0002') $$,
  'RVFST', null, 'a new order inside the minute is still refused');

-- Mihir (213), seated beside him, cannot have Yash's order back with Yash's request id.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'fnb.table_side', true, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 6, '9000000213');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select * from public.place_fnb_order((select lines from chai), '00000000-0000-4000-8000-0000000f0001') $$,
  '22023', 'That request id was for another order', 'another member''s request id is refused, giving nothing of that order');

-- The tablet: the same request twice is one order; its id for another seat is refused.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table first_tablet on commit drop as
select * from public.tablet_fnb_order(5, (select lines from chai), '00000000-0000-4000-8000-0000000f0003');
select results_eq($$ select * from public.tablet_fnb_order(5, (select lines from chai), '00000000-0000-4000-8000-0000000f0003') $$,
  $$ select * from first_tablet $$, 'the tablet''s order sent again with its request id is the same order, the same KOT');
select throws_ok($$ select * from public.tablet_fnb_order(4, (select lines from chai), '00000000-0000-4000-8000-0000000f0003') $$,
  '22023', 'That request id was for another order', 'its request id for another seat is refused');
select throws_ok($$ select * from public.tablet_fnb_order(5, (select lines from chai), '00000000-0000-4000-8000-0000000f0001') $$,
  '22023', 'That request id was for another order', 'the app order''s request id from the tablet is refused');

reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::integer from public.fnb_order where member_id = '00000000-0000-4000-8000-000000000214'), 2,
  'two orders in all: one from the app, one from the tablet');
select is((select count(*)::integer from public.outbox_event where event_type = 'fnb.ordered'
           and payload ->> 'order_id' in (select order_id::text from first_app union select order_id::text from first_tablet)), 2,
  'and one KOT each for the bar');

select * from finish();
rollback;
