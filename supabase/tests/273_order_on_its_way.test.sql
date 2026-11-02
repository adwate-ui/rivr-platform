-- An order on its way (decision 0320): the bar marks it between accepted and delivered, once; the member's orders and the
-- bar's list carry when. Kabir (202) orders; 103 Aditya runs the floor and serves.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- An order placed tonight at Table 2, seat 3, as the bar would have it.
insert into public.visit (venue_id, member_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202'
where not exists (select 1 from public.visit where member_id = '00000000-0000-4000-8000-000000000202' and closed_at is null);
insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, lines, source, kot_number, idempotency_key)
select '00000000-0000-4000-8000-000000000001',
       (select id from public.visit where member_id = '00000000-0000-4000-8000-000000000202' order by opened_at desc limit 1),
       '00000000-0000-4000-8000-000000000202', g.id, 3, private.club_day_now(),
       '[{"item_id": "00000000-0000-4000-8000-000000000999", "name": "Masala chai", "kind": "soft_drink", "quantity": 1, "note": null}]'::jsonb,
       'app', 9273, '00000000-0000-4000-8000-00000000f273'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';
create temp table placed on commit drop as select id from public.fnb_order where idempotency_key = '00000000-0000-4000-8000-00000000f273';
grant select on placed to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.send_fnb_order_on_way((select id from placed)) $$, '22023', null, 'not before it is accepted');
select lives_ok($$ select public.accept_fnb_order((select id from placed)) $$, 'the bar accepts it');
select lives_ok($$ select public.send_fnb_order_on_way((select id from placed)) $$, 'and sends it on its way');
select throws_ok($$ select public.send_fnb_order_on_way((select id from placed)) $$, '22023', null, 'once');
select ok((select on_way_at is not null from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') where order_id = (select id from placed)),
  'the bar''s list says when it left');
select ok((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'fnb') >= 1,
  'on its way, it still counts as waiting for the bar');
select lives_ok($$ select public.deliver_fnb_order((select id from placed)) $$, 'then delivers it');
select throws_ok($$ select public.send_fnb_order_on_way((select id from placed)) $$, '22023', null, 'never after it is delivered');
reset role;

-- A second order, accepted and then voided (decision 0302), goes no further: not on its way, and the list says why.
insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, lines, source, kot_number, idempotency_key)
select venue_id, visit_id, member_id, table_id, seat, club_day, lines, source, 9274, '00000000-0000-4000-8000-00000000f274'
from public.fnb_order where id = (select id from placed);
create temp table voided on commit drop as select id from public.fnb_order where idempotency_key = '00000000-0000-4000-8000-00000000f274';
grant select on voided to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.accept_fnb_order((select id from voided)) $$, 'the bar accepts the second');
select lives_ok($$ select public.cancel_fnb_order((select id from voided), 'Out of milk') $$, 'and voids it');
select throws_ok($$ select public.send_fnb_order_on_way((select id from voided)) $$, '22023', null, 'a void order is not sent on its way');
select is((select cancel_reason from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') where order_id = (select id from voided)),
  'Out of milk', 'the bar''s list keeps why it was voided');
reset role;

-- A member is no runner.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select throws_ok($$ select public.send_fnb_order_on_way((select id from placed)) $$, '42501', null, 'a member sends nothing on its way');
reset role;

select * from finish();
rollback;
