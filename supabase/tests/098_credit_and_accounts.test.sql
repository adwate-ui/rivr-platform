-- Credit at the cage, payment accounts and expenses (#92, #94, #95; decisions 0167 and 0168).
-- Arjun Mehta (201) owes a ₹50,000 marker issued 14 days ago, under a ₹2,00,000 limit; the cashier Rohit
-- Chauhan (140) has the club's cage shift open. The admins Aditya Malhotra (103) and Nisha Arora (191)
-- manage the treasury; a cashier does not. Kunal Mehra (216) owes nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- Repayments and the credit report (#92). Arjun sits at Table 2 and takes a ₹20,000 marker tonight.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'), 7, '9000000201'),
  null, 'Arjun sits at Table 2');
select pg_temp.as_person('00000000-0000-4000-8000-000000000140');
insert into ids select 'marker', public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 2000000,
                                                     'M0 0 L 10 10', gen_random_uuid());
select results_eq(
  $$ select full_name, limit_paise, owed_0_7_paise, owed_8_30_paise, owed_31_60_paise, owed_over_60_paise, owed_paise, is_past_due
     from public.credit_report('00000000-0000-4000-8000-000000000001', now()) $$,
  $$ values ('Arjun Mehta'::text, 20000000::bigint, 2000000::bigint, 5000000::bigint, 0::bigint, 0::bigint, 7000000::bigint, false) $$,
  'the report: Arjun owes ₹20,000 from today and ₹50,000 from a fortnight ago, under his ₹2,00,000 limit');
select results_eq(
  $$ select owed_8_30_paise, owed_31_60_paise, is_past_due from public.credit_report('00000000-0000-4000-8000-000000000001', now() + interval '20 days') $$,
  $$ values (2000000::bigint, 5000000::bigint, true) $$,
  'twenty days on, both have aged a bucket and the older is past due');
select throws_ok($$ select * from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 1002000,
  'cash', null, gen_random_uuid()) $$, 'RVCHP', null, 'a repayment is whole ₹50 chips');
select throws_ok($$ select * from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 8000000,
  'cash', null, gen_random_uuid()) $$, 'RVOVR', null, 'and never more than is owed');
select throws_ok($$ select * from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 1000000,
  'wallet', null, gen_random_uuid()) $$, '22023', null, 'by cash or UPI only');
select throws_ok($$ select * from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 1000000,
  'upi', null, gen_random_uuid()) $$, '22023', null, 'UPI with its UTR');
select results_eq(
  $$ select o_settled_paise from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 6000000,
       'cash', null, '00000000-0000-4000-8000-0000000c9801') $$,
  $$ values (6000000::bigint) $$, 'Arjun repays ₹60,000 in cash');
reset role;
select results_eq(
  $$ select k.outstanding_paise, k.settled_at is not null from public.marker k where k.member_id = '00000000-0000-4000-8000-000000000201' order by k.issued_at $$,
  $$ values (0::bigint, true), (1000000::bigint, false) $$, 'oldest first: the ₹50,000 marker settled, ₹10,000 of the new one');
select is((select count(*)::integer from public.outbox_event where event_type = 'marker.settled'), 1, 'marker.settled for the marker paid off');
select results_eq(
  $$ select a.code, private.account_balance(a.id) from public.ledger_account a
     where a.venue_id = '00000000-0000-4000-8000-000000000001' and (a.code = 'venue.cash_drawer' or (a.code = 'member.receivable'
           and a.member_id = '00000000-0000-4000-8000-000000000201')) order by a.code $$,
  $$ values ('member.receivable'::text, 1000000::bigint), ('venue.cash_drawer'::text, 6000000::bigint) $$,
  'the cash goes into the drawer and the receivable comes down to ₹10,000');
select pg_temp.as_person('00000000-0000-4000-8000-000000000140');
select results_eq(
  $$ select owed_0_7_paise, owed_8_30_paise from public.credit_report('00000000-0000-4000-8000-000000000001', now()) $$,
  $$ values (1000000::bigint, 0::bigint) $$, 'the report now has ₹10,000 owed');
select results_eq(
  $$ select owed_8_30_paise, owed_paise from public.credit_report('00000000-0000-4000-8000-000000000001', now() - interval '1 second') $$,
  $$ values (5000000::bigint, 5000000::bigint) $$, 'and the report for a moment before stands as it was');
select results_eq(
  $$ select o_settled_paise from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 6000000,
       'cash', null, '00000000-0000-4000-8000-0000000c9801') $$,
  $$ values (6000000::bigint) $$, 'a retried tap gives the same repayment');
select is((select count(*)::integer from public.cage_transaction where kind = 'marker_repayment'), 1, 'and takes it once');
select throws_ok($$ select * from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 1000000,
  'cash', null, '00000000-0000-4000-8000-0000000c9801') $$, '22023', null, 'a key is not used again for another amount');
select results_eq(
  $$ select o_settled_paise from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 1000000,
       'upi', '123456789012', gen_random_uuid()) $$,
  $$ values (1000000::bigint) $$, 'he pays the last ₹10,000 by UPI');
select is_empty($$ select * from public.credit_report('00000000-0000-4000-8000-000000000001', now()) $$, 'and is off the report');
select throws_ok($$ select * from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 500000,
  'upi', '123456789012', gen_random_uuid()) $$, 'RVUTR', null, 'a UTR pays once');
select throws_ok($$ select * from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 500000,
  'cash', null, gen_random_uuid()) $$, 'RVNOD', null, 'Kunal owes nothing to repay');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select * from public.repay_markers('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 500000,
  'cash', null, gen_random_uuid()) $$, '42501', null, 'only a cashier takes a repayment');
select is_empty($$ select * from public.credit_report('00000000-0000-4000-8000-000000000001', now() - interval '1 second') $$,
  'a member sees no credit report');

-- Payment accounts and transfers (#94).
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select kind, name, balance_paise from public.payment_accounts('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('cash_drawer'::text, 'Cash drawer'::text, 6000000::bigint), ('bank'::text, 'Bank and UPI'::text, 1000000::bigint) $$,
  'the club starts with its drawer and its bank, with what the ledger has moved through them');
select throws_ok($$ select public.add_payment_account('00000000-0000-4000-8000-000000000001', 'cash_drawer', 'Second drawer', null) $$,
  '22023', null, 'an account added is a UPI handle or a bank account');
insert into ids select 'upi', public.add_payment_account('00000000-0000-4000-8000-000000000001', 'upi', '  Club UPI  ', 'rivr@okhdfc');
insert into ids select 'drawer', payment_account_id from public.payment_accounts('00000000-0000-4000-8000-000000000001') where kind = 'cash_drawer';
reset role;
select results_eq(
  $$ select p.name, a.kind::text, a.code ~ '^venue\.payment\.[a-p]{16}$' from public.payment_account p join public.ledger_account a on a.id = p.ledger_account_id
     where p.id = (select id from ids where name = 'upi') $$,
  $$ values ('Club UPI'::text, 'asset'::text, true) $$, 'each is an asset account of the ledger');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.transfer_between_accounts('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'drawer'),
  (select id from ids where name = 'upi'), 4000000, null, '00000000-0000-4000-8000-0000000c9802') $$, 'Aditya moves ₹40,000 from the drawer to UPI');
select is(public.transfer_between_accounts('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'drawer'),
  (select id from ids where name = 'upi'), 4000000, null, '00000000-0000-4000-8000-0000000c9802'),
  (select id from public.account_transfer), 'a retried tap gives the same transfer');
select throws_ok($$ select public.transfer_between_accounts('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'drawer'),
  (select id from ids where name = 'upi'), 400000, null, '00000000-0000-4000-8000-0000000c9802') $$, '22023', null,
  'and the same key with another amount is refused, never reported as moved');
select results_eq(
  $$ select name, balance_paise from public.payment_accounts('00000000-0000-4000-8000-000000000001') where name <> 'Bank and UPI' $$,
  $$ values ('Cash drawer'::text, 2000000::bigint), ('Club UPI'::text, 4000000::bigint) $$, 'once, and balanced');
select throws_ok($$ select public.transfer_between_accounts('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'upi'),
  (select id from ids where name = 'upi'), 100000, null, gen_random_uuid()) $$, '22023', null, 'not to the same account');
select throws_ok($$ select public.transfer_between_accounts('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'upi'),
  (select id from ids where name = 'drawer'), 100050, null, gen_random_uuid()) $$, '22023', null, 'in whole rupees');
select throws_ok($$ select public.transfer_between_accounts('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'upi'),
  (select p.id from public.payment_account p where p.venue_id = '00000000-0000-4000-8000-000000000002' limit 1), 100000, null, gen_random_uuid()) $$,
  '22023', null, 'between two of this venue''s accounts');
select results_eq(
  $$ select kind, amount_paise, balance_paise from public.account_statement((select id from ids where name = 'drawer'), now() - interval '1 day', now() + interval '1 day') $$,
  $$ values ('opening_balance'::text, 0::bigint, 0::bigint), ('marker_repayment'::text, 6000000::bigint, 6000000::bigint),
            ('account_transfer'::text, -4000000::bigint, 2000000::bigint) $$,
  'the drawer''s statement: its balance before, then each entry with the balance after');
select results_eq(
  $$ select kind, balance_paise from public.account_statement((select id from ids where name = 'drawer'), now() + interval '1 second', now() + interval '1 day') $$,
  $$ values ('opening_balance'::text, 2000000::bigint) $$, 'a later period opens where it stood');
select pg_temp.as_person('00000000-0000-4000-8000-000000000140');
select throws_ok($$ select public.add_payment_account('00000000-0000-4000-8000-000000000001', 'bank', 'HDFC current', 'HDFC ••1234') $$,
  '42501', null, 'a cashier adds no accounts');
select throws_ok($$ select public.transfer_between_accounts('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'upi'),
  (select id from ids where name = 'drawer'), 100000, null, gen_random_uuid()) $$, '42501', null, 'and moves no money between them');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.account_statement((select id from ids where name = 'drawer'), now() - interval '1 day', now()) $$,
  'a member sees no statement');
select is_empty($$ select * from public.payment_account $$, 'nor any account');

-- Expenses (#95).
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'food', public.add_expense_category('00000000-0000-4000-8000-000000000001', 'Food and drink');
select throws_ok($$ select public.add_expense_category('00000000-0000-4000-8000-000000000001', 'food AND drink') $$, '22023', null,
  'a category is named once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000140');
select throws_ok($$ select public.add_expense_category('00000000-0000-4000-8000-000000000001', 'Repairs') $$, '42501', null,
  'a cashier adds no categories');
select ok(private.may_upload_receipt('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000c9803.jpg'),
  'Rohit may upload the receipt of an expense not yet asked for');
select ok(not private.may_upload_receipt('00000000-0000-4000-8000-000000000001/anything.jpg'), 'but only at an expense''s path');
reset role;
-- Rohit's upload of the fruit receipt, as Storage records it.
insert into storage.objects (bucket_id, name, owner_id)
values ('expense-receipts', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000c9803.jpg', '00000000-0000-4000-8000-000000000140');
select pg_temp.as_person('00000000-0000-4000-8000-000000000140');
select throws_ok($$ select public.request_expense('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c9805',
  (select id from ids where name = 'food'), (select id from ids where name = 'drawer'), 250000, 'Fresh Fruits Co', null,
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000c9805.jpg') $$, '22023', null, 'a receipt never uploaded is refused');
select throws_ok($$ select public.request_expense('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c9803',
  (select id from ids where name = 'food'), (select id from ids where name = 'drawer'), 250000, 'Fresh Fruits Co', null,
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000c9899.jpg') $$, '22023', null, 'the receipt is this expense''s');
select throws_ok($$ select public.request_expense('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c9803',
  (select id from ids where name = 'food'), (select id from ids where name = 'drawer'), 250050, 'Fresh Fruits Co', null, null) $$,
  '22023', null, 'in whole rupees');
select lives_ok($$ select public.request_expense('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c9803',
  (select id from ids where name = 'food'), (select id from ids where name = 'drawer'), 250000, ' Fresh Fruits Co ', 'Fruit for the floor',
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000c9803.jpg') $$, 'Rohit asks for ₹2,500 of fruit, with the receipt');
select lives_ok($$ select public.request_expense('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c9803',
  (select id from ids where name = 'food'), (select id from ids where name = 'drawer'), 250000, 'Fresh Fruits Co', 'Fruit for the floor',
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000c9803.jpg') $$, 'a retried tap asks once');
select throws_ok($$ select public.request_expense('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c9803',
  (select id from ids where name = 'food'), (select id from ids where name = 'drawer'), 350000, 'Fresh Fruits Co', null, null) $$,
  '22023', null, 'and the same id with another amount is refused, not taken as asked');
select is((select count(*)::integer from public.expense), 1, 'the cage sees the expense');
select ok(not private.may_upload_receipt('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000c9803.jpg'),
  'and once it is asked for, no receipt is uploaded for it again');
select throws_ok($$ select public.decide_expense('00000000-0000-4000-8000-0000000c9803', true, null) $$, '42501', null,
  'a cashier decides no expense');
select throws_ok($$ insert into public.expense (venue_id, category_id, payment_account_id, amount_paise, payee, requested_by_staff_id)
  select '00000000-0000-4000-8000-000000000001', (select id from ids where name = 'food'), (select id from ids where name = 'drawer'), 100,
         'Direct', '00000000-0000-4000-8000-000000000140' $$, '42501', null, 'an expense is written only through the functions');
select ok(private.may_handle_receipts('00000000-0000-4000-8000-000000000001/x.jpg'), 'the cage handles the venue''s receipts');
select ok(not private.may_handle_receipts('00000000-0000-4000-8000-000000000009/x.jpg'), 'not a venue he does not work at');
select ok(not private.may_handle_receipts('receipts/x.jpg'), 'nor a path outside a venue''s folder');
reset role;
create temporary table expected_before as
select * from private.shift_expected((select s.id from public.cage_shift s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.closed_at is null));
grant select on expected_before to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.decide_expense('00000000-0000-4000-8000-0000000c9803', true, null) $$, 'Aditya approves it');
select results_eq(
  $$ select name, balance_paise from public.payment_accounts('00000000-0000-4000-8000-000000000001') where kind = 'cash_drawer' $$,
  $$ values ('Cash drawer'::text, 1750000::bigint) $$, 'and it posts from the drawer');
reset role;
select results_eq(
  $$ select e.status, private.account_balance(c.ledger_account_id), t.kind from public.expense e
     join public.expense_category c on c.id = e.category_id join public.ledger_transaction t on t.id = e.ledger_transaction_id $$,
  $$ values ('approved'::text, 250000::bigint, 'expense'::text) $$, 'to the category''s expense account');
select results_eq(
  $$ select e.cash_paise - b.cash_paise, e.receipts_paise - b.receipts_paise
     from private.shift_expected((select s.id from public.cage_shift s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.closed_at is null)) e
     cross join expected_before b $$,
  $$ values (-250000::bigint, 0::bigint) $$, 'and the end-of-day close expects ₹2,500 less in the drawer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.request_expense('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c9804',
  (select id from ids where name = 'food'), (select id from ids where name = 'upi'), 1200000, 'Caterer', null, null) $$,
  'Aditya asks for ₹12,000 for a caterer');
select throws_ok($$ select public.decide_expense('00000000-0000-4000-8000-0000000c9804', true, null) $$, '42501', null,
  'and cannot approve his own');
select throws_ok($$ select public.decide_expense('00000000-0000-4000-8000-0000000c9803', false, 'Twice') $$, '22023', null,
  'an expense is decided once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000191');
select throws_ok($$ select public.decide_expense('00000000-0000-4000-8000-0000000c9804', false, '  ') $$, '22023', null,
  'turning one down takes a reason');
select lives_ok($$ select public.decide_expense('00000000-0000-4000-8000-0000000c9804', false, 'No caterer this month') $$,
  'Nisha turns it down');
reset role;
select results_eq(
  $$ select status, decision_note, ledger_transaction_id is null from public.expense where id = '00000000-0000-4000-8000-0000000c9804' $$,
  $$ values ('rejected'::text, 'No caterer this month'::text, true) $$, 'and nothing posts');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select category, payment_account, payee, status, requested_by, is_mine, decided_by from public.venue_expenses('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Food and drink'::text, 'Club UPI'::text, 'Caterer'::text, 'rejected'::text, 'Aditya Malhotra'::text, true, 'Nisha Arora'::text),
            ('Food and drink'::text, 'Cash drawer'::text, 'Fresh Fruits Co'::text, 'approved'::text, 'Rohit Chauhan'::text, false, 'Aditya Malhotra'::text) $$,
  'the list says who asked and who decided, and which were his');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.expense $$, 'a member sees no expenses');
select is_empty($$ select * from public.venue_expenses('00000000-0000-4000-8000-000000000001') $$, 'nor the list');
select ok(not private.may_handle_receipts('00000000-0000-4000-8000-000000000001/x.jpg'), 'nor any receipt');

-- Cash taken to the bank is no player's receipt at the close (#45): the drawer expects less, the receipts the same.
reset role;
truncate expected_before;
insert into expected_before
select * from private.shift_expected((select s.id from public.cage_shift s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.closed_at is null));
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.transfer_between_accounts('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'drawer'),
  (select payment_account_id from public.payment_accounts('00000000-0000-4000-8000-000000000001') where kind = 'bank'), 100000, 'Banked',
  gen_random_uuid()) $$, 'Aditya banks ₹1,000 of the drawer');
reset role;
select results_eq(
  $$ select e.cash_paise - b.cash_paise, e.receipts_paise - b.receipts_paise
     from private.shift_expected((select s.id from public.cage_shift s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.closed_at is null)) e
     cross join expected_before b $$,
  $$ values (-100000::bigint, 0::bigint) $$, 'the close expects ₹1,000 less in the drawer and no more in receipts');

-- Venues apart, and the admin computer (#384).
select is(private.computer_kind_for('treasury.manage'), 'console'::public.device_kind, 'where a venue keeps money work to its computers, treasury work is the admin computer''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000193');
select ok((select count(*) > 0 from public.payment_account), 'Meher, who works only at the club, sees its accounts');
select is_empty($$ select * from public.payment_account where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'and none of the practice venue''s');
select is_empty($$ select * from public.account_statement((select p.id from public.payment_account p where p.venue_id = '00000000-0000-4000-8000-000000000002'
  limit 1), now() - interval '1 day', now() + interval '1 day') $$, 'nor its statements');
select is_empty($$ select * from public.venue_expenses('00000000-0000-4000-8000-000000000002') $$, 'nor its expenses');
select throws_ok($$ select public.transfer_between_accounts('00000000-0000-4000-8000-000000000002', (select id from ids where name = 'drawer'),
  (select id from ids where name = 'upi'), 100000, null, gen_random_uuid()) $$, '42501', null, 'and moves no money there');

select * from finish();
rollback;
