-- The double-entry ledger: balanced, single-unit, idempotent, immutable, reversible once, and
-- visible only to the account's member and the venue's ledger staff.
-- Gurugram ...0001, practice ...0002. 104 Sana (cashier, ledger.read), 201 Arjun, 202 Kabir.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.account(p_code text, p_member uuid default null, p_venue uuid default '00000000-0000-4000-8000-000000000001')
returns uuid language sql as $$
  select id from public.ledger_account where venue_id = p_venue and code = p_code and member_id is not distinct from p_member;
$$;
create function pg_temp.lines(p_debit uuid, p_credit uuid, p_amount bigint)
returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('account_id', p_debit, 'amount', p_amount::text),
                           jsonb_build_object('account_id', p_credit, 'amount', (-p_amount)::text));
$$;
create function pg_temp.cash(p_member uuid)
returns bigint language sql as $$
  select natural_balance from public.ledger_balance where account_id = pg_temp.account('member.cash', p_member);
$$;

-- First, before this transaction writes anything (pending commit-time checks would also block it).
select throws_ok($$ truncate public.ledger_entry $$, '42501', null, 'entries cannot be truncated');

-- Kabir buys ₹10,000 of chips from his cash balance.
select lives_ok(
  $$ select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'buy_in', 'test-buy-in-1',
       pg_temp.lines(pg_temp.account('venue.cash_drawer'), pg_temp.account('member.cash', '00000000-0000-4000-8000-000000000202'), 1000000)) $$,
  'a balanced transaction posts');
select is(pg_temp.cash('00000000-0000-4000-8000-000000000202'), 1000000::bigint, 'the balance is the sum of entries');

select is(
  private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'buy_in', 'test-buy-in-1',
    pg_temp.lines(pg_temp.account('venue.cash_drawer'), pg_temp.account('member.cash', '00000000-0000-4000-8000-000000000202'), 1000000)),
  (select id from public.ledger_transaction where idempotency_key = 'test-buy-in-1'),
  'replaying the same idempotency key returns the first transaction');
select is(pg_temp.cash('00000000-0000-4000-8000-000000000202'), 1000000::bigint, 'and writes nothing new');

select throws_ok(
  $$ select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'buy_in', 'test-unbalanced',
       jsonb_build_array(jsonb_build_object('account_id', pg_temp.account('venue.cash_drawer'), 'amount', '5000'),
                         jsonb_build_object('account_id', pg_temp.account('venue.rake'), 'amount', '-4950'))) $$,
  '23514', null, 'lines that do not sum to zero are refused');

-- The commit-time check catches a transaction written without the posting function.
-- SET CONSTRAINTS ... IMMEDIATE runs the checks that would otherwise wait for commit.
create function pg_temp.write_one_sided_and_commit_checks()
returns void language plpgsql as $$
begin
  with t as (insert into public.ledger_transaction (venue_id, kind, idempotency_key)
             values ('00000000-0000-4000-8000-000000000001', 'adjustment', 'test-one-sided') returning id)
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select '00000000-0000-4000-8000-000000000001', t.id, pg_temp.account('venue.rake'), 5000 from t;
  set constraints all immediate;
end;
$$;
select throws_ok($$ select pg_temp.write_one_sided_and_commit_checks() $$, '23514', null, 'a one-sided transaction cannot commit');
select throws_ok(
  $$ select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'adjustment', 'test-mixed-units',
       pg_temp.lines(pg_temp.account('member.points', '00000000-0000-4000-8000-000000000202'), pg_temp.account('venue.rake'), 100)) $$,
  '23514', null, 'points and money never share a transaction');
select throws_ok(
  $$ select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'adjustment', 'test-cross-venue',
       pg_temp.lines(pg_temp.account('venue.cash_drawer'), pg_temp.account('venue.rake', null, '00000000-0000-4000-8000-000000000002'), 5000)) $$,
  '23503', null, 'one venue''s transaction cannot touch another venue''s account');

select throws_ok($$ update public.ledger_entry set amount = 1 $$, '42501', null, 'entries cannot be edited');
select throws_ok($$ delete from public.ledger_entry $$, '42501', null, 'entries cannot be deleted');

-- A mistake is corrected by a reversing transaction, once.
select lives_ok(
  $$ select private.reverse_ledger_transaction((select id from public.ledger_transaction where idempotency_key = 'test-buy-in-1'),
       'test-reverse-1', 'Wrong member') $$,
  'a transaction is reversed');
select is(pg_temp.cash('00000000-0000-4000-8000-000000000202'), 0::bigint, 'the reversal restores the balance');
select throws_ok(
  $$ select private.reverse_ledger_transaction((select id from public.ledger_transaction where idempotency_key = 'test-buy-in-1'),
       'test-reverse-2', 'Again') $$,
  '23505', null, 'a transaction is reversed at most once');

select throws_ok(
  $$ insert into public.chip_denomination (venue_id, value_paise, name) values ('00000000-0000-4000-8000-000000000001', 7500, '₹75') $$,
  '23514', null, 'every chip is a multiple of ₹50');

-- Who sees what.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*) from public.ledger_account)::int, 4, 'a member sees his four accounts');
select is((select natural_balance from public.ledger_balance where code = 'member.cash'), 18500000::bigint, 'and his cash balance');
select is((select count(*) from public.ledger_entry e join public.ledger_account a on a.id = e.account_id where a.member_id <> '00000000-0000-4000-8000-000000000201')::int, 0,
  'he sees no one else''s entries');
select throws_ok(
  $$ select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'gift', 'test-self-credit',
       pg_temp.lines(pg_temp.account('venue.opening_balance'), pg_temp.account('member.cash', '00000000-0000-4000-8000-000000000201'), 100)) $$,
  '42501', null, 'a member cannot post to the ledger');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select ok((select count(*) from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001') > 4, 'a cashier sees the venue''s accounts');
reset role;

select * from finish();
rollback;
