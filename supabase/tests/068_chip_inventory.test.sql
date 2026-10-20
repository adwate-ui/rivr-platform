-- The cage's shift, its chip counts and chips in play (#24, decision 0066). 104 Sana is a cashier; 103
-- Aditya, the floor manager, reads the ledger but runs no cage; 106 Pema is a dealer; 139 Farah is a
-- cashier at the practice venue too. 211 Ishaan sits at Table 3; 213 Mihir checks in.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
-- A count of the venue's six chips, ₹50 to ₹25,000, in that order.
create function pg_temp.counts(p_quantities integer[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('value_paise', x.value_paise, 'quantity', x.quantity) order by x.value_paise)
  from unnest(array[5000, 10000, 50000, 100000, 500000, 2500000]::bigint[], p_quantities) as x(value_paise, quantity);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.counts(integer[]) to authenticated;
create temp table ids (name text primary key, id uuid);
create temp table held (name text primary key, paise bigint);
grant select, insert on ids, held to authenticated;

-- Before a shift: nothing open, the six chips with no count, and nothing to count into.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select shift_id, float_paise from public.treasury('00000000-0000-4000-8000-000000000001') $$,
  $$ values (null::uuid, null::bigint) $$, 'no shift is open at first');
select results_eq($$ select count(*)::integer, count(quantity)::integer from public.chip_inventory('00000000-0000-4000-8000-000000000001') $$,
  $$ values (6, 0) $$, 'the venue''s six chips, none counted');
select throws_ok($$ select public.count_chips('00000000-0000-4000-8000-000000000001', pg_temp.counts(array[0, 0, 0, 0, 0, 0]), gen_random_uuid()) $$,
  'RVNSH', null, 'no count without a shift');

-- The float is whole rupees, and a count names every chip the venue uses once, as a whole number.
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000050, pg_temp.counts(array[1, 1, 1, 1, 1, 1]), gen_random_uuid()) $$,
  '22023', null, 'the float is whole rupees');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000, pg_temp.counts(array[1, 1, 1, 1]), gen_random_uuid()) $$,
  '22023', null, 'every chip is counted');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000,
  pg_temp.counts(array[1, 1, 1, 1, 1, 1]) || '[{"value_paise": 5000, "quantity": 1}]'::jsonb, gen_random_uuid()) $$,
  '22023', null, 'once each');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000,
  pg_temp.counts(array[1, 1, 1, 1, 1]) || '[{"value_paise": 7500, "quantity": 1}]'::jsonb, gen_random_uuid()) $$,
  '22023', null, 'and only the venue''s chips');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000,
  pg_temp.counts(array[1, 1, 1, 1, 1]) || '[{"value_paise": 2500000, "quantity": 1.5}]'::jsonb, gen_random_uuid()) $$,
  '22023', null, 'in whole chips');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000,
  pg_temp.counts(array[1, 1, 1, 1, 1]) || '[{"value_paise": 2500000, "quantity": -1}]'::jsonb, gen_random_uuid()) $$,
  '22023', null, 'none fewer than none');
select is_empty($$ select * from public.cage_shift $$, 'and a refused opening opens nothing');

-- A cashier opens the shift with ₹12,00,000 of float and the chips counted: once per request id, one at a time.
insert into ids select 'shift', public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000,
  pg_temp.counts(array[400, 300, 200, 100, 40, 8]), '00000000-0000-4000-8000-0000000c2401');
select isnt((select id from ids where name = 'shift'), null, 'Sana opens the shift');
select is(public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000, pg_temp.counts(array[400, 300, 200, 100, 40, 8]),
  '00000000-0000-4000-8000-0000000c2401'), (select id from ids where name = 'shift'), 'a retried tap opens it once');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 50000000, pg_temp.counts(array[400, 300, 200, 100, 40, 8]),
  '00000000-0000-4000-8000-0000000c2401') $$, '22023', null, 'a request id is for one float');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000, pg_temp.counts(array[400, 300, 200, 100, 40, 8]),
  gen_random_uuid()) $$, 'RVSHO', null, 'one shift is open at a time');
select results_eq($$ select shift_id, float_paise, opened_by from public.treasury('00000000-0000-4000-8000-000000000001') $$,
  $$ select (select id from ids where name = 'shift'), 120000000::bigint, 'Sana Qureshi'::text $$, 'the Treasury shows the float and who opened the shift');

-- The count by denomination, and what the cage holds: ₹6,50,000.
select results_eq($$ select value_paise, quantity, line_paise from public.chip_inventory('00000000-0000-4000-8000-000000000001') $$,
  $$ values (5000::bigint, 400, 2000000::bigint), (10000, 300, 3000000), (50000, 200, 10000000), (100000, 100, 10000000),
            (500000, 40, 20000000), (2500000, 8, 20000000) $$, 'the count by denomination');
select results_eq($$ select distinct in_cage_paise, counted_by from public.chip_inventory('00000000-0000-4000-8000-000000000001') $$,
  $$ values (65000000::bigint, 'Sana Qureshi'::text) $$, 'what the cage holds, and who counted it');

-- Counting again: the latest count is the one shown; a retried tap counts once.
select isnt(public.count_chips('00000000-0000-4000-8000-000000000001', pg_temp.counts(array[400, 300, 200, 100, 38, 8]),
  '00000000-0000-4000-8000-0000000c2402'), null, 'Sana counts again');
select is(public.count_chips('00000000-0000-4000-8000-000000000001', pg_temp.counts(array[400, 300, 200, 100, 38, 8]),
  '00000000-0000-4000-8000-0000000c2402'), (select id from public.chip_inventory_count where idempotency_key = '00000000-0000-4000-8000-0000000c2402'),
  'a retried tap counts once');
select throws_ok($$ select public.count_chips('00000000-0000-4000-8000-000000000001', pg_temp.counts(array[400, 300, 200, 100, 36, 8]),
  '00000000-0000-4000-8000-0000000c2402') $$, '22023', null, 'a request id is for one count');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000, pg_temp.counts(array[400, 300, 200, 100, 40, 9]),
  '00000000-0000-4000-8000-0000000c2401') $$, '22023', null, 'and an opening for its own count');
select results_eq($$ select quantity, in_cage_paise from public.chip_inventory('00000000-0000-4000-8000-000000000001') where value_paise = 500000 $$,
  $$ values (38, 64000000::bigint) $$, 'and the latest count is the one shown');
select is((select count(*)::integer from public.chip_inventory_count), 2, 'both counts are kept');

-- Chips in play is the ledger's, issued less returned: ₹10,000 of chips to Ishaan, ₹4,000 back from Mihir.
insert into held select 'chips', chips_in_play_paise from public.treasury('00000000-0000-4000-8000-000000000001');
select is((select paise from held where name = 'chips'),
  (select -coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
   where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = 'venue.chips_outstanding'), 'chips in play is the ledger''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'Ishaan sits at Table 3');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000213'), null, 'and Mihir checks in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()),
  null, 'Sana issues Ishaan ₹10,000 of chips');
select isnt((select cage_transaction_id from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
  400000, 'cash', gen_random_uuid(), false)), null, 'and takes ₹4,000 back from Mihir');
select is((select chips_in_play_paise from public.treasury('00000000-0000-4000-8000-000000000001')) - (select paise from held where name = 'chips'),
  600000::bigint, 'chips in play rises by what was issued less what came back');

-- What the venue holds for players, from the ledger, with the signs right: a wallet credit adds to wallets.
insert into held select 'wallets', wallets_paise from public.treasury('00000000-0000-4000-8000-000000000001');
reset role;
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-068-deposit',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.bank'),
                       'amount', '2000000'),
    jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000211' and code = 'member.cash'),
                       'amount', '-2000000')), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select wallets_paise from public.treasury('00000000-0000-4000-8000-000000000001')) - (select paise from held where name = 'wallets'),
  2000000::bigint, 'a ₹20,000 deposit adds ₹20,000 to members'' wallets');
select results_eq($$ select markers_paise, bonus_paise, jackpots_paise, withdrawals_pending_paise from public.treasury('00000000-0000-4000-8000-000000000001') $$,
  $$ select coalesce(sum(e.amount) filter (where a.code = 'member.receivable'), 0)::bigint,
            coalesce(-sum(e.amount) filter (where a.code = 'member.bonus'), 0)::bigint,
            coalesce(-sum(e.amount) filter (where a.code like 'venue.jackpot.%'), 0)::bigint,
            coalesce(-sum(e.amount) filter (where a.code = 'venue.withdrawals_pending'), 0)::bigint
     from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
     where a.venue_id = '00000000-0000-4000-8000-000000000001' $$, 'markers, bonus, jackpots and withdrawals waiting, from the ledger');

-- Who may: the cage counts and opens; ledger readers see; nobody else, nor another venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt_empty($$ select * from public.treasury('00000000-0000-4000-8000-000000000001') $$, 'the floor manager reads the Treasury');
select isnt_empty($$ select * from public.cage_shift $$, 'and the shift');
select throws_ok($$ select public.count_chips('00000000-0000-4000-8000-000000000001', pg_temp.counts(array[0, 0, 0, 0, 0, 0]), gen_random_uuid()) $$,
  '42501', null, 'but counts no chips: no cage');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.treasury('00000000-0000-4000-8000-000000000001') $$, 'a dealer reads no Treasury');
select is_empty($$ select * from public.chip_inventory('00000000-0000-4000-8000-000000000001') $$, 'nor the chips');
select is_empty($$ select * from public.chip_inventory_line $$, 'nor any count');
select throws_ok($$ select public.open_cage_shift('00000000-0000-4000-8000-000000000001', 0, pg_temp.counts(array[0, 0, 0, 0, 0, 0]), gen_random_uuid()) $$,
  '42501', null, 'and opens nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.cage_shift $$, 'a member sees no shift');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000139' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select is_empty($$ select * from public.cage_shift where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'the practice venue''s cashier sees none of the club''s shifts');
select is_empty($$ select * from public.treasury('00000000-0000-4000-8000-000000000001') $$, 'nor its Treasury');
select is_empty($$ select * from public.chip_inventory_count where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'nor its chip counts');
select is_empty($$ select * from public.chip_inventory_line where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'nor their lines');
select is_empty($$ select * from public.chip_inventory('00000000-0000-4000-8000-000000000001') $$, 'nor its chips');
select throws_ok($$ select public.count_chips('00000000-0000-4000-8000-000000000001', pg_temp.counts(array[0, 0, 0, 0, 0, 0]), gen_random_uuid()) $$,
  '42501', null, 'and counts none of its chips');
select isnt(public.open_cage_shift('00000000-0000-4000-8000-000000000002', 0, pg_temp.counts(array[0, 0, 0, 0, 0, 0]), gen_random_uuid()), null,
  'but opens the practice venue''s own shift');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000139' and venue_id = '00000000-0000-4000-8000-000000000001';

-- Only the functions write: nobody inserts, changes or removes a shift or a count directly.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ insert into public.cage_shift (venue_id, float_paise, opened_by_staff_id, idempotency_key)
  values ('00000000-0000-4000-8000-000000000001', 0, gen_random_uuid(), gen_random_uuid()) $$, '42501', null, 'no direct shift');
select throws_ok($$ update public.chip_inventory_line set quantity = 0 $$, '42501', null, 'no changed count');
select throws_ok($$ delete from public.chip_inventory_count $$, '42501', null, 'no removed count');
reset role;

-- A count moves no money, so a frozen venue still counts its chips.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Audit');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select public.count_chips('00000000-0000-4000-8000-000000000001', pg_temp.counts(array[400, 300, 200, 100, 38, 8]), gen_random_uuid()) $$,
  'a frozen venue still counts its chips');
reset role;

select * from finish();
rollback;
