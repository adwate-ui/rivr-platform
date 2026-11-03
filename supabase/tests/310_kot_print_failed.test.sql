-- The console's flag on a KOT the bar printer did not get (console v3): fnb_orders_tonight says so from the bar_printer
-- consumer's own state in the outbox, never from a clock. Yash (214) sits at Table 3; Aditya (103), an admin who runs
-- F&B, orders five KOTs for his seat. The cage agent fails three, prints one, and keeps one printing. The flag goes once
-- the bar has the KOT: handed over by hand, accepted or delivered; while the agent tries again; and for a void order. A
-- practice-venue order never reaches the bar printer, and staff read only their own venue's orders.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table items on commit drop as select venue_id, name, id::text as id from public.fnb_item;
grant select on items to authenticated;
create temporary table orders (kot integer, order_id uuid);
grant select, insert on orders to authenticated, service_role;
create function pg_temp.table_at(p_venue text, p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = p_venue::uuid and name = p_name and active;
$$;
grant execute on function pg_temp.table_at(text, text) to authenticated;

-- Five orders for Yash at Table 3, seat 5, from the console.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member(pg_temp.table_at('00000000-0000-4000-8000-000000000001', 'Table 3'), 5, '9000000214'), null, 'Yash sits at Table 3, seat 5');
insert into orders
select o.kot_number, o.order_id from generate_series(1, 5) n,
  lateral public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table_at('00000000-0000-4000-8000-000000000001', 'Table 3'), 5,
    jsonb_build_array(jsonb_build_object('item_id', (select id from items where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Masala chai'),
      'quantity', n)), false) o;
select is((select count(*)::integer from orders), 5, 'five KOTs placed');
select ok((select bool_and(not kot_print_failed) from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')),
  'no KOT is flagged while the bar printer has not tried any');
reset role;

-- The cage agent claims all five: it fails the first, fourth and fifth, prints the second, and keeps the third, printing.
insert into public.device (id, venue_id, kind, name) values
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-000000000001', 'agent', 'Cage agent'),
  ('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-000000000002', 'agent', 'Practice agent');
set local role service_role;
create temporary table claimed on commit drop as select * from public.claim_agent_kots('00000000-0000-4000-8000-00000000a001', 10);
reset role;
grant select on claimed to service_role;
create function pg_temp.delivery(p_kot integer) returns uuid language sql as $$
  select c.delivery_id from claimed c join orders o on (c.payload ->> 'order_id')::uuid = o.order_id where o.kot = p_kot;
$$;
grant execute on function pg_temp.delivery(integer) to service_role;
set local role service_role;
select lives_ok($$ select public.finish_agent_kot('00000000-0000-4000-8000-00000000a001', pg_temp.delivery(k), false, 'paper out', 60, 1) from unnest(array[1, 4, 5]) k $$,
  'the bar printer fails the first, fourth and fifth KOTs');
select lives_ok($$ select public.finish_agent_kot('00000000-0000-4000-8000-00000000a001', pg_temp.delivery(2), true, null, 0, 1) $$,
  'and prints the second');
reset role;

create function pg_temp.flags() returns table (kot integer, is_failed boolean) language sql as $$
  select t.kot_number, t.kot_print_failed from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') t
  join orders o on o.order_id = t.order_id order by 1;
$$;
grant execute on function pg_temp.flags() to authenticated;
create function pg_temp.flag(p_kot integer) returns boolean language sql as $$ select is_failed from pg_temp.flags() where kot = p_kot; $$;
grant execute on function pg_temp.flag(integer) to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.flags() $$, $$ values (1, true), (2, false), (3, false), (4, true), (5, true) $$,
  'only the KOTs the bar printer failed are flagged: not the printed one, nor the one still printing');
select lives_ok($$ select public.mark_kot_sent((select order_id from orders where kot = 1)) $$, 'the floor hands the first to the bar');
select is(pg_temp.flag(1), false, 'and its flag goes once the bar has it');
select lives_ok($$ select public.accept_fnb_order((select order_id from orders where kot = 4)) $$, 'the bar accepts the fourth all the same');
select is(pg_temp.flag(4), false, 'so the bar has it, and it is not flagged');
select lives_ok($$ select public.deliver_fnb_order((select order_id from orders where kot = 4)) $$, 'and delivers it');
select is(pg_temp.flag(4), false, 'nor once it is delivered');
reset role;

-- The agent tries the fifth again: no flag while it prints, and the flag again when that attempt fails too.
update public.outbox_delivery set available_at = now() - interval '1 second' where id = pg_temp.delivery(5);
set local role service_role;
create temporary table retried on commit drop as
select c.delivery_id, c.attempts from public.claim_agent_kots('00000000-0000-4000-8000-00000000a001', 10) c where c.delivery_id = pg_temp.delivery(5);
reset role;
grant select on retried to service_role;
select is((select attempts from retried), 2, 'the agent claims the fifth again, as its second attempt');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.flag(5), false, 'it is not flagged while the agent prints it again');
reset role;
set local role service_role;
select lives_ok($$ select public.finish_agent_kot('00000000-0000-4000-8000-00000000a001', delivery_id, false, 'paper out', 60, attempts) from retried $$,
  'and that attempt fails too');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.flag(5), true, 'so it is flagged again');
reset role;

-- A KOT the bar printer gave up on unprinted (too old, its order neither handed over nor void) still says the bar lacks it.
update public.outbox_delivery set status = 'delivered', delivered_at = now(), locked_until = null, last_error = 'too old to print'
where id = pg_temp.delivery(3);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.flag(3), true, 'a KOT closed without printing is flagged');
select lives_ok($$ select public.cancel_fnb_order((select order_id from orders where kot = 3), 'Member left the table') $$, 'the floor voids it');
select is(pg_temp.flag(3), false, 'and a void order goes to no bar, so no flag');
reset role;

-- A practice-venue order: Vikram (101), a super admin there too, seats Ishita (252) at its Table 1 and orders for her seat.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.seat_member(pg_temp.table_at('00000000-0000-4000-8000-000000000002', 'Table 1'), 1, '9000000252'), null,
  'Ishita sits at the practice venue''s Table 1, seat 1');
create temporary table practice_order on commit drop as
select * from public.console_fnb_order('00000000-0000-4000-8000-000000000002', pg_temp.table_at('00000000-0000-4000-8000-000000000002', 'Table 1'), 1,
  jsonb_build_array(jsonb_build_object('item_id', (select id from items where venue_id = '00000000-0000-4000-8000-000000000002' and name = 'Masala chai'),
    'quantity', 1)), false);
reset role;
grant select on practice_order to authenticated;
set local role service_role;
select is_empty($$ select * from public.claim_agent_kots('00000000-0000-4000-8000-00000000a002', 10) $$,
  'the practice venue''s agent claims no KOT, not even its own venue''s');
reset role;
select is((select count(*)::integer from public.outbox_delivery d join public.venue v on v.id = d.venue_id where v.is_practice and d.consumer = 'bar_printer'),
  0, 'no bar_printer delivery belongs to the practice venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select kot_print_failed from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000002') where order_id = (select order_id from practice_order) $$,
  $$ values (false) $$, 'so the practice order is never flagged');
reset role;

-- Who reads the flag: staff who serve F&B at the venue; not an admin of the other venue, nor a member, nor anyone signed out.
-- Imran (153) is an admin at the club alone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000153');
select ok((select count(*) from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')) >= 5, 'an admin of the club reads its orders');
select is_empty($$ select * from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000002') $$,
  'but none of the practice venue''s, where he does not work');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is_empty($$ select * from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') $$, 'a member reads no venue''s orders');
reset role;
select ok(has_function_privilege('authenticated', 'public.fnb_orders_tonight(uuid)', 'execute'), 'signed-in staff call it');
select ok(not has_function_privilege('anon', 'public.fnb_orders_tonight(uuid)', 'execute'), 'nobody signed out does');
select ok(not has_function_privilege('anon', 'private.fnb_orders_tonight(uuid)', 'execute'), 'nor its private half');

select * from finish();
rollback;
