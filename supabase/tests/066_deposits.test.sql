-- UPI deposits (#29, decision 0064). 212 Vihaan (KYC done, Axis Bank UPI verified) pays ₹20,000 to the
-- club's UPI and enters the UTR; 139 Farah, a cashier, finds it in the bank and types the amount the bank
-- shows, crediting his wallet. A ₹1,50,000 one needs a second approver; 104 is another cashier. A UTR
-- pays one thing. 204 Rohan has no finished KYC; 106 Pema is a dealer; 301 Asha the practice member.
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
grant execute on function pg_temp.as_person(text), pg_temp.cash(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
insert into ids select 'axis', id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000212';

-- Where to pay, and the deposit given.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select results_eq($$ select upi_vpa, upi_payee_name from public.deposit_details() $$, $$ values ('rivr.gurugram@icici'::text, 'RIVR'::text) $$,
  'Vihaan sees the club''s UPI address and name');
insert into ids select 'deposit', public.request_deposit(2000000, '512345678901', (select id from ids where name = 'axis'), '00000000-0000-4000-8000-0000000e0001');
select is(public.request_deposit(2000000, '512345678901', (select id from ids where name = 'axis'), '00000000-0000-4000-8000-0000000e0001'),
  (select id from ids where name = 'deposit'), 'a retried tap submits once');
select throws_ok($$ select public.request_deposit(1000000, '512345678901', (select id from ids where name = 'axis'), gen_random_uuid()) $$, 'RVUTR', null,
  'a UTR is given once');
select throws_ok($$ select public.request_deposit(1000050, '512345678902', (select id from ids where name = 'axis'), gen_random_uuid()) $$, '22023', null,
  'whole rupees');
select throws_ok($$ select public.request_deposit(1000000, '5123456789', (select id from ids where name = 'axis'), gen_random_uuid()) $$, '22023', null,
  'and a 12-digit UTR');
select throws_ok($$ select public.request_deposit(1000000, '512345678903', (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000201'), gen_random_uuid()) $$,
  'RVPAY', null, 'from a verified UPI account of his own');
select is(pg_temp.cash('00000000-0000-4000-8000-000000000212'), 0::bigint, 'nothing reaches the wallet until the cage finds it');

-- The cage reconciles it: the payer, then the amount the bank shows.
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select results_eq($$ select full_name, utr, from_vpa, needs_second from public.waiting_deposits('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Vihaan Kapoor'::text, '512345678901'::text, 'vihaan.kapoor@okaxis'::text, false) $$,
  'the cashier sees whose, the UTR and the account it came from, not the amount given');
select throws_ok($$ select public.confirm_deposit((select id from ids where name = 'deposit'), 200000) $$, 'RVAMT', null,
  'a bank amount not the member''s confirms nothing');
select lives_ok($$ select public.confirm_deposit((select id from ids where name = 'deposit'), 2000000) $$, 'Farah confirms ₹20,000 as the bank shows it');
select throws_ok($$ select public.confirm_deposit((select id from ids where name = 'deposit'), 2000000) $$, '22023', null, 'once');
reset role;
select is(pg_temp.cash('00000000-0000-4000-8000-000000000212'), 2000000::bigint, 'Vihaan''s wallet holds ₹20,000');
select is((select count(*)::integer from public.outbox_event where event_type = 'deposit.received'), 1, 'deposit.received is emitted');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select results_eq($$ select kind, amount, utr from public.my_wallet_movement where kind = 'deposit' $$,
  $$ values ('deposit'::text, 2000000::bigint, '512345678901'::text) $$, 'and the deposit, with its UTR, on his Balance');

-- From the threshold up a second approver approves first.
insert into ids select 'large', public.request_deposit(15000000, '512345678904', (select id from ids where name = 'axis'), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select throws_ok($$ select public.confirm_deposit((select id from ids where name = 'large'), 15000000) $$, 'RVAPP', null,
  '₹1,50,000 waits for a second approver');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select public.second_approve_deposit((select id from ids where name = 'large')) $$, 'another cashier approves it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select lives_ok($$ select public.confirm_deposit((select id from ids where name = 'large'), 15000000) $$, 'and Farah confirms it');

-- Not found: nothing moves, and its UTR stays taken.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
insert into ids select 'wrong', public.request_deposit(1000000, '612345678901', (select id from ids where name = 'axis'), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select lives_ok($$ select public.reject_deposit((select id from ids where name = 'wrong')) $$, 'a UTR not in the bank is turned down');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select results_eq($$ select status from public.my_deposits() where utr = '612345678901' $$, $$ values ('not_found'::text) $$, 'Vihaan sees it not found');
select throws_ok($$ select public.request_deposit(1000000, '612345678901', (select id from ids where name = 'axis'), gen_random_uuid()) $$, 'RVUTR', null,
  'and that UTR is never given again, by him or anyone');

-- One UTR, one payment, whichever table holds it.
reset role;
select throws_ok($$ insert into public.withdrawal_request (venue_id, member_id, amount_paise, payout_account_id, status, utr, hold_transaction_id, outcome_transaction_id,
                      decided_at, idempotency_key)
                    select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 100, (select id from ids where name = 'axis'), 'sent',
                           '512345678901', t.id, t.id, now(), gen_random_uuid() from public.ledger_transaction t
                    where t.venue_id = '00000000-0000-4000-8000-000000000001' limit 1 $$,
  'RVUTR', null, 'a deposit''s UTR pays no withdrawal');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 2, '9000000212');
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'upi', gen_random_uuid(), '512345678904') $$,
  'RVUTR', null, 'nor a buy-in by UPI');
select lives_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'upi', gen_random_uuid(), '712345678909') $$,
  'while a new UTR buys in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.request_deposit(1000000, '712345678909', (select id from ids where name = 'axis'), gen_random_uuid()) $$, 'RVUTR', null,
  'and that buy-in''s UTR is no deposit');

-- Who may: a member with KYC finished; the cage, never for its own; nobody else, nor another venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000204');
select throws_ok($$ select public.request_deposit(100000, '712345678901', gen_random_uuid(), gen_random_uuid()) $$, 'RVKYC', null, 'never without a finished identity check');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.deposit_request $$, 'a dealer sees no deposits');
select is_empty($$ select * from public.waiting_deposits('00000000-0000-4000-8000-000000000001') $$, 'nor the cage''s list');
select throws_ok($$ select public.request_deposit(100000, '712345678902', gen_random_uuid(), gen_random_uuid()) $$, '42501', null, 'and deposits nothing: not a member');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select is_empty($$ select * from public.deposit_request $$, 'the practice venue''s member sees none of the club''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
insert into ids select 'own', public.request_deposit(1000000, '812345678901', (select id from ids where name = 'axis'), gen_random_uuid());
reset role;
update public.member set phone = '+919000000139' where id = '00000000-0000-4000-8000-000000000212';
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select throws_ok($$ select public.confirm_deposit((select id from ids where name = 'own'), 1000000) $$, '42501', null,
  'a cashier who is also the member confirms none of their own');
reset role;
update public.member set phone = '+919000000212' where id = '00000000-0000-4000-8000-000000000212';
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000139' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select is_empty($$ select * from public.deposit_request where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'the practice venue''s cashier sees none of the club''s');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000139' and venue_id = '00000000-0000-4000-8000-000000000001';

-- A day's waiting and turned-down count; a tier without deposits; a frozen venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.request_deposit(1000000, '912345678901', (select id from ids where name = 'axis'), gen_random_uuid()) $$, 'a third today');
select throws_ok($$ select public.request_deposit(1000000, '912345678902', (select id from ids where name = 'axis'), gen_random_uuid()) $$, 'RVMAX', null,
  'but not a fourth: waiting and turned down count');
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'balance.deposits', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select is_empty($$ select * from public.deposit_details() $$, 'without deposits, no UPI details');
select throws_ok($$ select public.request_deposit(100000, '912345678903', (select id from ids where name = 'axis'), gen_random_uuid()) $$, '42501', null, 'and no deposit');
select is((select count(*)::integer from public.my_deposits()), 5, 'though his deposits stay his to read (decision 0064)');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select throws_ok($$ select public.confirm_deposit((select id from ids where name = 'own'), 1000000) $$, 'RVFRZ', null,
  'nothing is confirmed while the venue is frozen');
reset role;

select * from finish();
rollback;
