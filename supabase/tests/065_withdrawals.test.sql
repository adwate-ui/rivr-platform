-- Withdrawals (#21; design prompt flow 9). 201 Arjun (₹1,85,000 of cash, KYC done, HDFC Bank UPI
-- verified) withdraws ₹1,00,000: 137 Imran, a cashier, sends it with UTR 412908771204 once 138 Devika,
-- the floor manager, has approved it as second approver (the club's threshold is ₹1,00,000). 211
-- Ishaan's smaller one is declined and returns. 106 Pema is a dealer; 301 Asha the practice member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.cash(p_member text) returns bigint language sql as $$
  select coalesce(-sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.member_id = p_member::uuid and a.code = 'member.cash';
$$;
create function pg_temp.venue_balance(p_code text) returns bigint language sql as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is null;
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create temp table opening as select pg_temp.venue_balance('venue.bank') as bank;
insert into ids select 'hdfc', id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000201';

-- Arjun asks for ₹1,00,000 to HDFC Bank: it leaves his wallet at once, held for the cage.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.request_withdrawal(18500100, (select id from ids where name = 'hdfc'), gen_random_uuid()) $$, 'RVSHT', null,
  'never more than the wallet holds');
select throws_ok($$ select public.request_withdrawal(1000050, (select id from ids where name = 'hdfc'), gen_random_uuid()) $$, '22023', null,
  'whole rupees only');
insert into ids select 'flow 9', public.request_withdrawal(10000000, (select id from ids where name = 'hdfc'), '00000000-0000-4000-8000-0000000d0001');
select is(public.request_withdrawal(10000000, (select id from ids where name = 'hdfc'), '00000000-0000-4000-8000-0000000d0001'),
  (select id from ids where name = 'flow 9'), 'a retried tap asks once');
select throws_ok($$ select public.request_withdrawal(500000, (select id from ids where name = 'hdfc'), gen_random_uuid()) $$, 'RVPND', null,
  'one waits at a time');
reset role;
select is(pg_temp.cash('00000000-0000-4000-8000-000000000201'), 8500000::bigint, 'Arjun''s wallet holds ₹85,000');
select is(pg_temp.venue_balance('venue.withdrawals_pending'), -10000000::bigint, '₹1,00,000 is held for the cage');
select is((select count(*)::integer from public.outbox_event where event_type = 'withdrawal.requested'), 1, 'withdrawal.requested is emitted');

-- The cage's list: the second approver is needed.
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select results_eq($$ select full_name, amount_paise, bank_name, vpa, needs_second, approved_by from public.waiting_withdrawals('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Arjun Mehta'::text, 10000000::bigint, 'HDFC Bank'::text, 'arjun.mehta@hdfcbank'::text, true, '{}'::text[]) $$,
  'the cage sees Arjun''s ₹1,00,000 to HDFC Bank, needing a second approver');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'flow 9'), '412908771204') $$, 'RVAPP', null,
  'the cashier cannot send it before a second approver approves');
select lives_ok($$ select public.second_approve_withdrawal((select id from ids where name = 'flow 9')) $$, 'the cashier approves it too');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'flow 9'), '412908771204') $$, 'RVAPP', null,
  'but is not their own second approver');
select pg_temp.as_person('00000000-0000-4000-8000-000000000138');
select lives_ok($$ select public.second_approve_withdrawal((select id from ids where name = 'flow 9')) $$, 'Devika, the floor manager, approves it');
select results_eq($$ select vpa, bank_name from public.waiting_withdrawals('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('••••@hdfcbank'::text, 'HDFC Bank'::text) $$, 'seeing the bank, not the full address: she does not pay it');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'flow 9'), '412908771204') $$, '42501', null,
  'but sends nothing: withdrawals are the cage''s');
select ok((select approved_by @> array['Imran Siddiqui', 'Devika Rana'] and cardinality(approved_by) = 2 from public.waiting_withdrawals('00000000-0000-4000-8000-000000000001')),
  'both approvals show');

-- Imran sends it with UTR 412908771204 (flow 9).
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'flow 9'), '41290877120') $$, '22023', null, 'with a 12-digit UTR');
select lives_ok($$ select public.send_withdrawal((select id from ids where name = 'flow 9'), '412908771204') $$, 'Imran sends it');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'flow 9'), '412908771204') $$, '22023', null, 'once');
reset role;
select results_eq($$ select status, utr from public.withdrawal_request where id = (select id from ids where name = 'flow 9') $$,
  $$ values ('sent'::text, '412908771204'::text) $$, 'it is sent with its UTR');
select is(pg_temp.venue_balance('venue.withdrawals_pending'), 0::bigint, 'nothing is held any more');
select is((select bank from opening) - pg_temp.venue_balance('venue.bank'), 10000000::bigint, 'and ₹1,00,000 left the bank');
select results_eq($$ select payload ->> 'utr', (payload ->> 'amount_paise')::bigint from public.outbox_event where event_type = 'withdrawal.sent' $$,
  $$ values ('412908771204'::text, 10000000::bigint) $$, 'withdrawal.sent is emitted for the push');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select status, utr from public.withdrawal_request $$, $$ values ('sent'::text, '412908771204'::text) $$,
  'Arjun sees it sent, with the UTR');
select results_eq($$ select kind, amount, bank_name from public.my_wallet_movement where kind = 'withdrawal' $$,
  $$ values ('withdrawal'::text, -10000000::bigint, 'HDFC Bank'::text) $$, 'and the movement to HDFC Bank on his Balance');

-- Below the threshold no second approver is needed; a declined one returns to the wallet.
reset role;
insert into public.payout_account (venue_id, member_id, kind, bank_name, vpa, status, decided_at, decided_by_staff_id)
select s.venue_id, '00000000-0000-4000-8000-000000000211', 'upi', 'HDFC Bank', 'ishaan@hdfcbank', 'verified', now(), s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-withdrawal-deposit',
  jsonb_build_array(jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.bank'), 'amount', '2000000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000211' and code = 'member.cash'),
                                       'amount', '-2000000')), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'small', public.request_withdrawal(500000, (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000211'), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select is((select needs_second from public.waiting_withdrawals('00000000-0000-4000-8000-000000000001')), false, '₹5,000 needs no second approver');
select throws_ok($$ select public.decline_withdrawal((select id from ids where name = 'small'), '') $$, '22023', null, 'declined only with a reason');
select lives_ok($$ select public.decline_withdrawal((select id from ids where name = 'small'), 'UPI name does not match') $$, 'the cashier declines it');
reset role;
select is(pg_temp.cash('00000000-0000-4000-8000-000000000211'), 2000000::bigint, 'and the ₹5,000 is back in Ishaan''s wallet');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select kind, amount from public.my_wallet_movement where kind like 'withdrawal%' order by amount $$,
  $$ values ('withdrawal'::text, -500000::bigint), ('withdrawal_return', 500000) $$, 'his Balance shows it held and returned');

-- Below the threshold one cashier sends it alone; never their own.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'alone', public.request_withdrawal(500000, (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000211'), gen_random_uuid());
reset role;
update public.member set phone = '+919000000137' where id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'alone'), '512908771204') $$, '42501', null,
  'a cashier who is also the member sends none of their own');
reset role;
update public.member set phone = '+919000000211' where id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select lives_ok($$ select public.send_withdrawal((select id from ids where name = 'alone'), '512908771204') $$, 'and sends ₹5,000 alone: below the threshold');

-- Who may: not without KYC, nor to an account not verified; a dealer and another venue see nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'frozen', public.request_withdrawal(500000, (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000211'), gen_random_uuid());
reset role;
update public.kyc_record set status = 'started', verified_at = null where member_id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.request_withdrawal(500000, (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000211'), gen_random_uuid()) $$,
  'RVKYC', null, 'never without a finished identity check');
reset role;
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000211';
update public.payout_account set removed_at = now() where member_id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.request_withdrawal(500000, (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000211'), gen_random_uuid()) $$,
  'RVPAY', null, 'nor to an account removed or not verified');
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'frozen'), '612908771204') $$, 'RVPAY', null,
  'and the cage sends none to an account removed since it was asked');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.withdrawal_request $$, 'a dealer sees no withdrawals');
select is_empty($$ select * from public.waiting_withdrawals('00000000-0000-4000-8000-000000000001') $$, 'nor the cage''s list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select is_empty($$ select * from public.withdrawal_request $$, 'the practice venue''s member sees none of the club''s');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000137' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select is_empty($$ select * from public.withdrawal_request where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'the practice venue''s cashier sees none of the club''s');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000137' and venue_id = '00000000-0000-4000-8000-000000000001';

-- A frozen member's withdrawal is neither sent nor declined until the freeze is released.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000211', 'Dispute');
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'frozen'), '612908771204') $$, 'RVMBR', null,
  'nothing is sent for a frozen member');
select throws_ok($$ select public.decline_withdrawal((select id from ids where name = 'frozen'), 'Dispute at the cage') $$, 'RVMBR', null,
  'nor declined');
reset role;

-- Switched off: nothing is asked or sent, but a decline still returns the money; frozen, nothing at all.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
insert into ids select 'late', public.request_withdrawal(500000, (select id from ids where name = 'hdfc'), gen_random_uuid());
reset role;
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'withdrawals', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.request_withdrawal(100000, (select id from ids where name = 'hdfc'), gen_random_uuid()) $$, 'RVKIL', null,
  'none is asked while withdrawals are switched off');
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select throws_ok($$ select public.send_withdrawal((select id from ids where name = 'late'), '712908771204') $$, 'RVKIL', null, 'or sent');
select lives_ok($$ select public.decline_withdrawal((select id from ids where name = 'late'), 'Withdrawals are paused') $$,
  'but a decline returns it to the wallet');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.request_withdrawal(100000, (select id from ids where name = 'hdfc'), gen_random_uuid()) $$, 'RVFRZ', null,
  'none while the venue is frozen');
reset role;
select * from finish();
rollback;
