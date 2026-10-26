-- Withdrawal methods (#475; decision 0231). 201 Arjun (cash, KYC done, HDFC Bank UPI verified) withdraws ₹5,000 at a
-- time, under the second-approval threshold; 137 Imran, a cashier who approves withdrawals, pays him: in cash from
-- the drawer, through Cashfree from the Cashfree payout balance, and by typed UTR from the bank. What Cashfree
-- says of a payout (sent, failed, still on its way, reversed later) moves the withdrawal and its money; a stale
-- attempt changes nothing. Cashfree pays UPI addresses only. Only the service role hears from Cashfree.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.venue_balance(p_code text) returns bigint language sql as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is null;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_person(text) to authenticated;
insert into ids select 'hdfc', id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000201';
with account as (
  insert into public.payout_account (venue_id, member_id, kind, bank_name, account_number, ifsc, holder_name, status, decided_at,
                                     decided_by_staff_id)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'bank', 'HDFC Bank', '50100012345678', 'HDFC0000001',
         'Arjun Mehta', 'verified', now(), s.id
  from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000137' and s.venue_id = '00000000-0000-4000-8000-000000000001'
  returning id
)
insert into ids select 'bank', id from account;

-- Arjun asks for ₹5,000 to his UPI address.
create function pg_temp.ask(p_name text, p_account text) returns void language sql as $$
  select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
  insert into ids select p_name, public.request_withdrawal(500000, (select id from ids where name = p_account), gen_random_uuid());
  reset role;
$$;

-- Cash at the counter, from the drawer.
create temp table before_cash as select pg_temp.venue_balance('venue.cash_drawer') as drawer;
select pg_temp.ask('cash', 'hdfc');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.pay_withdrawal_in_cash((select id from ids where name = 'cash')) $$, '42501', null, 'a member pays themselves nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select lives_ok($$ select public.pay_withdrawal_in_cash((select id from ids where name = 'cash')) $$, 'a cashier pays a withdrawal in cash');
reset role;
select results_eq($$ select status, method, utr from public.withdrawal_request where id = (select id from ids where name = 'cash') $$,
  $$ values ('sent'::text, 'cash'::text, null::text) $$, 'it is sent, in cash, with no UTR');
select is(pg_temp.venue_balance('venue.cash_drawer'), (select drawer from before_cash) - 500000, 'and the drawer paid it');

-- Through Cashfree: paying, then sent, from the Cashfree payout balance.
select pg_temp.ask('cashfree', 'hdfc');
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select lives_ok($$ select public.pay_withdrawal_through_cashfree((select id from ids where name = 'cashfree')) $$, 'a cashier pays one through Cashfree');
reset role;
select results_eq($$ select status, method, payout_key is not null from public.withdrawal_request where id = (select id from ids where name = 'cashfree') $$,
  $$ values ('paying'::text, 'cashfree'::text, true) $$, 'it waits as paying, with a key for Cashfree');
select results_eq($$ select may_pay, account_ok, attempted from public.claim_withdrawal_payouts() where withdrawal_request_id = (select id from ids where name = 'cashfree') $$,
  $$ values (true, true, false) $$, 'the payout function claims it, money free to go out to an account in use, no send tried yet');
select is_empty($$ select 1 from public.claim_withdrawal_payouts() where withdrawal_request_id = (select id from ids where name = 'cashfree') $$,
  'and a second run does not take it again until it is due');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.request_withdrawal(500000, (select id from ids where name = 'hdfc'), gen_random_uuid()) $$, 'RVPND', null,
  'one paying through Cashfree is the member''s one withdrawal at a time');
reset role;
create temp table attempt as select payout_key from public.withdrawal_request where id = (select id from ids where name = 'cashfree');

-- Checked again at the moment of sending: withdrawals stopped, or the account removed, since the claim stops the send.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'withdrawals', 'Bank outage', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select is(public.begin_withdrawal_payout((select id from ids where name = 'cashfree'), (select payout_key from attempt)), null,
  'withdrawals stopped since the claim: nothing is sent');
update public.control_state
set released_at = now(), release_reason = 'Bank back',
    released_by_staff_id = (select s.id from public.staff s
                            where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001')
where level = 'feature_kill' and released_at is null;
update public.payout_account set removed_at = now() where id = (select id from ids where name = 'hdfc');
select is(public.begin_withdrawal_payout((select id from ids where name = 'cashfree'), (select payout_key from attempt)), null,
  'nor to an account removed since the claim');
update public.payout_account set removed_at = null where id = (select id from ids where name = 'hdfc');
select ok((select payout_attempted_at is null from public.withdrawal_request where id = (select id from ids where name = 'cashfree')),
  'and neither marks a send, so no transfer can exist');
select ok(public.begin_withdrawal_payout((select id from ids where name = 'cashfree'), (select payout_key from attempt)),
  'the function marks the send it is about to try');
select ok((select payout_attempted_at is not null from public.withdrawal_request where id = (select id from ids where name = 'cashfree')),
  'so from now a transfer may exist, and is looked up before anything else');
select is(private.record_withdrawal_payout((select id from ids where name = 'cashfree'), gen_random_uuid(), 'pending', 'cf-0', null, null),
  'stale', 'an answer for another attempt changes nothing');
select is(private.record_withdrawal_payout((select id from ids where name = 'cashfree'), (select payout_key from attempt), 'pending', 'cf-1', null, null),
  'pending', 'still on its way, its transfer id is kept');
select is(private.record_withdrawal_payout((select id from ids where name = 'cashfree'), (select payout_key from attempt), 'sent', 'cf-1', '412900000001', null),
  'sent', 'sent');
select results_eq($$ select status, utr, payout_id from public.withdrawal_request where id = (select id from ids where name = 'cashfree') $$,
  $$ values ('sent'::text, '412900000001'::text, 'cf-1'::text) $$, 'with Cashfree''s UTR');
select is(pg_temp.venue_balance('venue.cashfree'), -500000::bigint, 'paid from the Cashfree payout balance');

-- Reversed after it was sent: the posting undone, back to the cage with the reason.
select is(private.record_withdrawal_payout((select id from ids where name = 'cashfree'), (select payout_key from attempt), 'failed', 'cf-1', null, 'REVERSED'),
  'reversed', 'Cashfree reverses it');
select results_eq($$ select status, method, utr, payout_failure from public.withdrawal_request where id = (select id from ids where name = 'cashfree') $$,
  $$ values ('waiting'::text, null::text, null::text, 'Cashfree reversed the payout after it was sent'::text) $$,
  'it waits for the cage again, saying why');
select is(pg_temp.venue_balance('venue.cashfree'), 0::bigint, 'and the Cashfree payout balance has the money back');

-- A failed attempt: back to the cage, and paid another way.
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select public.pay_withdrawal_through_cashfree((select id from ids where name = 'cashfree'));
reset role;
select is(private.record_withdrawal_payout((select id from ids where name = 'cashfree'),
            (select payout_key from public.withdrawal_request where id = (select id from ids where name = 'cashfree')), 'failed', 'cf-2', null,
            'Cashfree ERROR_SELECTING_FUND_SOURCE'),
  'failed', 'an attempt that fails');
select results_eq($$ select status, payout_failure from public.withdrawal_request where id = (select id from ids where name = 'cashfree') $$,
  $$ values ('waiting'::text, 'Cashfree ERROR_SELECTING_FUND_SOURCE'::text) $$, 'waits for the cage with the failure');
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select lives_ok($$ select public.send_withdrawal((select id from ids where name = 'cashfree'), '412900000002') $$, 'which pays it by typed UTR instead');
reset role;
select results_eq($$ select status, method from public.withdrawal_request where id = (select id from ids where name = 'cashfree') $$,
  $$ values ('sent'::text, 'upi_manual'::text) $$, 'from the bank');

-- Cashfree pays UPI addresses only.
select pg_temp.ask('to bank', 'bank');
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select throws_ok($$ select public.pay_withdrawal_through_cashfree((select id from ids where name = 'to bank')) $$, 'RVPAY', null,
  'a bank account is paid another way');
reset role;

-- A transfer Cashfree sent for an attempt the withdrawal has moved on from: the owner hears of it.
select is(private.record_withdrawal_payout((select id from ids where name = 'cash'), gen_random_uuid(), 'sent', 'cf-9', null, null), 'stale',
  'a sent answer for a withdrawal paid another way changes nothing');
select ok(exists (select 1 from public.alert where kind = 'withdrawal.payout_orphaned'), 'but alerts the owner to put it right');

-- Trouble with a payout (one the function could not record) alerts the owner, at most every six hours.
select public.note_withdrawal_payout_trouble((select id from ids where name = 'cash'));
select public.note_withdrawal_payout_trouble((select id from ids where name = 'cash'));
select is((select count(*)::integer from public.alert where kind = 'withdrawal.payout_stuck'), 1, 'a payout in trouble alerts once in six hours');

select ok(not has_function_privilege('authenticated', 'public.record_withdrawal_payout(uuid, uuid, text, text, text, text)', 'execute'),
  'nobody signed in can say what Cashfree did');
select ok(not has_function_privilege('authenticated', 'public.claim_withdrawal_payouts()', 'execute'), 'or claim the payouts');
select ok(has_function_privilege('service_role', 'public.claim_withdrawal_payouts()', 'execute'), 'which the payout function does');
select ok(not has_function_privilege('authenticated', 'public.begin_withdrawal_payout(uuid, uuid)', 'execute'), 'nor mark a send');

select * from finish();
rollback;
