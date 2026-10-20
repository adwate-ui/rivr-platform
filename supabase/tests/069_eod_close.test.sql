-- The end-of-day close of a cage shift (#45, decision 0067, question #367). 104 Sana and 105 Dev are
-- cashiers; 103 Aditya, the floor manager, and 102 Meera, a super admin, review variances; 106 Pema is
-- a dealer; 139 Farah a cashier at the practice venue too. 211 Ishaan and 201 Arjun (₹2,00,000 credit)
-- sit at Table 3; 213 Mihir checks in.
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
create function pg_temp.account(p_code text, p_member text default null) returns uuid language sql as $$
  select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = p_code
    and member_id is not distinct from p_member::uuid;
$$;
-- Posts as the named function would: [account, amount] pairs.
create function pg_temp.post(p_kind text, p_lines jsonb) returns uuid language sql as $$
  select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', p_kind, 'test-069:' || gen_random_uuid(), p_lines, null);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.counts(integer[]) to authenticated;
create temp table ids (name text primary key, id uuid);
create temp table held (name text primary key, paise bigint);
grant select, insert on ids, held to authenticated;

-- Sana opens the shift: ₹12,00,000 of float and ₹6,50,000 of chips. Every marker owed is the ledger's.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'first', public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000,
  pg_temp.counts(array[400, 300, 200, 100, 40, 8]), gen_random_uuid());
insert into held select 'markers', coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = 'member.receivable';

-- During it, through the cage: ₹10,000 of chips for cash and ₹20,000 by UPI to Ishaan, ₹15,000 from his wallet,
-- ₹4,000 back in cash from Mihir, and a ₹10,000 marker to Arjun.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'Ishaan sits at Table 3');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 2, '9000000201'),
  null, 'and Arjun beside him');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000213'), null, 'and Mihir checks in');
reset role;
-- A ₹50,000 deposit into Ishaan's wallet, as confirm_deposit posts it: a receipt.
select pg_temp.post('deposit', jsonb_build_array(jsonb_build_object('account_id', pg_temp.account('venue.bank'), 'amount', '5000000'),
  jsonb_build_object('account_id', pg_temp.account('member.cash', '00000000-0000-4000-8000-000000000211'), 'amount', '-5000000')));
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()),
  null, 'Sana issues Ishaan ₹10,000 of chips for cash');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 2000000, 'upi', gen_random_uuid(),
  '512345670069'), null, 'and ₹20,000 by UPI');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1500000, 'wallet', gen_random_uuid()),
  null, 'and ₹15,000 from his wallet, which moves no cash');
select isnt((select cage_transaction_id from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
  400000, 'cash', gen_random_uuid(), false)), null, 'and takes ₹4,000 back from Mihir in cash');
select isnt(public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 1000000, 'M10 40 C 30 10, 50 70, 70 40',
  gen_random_uuid()), null, 'and gives Arjun a ₹10,000 marker');
reset role;
-- As the cash-out posts settling ₹5,000 of a marker in chips, log_hand ₹1,000 of rake and ₹500 of drop, and
-- send_withdrawal a ₹25,000 withdrawal out of the bank (no receipt).
select pg_temp.post('cash_out', jsonb_build_array(jsonb_build_object('account_id', pg_temp.account('venue.chips_outstanding'), 'amount', '500000'),
  jsonb_build_object('account_id', pg_temp.account('member.receivable', '00000000-0000-4000-8000-000000000201'), 'amount', '-500000')));
select pg_temp.post('hand_rake', jsonb_build_array(jsonb_build_object('account_id', pg_temp.account('venue.chips_outstanding'), 'amount', '150000'),
  jsonb_build_object('account_id', pg_temp.account('venue.rake'), 'amount', '-100000'),
  jsonb_build_object('account_id', pg_temp.account('venue.jackpot.main'), 'amount', '-50000')));
select pg_temp.post('withdrawal', jsonb_build_array(jsonb_build_object('account_id', pg_temp.account('venue.withdrawals_pending'), 'amount', '2500000'),
  jsonb_build_object('account_id', pg_temp.account('venue.bank'), 'amount', '-2500000')));

-- What the ledger expects: ₹12,06,000 in the drawer; ₹6,50,000 of chips less ₹10,000, ₹20,000, ₹15,000 and the
-- ₹10,000 marker, plus ₹4,000, ₹5,000 and ₹1,500 back: ₹6,05,500; ₹70,000 received; markers up ₹5,000.
select results_eq($$ select cash_paise, chips_paise, receipts_paise, markers_paise from private.shift_expected((select id from ids where name = 'first')) $$,
  $$ values (120600000::bigint, 60550000::bigint, 7000000::bigint, (select paise + 500000 from held where name = 'markers')) $$,
  'the drawer, the cage, the bank and the markers as every movement of the shift leaves them');

-- Sana closes it to zero variance: once per request id, and eod.closed is emitted.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.close_cage_shift('00000000-0000-4000-8000-000000000001', -1, pg_temp.counts(array[400, 300, 191, 100, 32, 8]), 7000000, 0,
  gen_random_uuid()) $$, '22023', null, 'no amount below nothing');
select throws_ok($$ select public.close_cage_shift('00000000-0000-4000-8000-000000000001', 120600000, pg_temp.counts(array[400, 300]), 7000000, 0,
  gen_random_uuid()) $$, '22023', null, 'and every chip counted');
insert into held select 'markers now', paise + 500000 from held where name = 'markers';
insert into ids select 'clean', public.close_cage_shift('00000000-0000-4000-8000-000000000001', 120600000, pg_temp.counts(array[400, 300, 191, 100, 32, 8]),
  7000000, (select paise from held where name = 'markers now'), '00000000-0000-4000-8000-0000000c4501');
select is(public.close_cage_shift('00000000-0000-4000-8000-000000000001', 120600000, pg_temp.counts(array[400, 300, 191, 100, 32, 8]),
  7000000, (select paise from held where name = 'markers now'), '00000000-0000-4000-8000-0000000c4501'), (select id from ids where name = 'clean'),
  'a retried tap closes once');
select throws_ok($$ select public.close_cage_shift('00000000-0000-4000-8000-000000000001', 120500000, pg_temp.counts(array[400, 300, 191, 100, 32, 8]),
  7000000, (select paise from held where name = 'markers now'), '00000000-0000-4000-8000-0000000c4501') $$, '22023', null,
  'and a request id is for one set of figures');
select results_eq($$ select is_anomaly, cash_variance_paise, chips_variance_paise, receipts_variance_paise, markers_variance_paise, closed_by, reason, may_review
                     from public.eod_closes('00000000-0000-4000-8000-000000000001') $$,
  $$ values (false, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 'Sana Qureshi'::text, null::text, false) $$, 'Sana closes the shift to zero variance');
select is((select shift_id from public.treasury('00000000-0000-4000-8000-000000000001')), null, 'and no shift is open');
select throws_ok($$ select public.close_cage_shift('00000000-0000-4000-8000-000000000001', 0, pg_temp.counts(array[0, 0, 0, 0, 0, 0]), 0, 0,
  gen_random_uuid()) $$, 'RVNSH', null, 'nothing closes with no shift open');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'eod.closed' and payload ->> 'close_id' = (select id::text from ids where name = 'clean')),
  1, 'eod.closed is emitted');

-- The next shift closes with the drawer ₹500 short: an anomaly, an alert, and no eod.closed until a manager gives a reason.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120600000, pg_temp.counts(array[400, 300, 191, 100, 32, 8]), gen_random_uuid()),
  null, 'Sana opens the next shift with the float she closed with');
insert into ids select 'short', public.close_cage_shift('00000000-0000-4000-8000-000000000001', 120550000, pg_temp.counts(array[400, 300, 191, 100, 32, 8]),
  0, (select paise from held where name = 'markers now'), gen_random_uuid());
select results_eq($$ select is_anomaly, counted_cash_paise, expected_cash_paise, cash_variance_paise, chips_variance_paise, reason, may_review
                     from public.eod_closes('00000000-0000-4000-8000-000000000001') where close_id = (select id from ids where name = 'short') $$,
  $$ values (true, 120550000::bigint, 120600000::bigint, -50000::bigint, 0::bigint, null::text, false) $$,
  'the drawer ₹500 short is an anomaly, whose reason Sana may not give');
reset role;
select is((select count(*)::integer from public.alert where kind = 'eod.variance' and detail ->> 'close_id' = (select id::text from ids where name = 'short')),
  1, 'an alert is raised');
select is((select count(*)::integer from public.outbox_event where event_type = 'eod.closed' and payload ->> 'close_id' = (select id::text from ids where name = 'short')),
  0, 'and the day does not close yet');

-- Fifteen clean shifts later, the anomaly still waits on the list.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
do $$
begin
  for i in 1 .. 15 loop
    perform public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120600000, pg_temp.counts(array[400, 300, 191, 100, 32, 8]), gen_random_uuid());
    perform public.close_cage_shift('00000000-0000-4000-8000-000000000001', 120600000, pg_temp.counts(array[400, 300, 191, 100, 32, 8]), 0,
      (select paise from held where name = 'markers now'), gen_random_uuid());
  end loop;
end $$;
select results_eq($$ select count(*)::integer, count(*) filter (where close_id = (select id from ids where name = 'short'))::integer
                     from public.eod_closes('00000000-0000-4000-8000-000000000001') $$,
  $$ values (15, 1) $$, 'the latest 14 closes, and the anomaly still waiting');

-- A manager who neither opened nor closed it gives the reason, once.
select throws_ok($$ select public.review_eod_close((select id from ids where name = 'short'), 'Recounted, a note short') $$, '42501', null,
  'the cashier who closed it does not review it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000105');
select throws_ok($$ select public.review_eod_close((select id from ids where name = 'short'), 'Recounted, a note short') $$, '42501', null,
  'nor does another cashier');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.review_eod_close((select id from ids where name = 'short'), 'Recounted, a note short') $$, '42501', null, 'nor a dealer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select may_review from public.eod_closes('00000000-0000-4000-8000-000000000001') where close_id = (select id from ids where name = 'short')),
  true, 'Aditya, a manager, may give it');
select throws_ok($$ select public.review_eod_close((select id from ids where name = 'short'), ' a ') $$, '22023', null, 'a reason is 3 to 500 characters');
select throws_ok($$ select public.review_eod_close((select id from ids where name = 'clean'), 'Nothing to say') $$, 'RVREV', null,
  'a close with no variance needs no review');
select lives_ok($$ select public.review_eod_close((select id from ids where name = 'short'), '  A ₹500 note paid out twice; found on the CCTV  ') $$,
  'Aditya reviews it with the reason');
select results_eq($$ select c.reason, s.full_name from public.eod_close c join public.staff s on s.id = c.reviewed_by_staff_id
                     where c.id = (select id from ids where name = 'short') $$,
  $$ values ('A ₹500 note paid out twice; found on the CCTV'::text, 'Aditya Malhotra'::text) $$, 'the reason stands, with who gave it');
select is((select count(*)::integer from public.eod_closes('00000000-0000-4000-8000-000000000001') where close_id = (select id from ids where name = 'short')),
  0, 'and, reviewed and older than the latest 14, it leaves the list');
select throws_ok($$ select public.review_eod_close((select id from ids where name = 'short'), 'Again') $$, 'RVREV', null, 'once');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'eod.closed' and payload ->> 'close_id' = (select id::text from ids where name = 'short')),
  1, 'eod.closed is emitted once it is reviewed');

-- A manager who opened the shift does not review its variance either.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select isnt(public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120600000, pg_temp.counts(array[400, 300, 191, 100, 32, 8]), gen_random_uuid()),
  null, 'Meera, a super admin, opens a shift');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'meera', public.close_cage_shift('00000000-0000-4000-8000-000000000001', 120600000, pg_temp.counts(array[400, 300, 191, 100, 32, 7]),
  0, (select paise from held where name = 'markers now'), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select public.review_eod_close((select id from ids where name = 'meera'), 'A chip under the table') $$, '42501', null,
  'Meera does not review the shift she opened');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.review_eod_close((select id from ids where name = 'meera'), 'A chip under the table') $$, 'Aditya does');
reset role;

-- Who may: the cage closes; ledger readers see; nobody else, nor another venue, and nobody writes directly.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.eod_close $$, 'a dealer sees no closes');
select is_empty($$ select * from public.eod_closes('00000000-0000-4000-8000-000000000001') $$, 'nor the list');
select throws_ok($$ select public.close_cage_shift('00000000-0000-4000-8000-000000000001', 0, pg_temp.counts(array[0, 0, 0, 0, 0, 0]), 0, 0,
  gen_random_uuid()) $$, '42501', null, 'and closes nothing');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000139' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select is_empty($$ select * from public.eod_close where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'the practice venue''s cashier sees none of the club''s closes');
select is_empty($$ select * from public.eod_closes('00000000-0000-4000-8000-000000000001') $$, 'nor its list');
select throws_ok($$ select public.review_eod_close((select id from ids where name = 'short'), 'From elsewhere') $$, '42501', null, 'and reviews none');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000139' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ update public.eod_close set reason = 'Changed' $$, '42501', null, 'nobody changes a close directly');
reset role;

select * from finish();
rollback;
