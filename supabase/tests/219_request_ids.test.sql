-- One request, one write (A3 of the Fix Tracker): a promotion submitted twice with one request id is one promotion; a
-- console order sent twice with one request id is one order and one kitchen ticket. Aditya (103, an admin) runs
-- promotions and F&B; Ishaan (211) sits at Table 3.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create temp table promo as select jsonb_build_object(
  'name', 'Double points', 'runs', 'Thursday', 'request_id', 'c2190000-0000-4000-8000-000000000001',
  'rule', jsonb_build_object('trigger', 'hours_played', 'conditions', '{}'::jsonb, 'effect', jsonb_build_object('kind', 'points', 'multiplier_percent', 200))) as body;
grant select on promo to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'first', public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body from promo));
insert into ids select 'again', public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body from promo));
select is((select id from ids where name = 'again'), (select id from ids where name = 'first'), 'a promotion submitted again with its request id is the first');
select is((select count(*)::integer from public.promotion where idempotency_key = 'c2190000-0000-4000-8000-000000000001'), 1, 'one promotion');
select is((select count(*)::integer from public.promotion_rule where promotion_id = (select id from ids where name = 'first')), 1, 'with one rule');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001', (select jsonb_set(body, '{name}', '"Triple points"') from promo)) $$,
  '22023', null, 'the same request id for another promotion is refused');
select isnt(public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body - 'request_id' from promo)), (select id from ids where name = 'first'),
  'without one, a submission is a new promotion, as before');

-- A comp for Ishaan's seat, sent twice.
insert into ids select 'session', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211');
create temp table sent as
select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001',
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1,
  jsonb_build_array(jsonb_build_object('item_id', (select id from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001' and is_available order by position limit 1), 'quantity', 1)),
  true, 'c2190000-0000-4000-8000-000000000002');
create temp table sent_again as
select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001',
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1,
  jsonb_build_array(jsonb_build_object('item_id', (select id from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001' and is_available order by position limit 1), 'quantity', 1)),
  true, 'c2190000-0000-4000-8000-000000000002');
select results_eq($$ select order_id, kot_number from sent_again $$, $$ select order_id, kot_number from sent $$,
  'an order sent again with its request id returns the first, with its KOT');
select throws_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001',
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1,
  jsonb_build_array(jsonb_build_object('item_id', (select id from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001' and is_available order by position limit 1), 'quantity', 1)),
  false, 'c2190000-0000-4000-8000-000000000002') $$, '22023', null, 'and for an order paid otherwise');
reset role;
select is((select count(*)::integer from public.fnb_order where idempotency_key = 'c2190000-0000-4000-8000-000000000002'), 1, 'one order, one kitchen ticket');

select * from finish();
rollback;
