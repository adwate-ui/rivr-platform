-- The console's flag on a KOT the bar printer did not get (console v3): fnb_orders_tonight says so from the bar_printer
-- consumer's own state in the outbox, never from a clock. Yash (214) sits at Table 3; Aditya (103), an admin who runs
-- F&B, orders three KOTs for his seat. The cage agent fails to print one, prints one, and one waits unclaimed; the failed
-- one is then handed to the bar by hand. The practice venue's agent never reaches the bar printer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table items on commit drop as select name, id::text as id from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on items to authenticated;
create temporary table orders (kot integer, order_id uuid);
grant select, insert on orders to authenticated, service_role;

-- Three orders for Yash at Table 3, seat 5, from the console.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5, '9000000214'),
  null, 'Yash sits at Table 3, seat 5');
insert into orders
select o.kot_number, o.order_id from generate_series(1, 3) n,
  lateral public.console_fnb_order('00000000-0000-4000-8000-000000000001',
    (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5,
    jsonb_build_array(jsonb_build_object('item_id', (select id from items where name = 'Masala chai'), 'quantity', n)), false) o;
select is((select count(*)::integer from orders), 3, 'three KOTs placed');
select ok((select bool_and(not kot_print_failed) from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001')),
  'no KOT is flagged while the bar printer has not tried any');
reset role;

-- The cage agent claims all three: it fails the first, prints the second, and the third stays with it, printing.
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
select lives_ok($$ select public.finish_agent_kot('00000000-0000-4000-8000-00000000a001', pg_temp.delivery(1), false, 'paper out', 60, 1) $$,
  'the bar printer fails the first KOT');
select lives_ok($$ select public.finish_agent_kot('00000000-0000-4000-8000-00000000a001', pg_temp.delivery(2), true, null, 0, 1) $$,
  'and prints the second');
reset role;

create function pg_temp.flags() returns table (kot integer, is_failed boolean) language sql as $$
  select t.kot_number, t.kot_print_failed from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') t
  join orders o on o.order_id = t.order_id order by 1;
$$;
grant execute on function pg_temp.flags() to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.flags() $$, $$ select * from (values (1, true), (2, false), (3, false)) v(kot, is_failed) order by 1 $$,
  'only the KOT the bar printer failed is flagged: not the printed one, nor the one still printing');
select lives_ok($$ select public.mark_kot_sent((select order_id from orders where kot = 1)) $$, 'the floor hands the failed KOT to the bar');
select is((select is_failed from pg_temp.flags() where kot = 1), false, 'and its flag goes once the bar has it');
reset role;

-- A KOT the bar printer gave up on unprinted (too old, its order neither handed over nor void) still says the bar lacks it.
update public.outbox_delivery set status = 'delivered', delivered_at = now(), locked_until = null, last_error = 'too old to print'
where id = (select delivery_id from claimed c join orders o on (c.payload ->> 'order_id')::uuid = o.order_id where o.kot = 3);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select is_failed from pg_temp.flags() where kot = 3), true, 'a KOT closed without printing is flagged');
select lives_ok($$ select public.cancel_fnb_order((select order_id from orders where kot = 3), 'Member left the table') $$, 'the floor voids it');
select is((select is_failed from pg_temp.flags() where kot = 3), false, 'and a void order goes to no bar, so no flag');
reset role;

-- The practice venue never reaches the bar printer: its agent claims nothing, and nothing of its venue's is a bar_printer delivery.
set local role service_role;
select is_empty($$ select * from public.claim_agent_kots('00000000-0000-4000-8000-00000000a002', 10) $$,
  'the practice venue''s agent claims no KOT');
reset role;
select is((select count(*)::integer from public.outbox_delivery d join public.venue v on v.id = d.venue_id where v.is_practice and d.consumer = 'bar_printer'),
  0, 'no bar_printer delivery belongs to the practice venue');

-- Who reads the flag: staff who serve F&B at the venue, nobody at another venue, and nobody signed out.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is_empty($$ select * from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') $$, 'a member reads no venue''s orders');
reset role;
select ok(has_function_privilege('authenticated', 'public.fnb_orders_tonight(uuid)', 'execute'), 'signed-in staff call it');
select ok(not has_function_privilege('anon', 'public.fnb_orders_tonight(uuid)', 'execute'), 'nobody signed out does');
select ok(not has_function_privilege('anon', 'private.fnb_orders_tonight(uuid)', 'execute'), 'nor its private half');

select * from finish();
rollback;
