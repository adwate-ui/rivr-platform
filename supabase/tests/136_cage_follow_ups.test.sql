-- Cage follow-ups from the #57 review (#335). 211 Ishaan (identity check finished) sits at Table 3 (buy-in
-- ₹10,000) with ₹2,00,000 of wallet cash; 201 Arjun owes a ₹50,000 marker; 201 Arjun and 202 Kabir book the
-- Academy. 103 Aditya is the floor and Academy staff; 104 Sana a cashier (cage.transact).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Learn, the Academy and Events are off since #637 (decision 0284): this test of them turns them back on for every tier.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, k.key, true, 'locked', now() - interval '1 second'
from public.tier t cross join (values ('learn.library'), ('academy.booking'), ('events.book')) as k (key);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.member_account(p_member uuid, p_code text) returns uuid language sql as $$
  select id from public.ledger_account where member_id = p_member and code = p_code;
$$;
create function pg_temp.venue_account(p_code text) returns uuid language sql as $$
  select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = p_code and member_id is null;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
grant execute on function pg_temp.as_person(text), pg_temp.id(text) to authenticated;

-- Ishaan's wallet holds ₹2,00,000, and he sits at Table 3.
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-335-deposit',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.venue_account('venue.bank'), 'amount', '20000000'),
                    jsonb_build_object('account_id', pg_temp.member_account('00000000-0000-4000-8000-000000000211', 'member.cash'),
                                       'amount', '-20000000')), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'session', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211');

-- A request id is one buy-in: a replay with another UTR, for another request, or of another kind of cage
-- transaction is refused, never reported as the first.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'upi', public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi',
  '00000000-0000-4000-8000-000000335001', '223456789012');
select is(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi',
  '00000000-0000-4000-8000-000000335001', '223456789012'), pg_temp.id('upi'), 'a retried tap with the same UTR is the same buy-in');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi',
  '00000000-0000-4000-8000-000000335001', '223456789013') $$, '22023', null, 'a replay with another UTR is refused');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'asked', public.request_buy_in(pg_temp.id('session'), 1000000, '00000000-0000-4000-8000-000000335002');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'approved', public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet',
  '00000000-0000-4000-8000-000000335003', null, pg_temp.id('asked'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'asked again', public.request_buy_in(pg_temp.id('session'), 1000000, '00000000-0000-4000-8000-000000335004');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet',
  '00000000-0000-4000-8000-000000335003', null, pg_temp.id('asked')), pg_temp.id('approved'), 'approving the same request again is the same buy-in');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet',
  '00000000-0000-4000-8000-000000335003', null, pg_temp.id('asked again')) $$, '22023', null,
  'a replay for another request is refused, not reported as approving it');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet',
  '00000000-0000-4000-8000-000000335003') $$, '22023', null, 'and so is one without its request');
select results_eq($$ select request_id from public.cage_queue('00000000-0000-4000-8000-000000000001') $$, $$ values (pg_temp.id('asked again')) $$,
  'the other request still waits for the cage');

-- Arjun (201) repays ₹10,000 of the ₹50,000 marker the seed gives him.
insert into ids select 'repaid', r.o_cage_transaction_id from public.repay_markers('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000201', 1000000, 'cash', null, '00000000-0000-4000-8000-000000335005') r;
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 1000000, 'cash',
  '00000000-0000-4000-8000-000000335005') $$, '22023', null, 'a marker repayment''s request id is no buy-in');

-- One bank transfer pays for one thing: a UTR an Academy payment gave buys no chips, and a buy-in's UTR pays
-- for no Academy seat.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'batch', public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Level 1, follow-ups', current_date + 10, current_date + 12, 5);
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
insert into ids select 'arjun', public.book_academy(pg_temp.id('batch'));
select lives_ok($$ select public.claim_academy_payment(pg_temp.id('arjun'), '323456789012') $$, 'Arjun gives the UTR of his Academy payment');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi',
  gen_random_uuid(), '323456789012') $$, 'RVUTR', null, 'that UTR buys no chips while the cage checks it');
select lives_ok($$ select public.confirm_academy_payment(pg_temp.id('arjun'), '323456789012') $$, 'the cashier finds it in the bank');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi',
  gen_random_uuid(), '323456789012') $$, 'RVUTR', null, 'nor once it has paid for his seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
insert into ids select 'kabir', public.book_academy(pg_temp.id('batch'));
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('kabir'), '223456789012') $$, 'RVUTR', null,
  'the UTR of Ishaan''s buy-in pays for no Academy seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.record_academy_payment(pg_temp.id('kabir'), '223456789012') $$, 'RVUTR', null,
  'nor when Academy staff record it');

-- The cage's wallet, bonus and markers are the ledger's balances, read through its one balance function.
reset role;
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 500000, 'Follow-up test',
  now() + interval '1 day', 'test:335:bonus');
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'marker', 'test-335-marker',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.member_account('00000000-0000-4000-8000-000000000211', 'member.receivable'), 'amount', '1500000'),
                    jsonb_build_object('account_id', pg_temp.venue_account('venue.cash_drawer'), 'amount', '-1500000')), null);
create temp table ledger_says as
  select (select natural_balance from public.ledger_balance where member_id = '00000000-0000-4000-8000-000000000211' and code = 'member.cash') as wallet,
         (select natural_balance from public.ledger_balance where member_id = '00000000-0000-4000-8000-000000000211' and code = 'member.bonus') as bonus,
         (select natural_balance from public.ledger_balance where member_id = '00000000-0000-4000-8000-000000000211' and code = 'member.receivable') as markers;
grant select on ledger_says to authenticated;
select results_eq($$ select wallet, markers from ledger_says $$, $$ values (19000000::bigint, 1500000::bigint) $$,
  'the ledger holds ₹1,90,000 in Ishaan''s wallet and ₹15,000 on his markers');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select wallet_paise, bonus_paise, markers_paise from public.cage_members('00000000-0000-4000-8000-000000000001', 'Ishaan') $$,
  $$ select wallet, bonus, markers from ledger_says $$, 'and the cage shows his wallet, bonus and markers as the ledger has them');
reset role;
select alike(pg_get_functiondef('private.wallet_cash(uuid)'::regprocedure), '%private.account_balance(%',
  'the wallet is read through the ledger''s balance function');
select unalike(pg_get_functiondef('private.wallet_cash(uuid)'::regprocedure), '%ledger_entry%', 'not summed on its own');
select alike(pg_get_functiondef('private.cage_members(uuid, text)'::regprocedure), '%private.account_balance(%',
  'and so are the bonus and markers the cage shows');
select unalike(pg_get_functiondef('private.cage_members(uuid, text)'::regprocedure), '%ledger_entry%', 'with no sums of their own');
select ok(not has_function_privilege('authenticated', 'private.wallet_cash(uuid)', 'execute'), 'the wallet function stays the server''s own');
select ok(not has_function_privilege('anon', 'private.cage_members(uuid, text)', 'execute')
          and not has_function_privilege('anon', 'private.cage_buy_in(uuid, uuid, bigint, text, uuid, text, uuid)', 'execute'),
  'and no one signed out reaches the cage');

select * from finish();
rollback;
