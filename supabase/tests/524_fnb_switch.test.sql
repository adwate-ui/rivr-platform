-- Food and drink on or off (decision 0681): on with none set; a super admin switches it off, with a reason, and nobody
-- else may; while off no order is taken from the app, a dealer's tablet or the console, and the apps are told; on again,
-- orders are taken. Yash (214) is seated at Table 3; 103 Aditya is an admin, 101 a super admin, 106 Pema a dealer.
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
create function pg_temp.item(p_name text) returns text language sql as $$ select id from items where name = p_name; $$;
grant execute on function pg_temp.item(text) to authenticated;
create function pg_temp.switch(p_on boolean, p_at interval) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'fnb.enabled', '', jsonb_build_object('enabled', p_on), now() + p_at, 'The kitchen is closed tonight');
$$;
grant execute on function pg_temp.switch(boolean, interval) to authenticated;

-- Yash may order, is 25, and sits at Table 3, seat 5.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'fnb.table_side', true, 'Test');
insert into public.kyc_record (venue_id, member_id, date_of_birth)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', (now() - interval '25 years')::date)
on conflict (member_id) do update set date_of_birth = excluded.date_of_birth;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5, '9000000214'),
  null, 'Yash sits at Table 3, seat 5');
select is(public.fnb_on('00000000-0000-4000-8000-000000000001'), true, 'with none set, F&B is on');
reset role;
select is((select can_order from private.live_status_of('00000000-0000-4000-8000-000000000214')), true, 'his lock screen offers Order');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');

select throws_ok($$ select pg_temp.switch(false, interval '-1 second') $$, '42501', null, 'an admin may not switch F&B off');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select pg_temp.switch(false, interval '-1 second') $$, 'a super admin switches F&B off, with a reason');
select is(public.fnb_on('00000000-0000-4000-8000-000000000001'), false, 'and staff are told it is off');
reset role;
select is((select can_order from private.live_status_of('00000000-0000-4000-8000-000000000214')), false, 'his lock screen offers Order no more');

select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is(public.fnb_on(), false, 'so is the member, of their own venue');
select throws_ok($$ select * from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Masala chai'), 'quantity', 1))) $$,
  'RVFNB', null, 'while off, the app takes no order');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001',
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5,
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('French fries'), 'quantity', 1)), true) $$,
  'RVFNB', null, 'nor the console');
reset role;
select is((select count(*)::int from public.fnb_order where member_id = '00000000-0000-4000-8000-000000000214'), 0, 'no order was kept');

-- On again from now: orders are taken.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select pg_temp.switch(true, interval '0 seconds') $$, 'a super admin switches F&B on again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is(public.fnb_on(), true, 'the member is told it is on');
select lives_ok($$ select * from public.place_fnb_order(jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('Masala chai'), 'quantity', 1))) $$,
  'and the app takes an order');
reset role;

set local role anon;
select throws_ok($$ select public.fnb_on('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a visitor is told nothing');
reset role;

select * from finish();
rollback;
