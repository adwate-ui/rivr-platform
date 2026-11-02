-- Food and drink orders close (decision 0302): staff who serve void an order not yet delivered, with a reason the member
-- sees; the floor orders for a seat; a comp stays for staff who run F&B. 103 Aditya (admin) seats 214 Yash at Table 3, seat 5;
-- Farida, the floor (made here: the seed has none), orders; Sameer (service) voids but orders nothing; 104 Sana (cashier)
-- serves nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', '919000000851', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f1', 'Farida Floor', 'Floor', 'floor', '+919000000851');
create temporary table items on commit drop as select name, id::text as id from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on items to authenticated;
create function pg_temp.lines(p_name text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('item_id', (select id from items where name = p_name), 'quantity', 1));
$$;
create function pg_temp.table3() returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
$$;
grant execute on function pg_temp.lines(text), pg_temp.table3() to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
-- Yash may order at the table, whatever his tier.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'fnb.table_side', true, 'The test orders for him');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.table3(), 5, '9000000214');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');
select throws_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table3(), 5, pg_temp.lines('Masala chai'), false) $$,
  '42501', null, 'Sameer, Service, who reads no members, orders for no seat');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000f1');
insert into ids select 'chai', o.order_id from public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table3(), 5,
  pg_temp.lines('Masala chai'), false) o;
select ok((select id from ids where name = 'chai') is not null, 'Farida, the floor, orders for Yash''s seat');
select throws_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table3(), 5, pg_temp.lines('Masala chai'), true) $$,
  '42501', null, 'but gives no comp, which is for staff who run F&B');
insert into ids select 'fries', o.order_id from public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table3(), 5,
  pg_temp.lines('French fries'), false) o;
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');

select throws_ok($$ select public.cancel_fnb_order((select id from ids where name = 'chai'), 'no') $$, '22023', null, 'a void needs a reason');
select lives_ok($$ select public.cancel_fnb_order((select id from ids where name = 'chai'), '  Out of milk  ') $$, 'Sameer voids the chai');
select throws_ok($$ select public.cancel_fnb_order((select id from ids where name = 'chai'), 'Again') $$, '22023', null, 'once');
select throws_ok($$ select public.accept_fnb_order((select id from ids where name = 'chai')) $$, '22023', null, 'a void order is not accepted');
select results_eq($$ select cancel_reason, age_seconds >= 0 from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')
                     where order_id = (select id from ids where name = 'chai') $$,
  $$ values ('Out of milk'::text, true) $$, 'the list shows it void, with the reason');
select is((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'fnb'),
  (select count(*)::integer from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') where delivered_at is null and cancelled_at is null),
  'and the rail counts it no more');

select lives_ok($$ select public.accept_fnb_order((select id from ids where name = 'fries')) $$, 'the fries are accepted');
select lives_ok($$ select public.deliver_fnb_order((select id from ids where name = 'fries')) $$, 'and delivered');
select throws_ok($$ select public.cancel_fnb_order((select id from ids where name = 'fries'), 'Too late') $$, '22023', null,
  'a delivered order is not voided');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cancel_fnb_order((select id from ids where name = 'fries'), 'Not mine') $$, '42501', null,
  'a cashier, who does not serve, voids nothing');

select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select results_eq($$ select cancel_reason from public.my_fnb_orders() where order_id = (select id from ids where name = 'chai') $$,
  $$ values ('Out of milk'::text) $$, 'Yash sees his chai void, and why');
reset role;
select ok(exists (select 1 from public.audit_log where action = 'fnb_order.cancel' and reason = 'Out of milk'), 'the void is audited with its reason');

-- The bar's agent prints the fries' KOT but finishes the void chai's unprinted.
insert into public.device (id, venue_id, kind, name) values ('00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-000000000001', 'agent', 'Bar agent');
create temp table claimed as select * from private.claim_agent_kots('00000000-0000-4000-8000-0000000000a9', 20);
select ok(not exists (select 1 from claimed where payload ->> 'order_id' = (select id::text from ids where name = 'chai')), 'the void chai is not printed');
select is((select d.last_error from public.outbox_delivery d join public.outbox_event e on e.id = d.event_id
           where e.payload ->> 'order_id' = (select id::text from ids where name = 'chai')), 'void', 'its KOT is finished as void');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');
select throws_ok($$ select public.mark_kot_sent((select id from ids where name = 'chai')) $$, '22023', null, 'nor is it marked sent by hand');
reset role;
select is((select kot_sent_at from public.fnb_order where id = (select id from ids where name = 'chai')), null, 'the void chai never reached the bar');

select * from finish();
rollback;
