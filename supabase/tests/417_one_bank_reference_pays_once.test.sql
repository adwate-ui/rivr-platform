-- One bank transfer pays for one thing (#335): a UTR given for a buy-in by UPI, a deposit or a withdrawal is refused for
-- either of the others, in every order, and for a second of its own kind. 211 Ishaan withdraws; 212 Vihaan buys in and
-- deposits; 103 seats him, 139 is the cashier and 137 sends withdrawals.
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
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
grant execute on function pg_temp.id(text) to authenticated;
insert into ids select 'axis', id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000212';
-- Ishaan (211) gets a verified payout account and wallet cash to withdraw.
insert into public.payout_account (venue_id, member_id, kind, bank_name, vpa, status, decided_at, decided_by_staff_id)
select s.venue_id, '00000000-0000-4000-8000-000000000211', 'upi', 'HDFC Bank', 'ishaan@hdfcbank', 'verified', now(), s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'aud-utr-deposit',
  jsonb_build_array(jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.bank' and member_id is null), 'amount', '5000000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000211' and code = 'member.cash'), 'amount', '-5000000')), null) is not null as posted;
-- Vihaan (212) sits at Table 3 so he can buy in by UPI.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 2, '9000000212') is not null as seated;

-- 1. buy-in first, then deposit
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select lives_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'upi', gen_random_uuid(), '900000000001') $$, 'a buy-in by UPI gives a bank reference');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.request_deposit(1000000, '900000000001', pg_temp.id('axis'), gen_random_uuid()) $$, 'RVUTR', null, 'that reference pays no deposit');
-- 2. buy-in first, then withdrawal payout
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select lives_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'upi', gen_random_uuid(), '900000000002') $$, 'another buy-in gives another');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'w1', public.request_withdrawal(500000, (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000211' and removed_at is null), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select throws_ok($$ select public.send_withdrawal(pg_temp.id('w1'), '900000000002') $$, 'RVUTR', null, 'nor is it a withdrawal''s');
-- 3. deposit first, then buy-in
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.request_deposit(1000000, '900000000003', pg_temp.id('axis'), gen_random_uuid()) $$, 'a deposit gives a reference');
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'upi', gen_random_uuid(), '900000000003') $$, 'RVUTR', null, 'that reference buys no chips');
-- 4. deposit first, then withdrawal payout
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.request_deposit(1000000, '900000000004', pg_temp.id('axis'), gen_random_uuid()) $$, 'another deposit gives another');
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select throws_ok($$ select public.send_withdrawal(pg_temp.id('w1'), '900000000004') $$, 'RVUTR', null, 'nor is it a withdrawal''s');
-- 5. withdrawal payout first, then buy-in
select lives_ok($$ select public.send_withdrawal(pg_temp.id('w1'), '900000000005') $$, 'a withdrawal is sent with a reference');
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'upi', gen_random_uuid(), '900000000005') $$, 'RVUTR', null, 'that reference buys no chips');
-- 6. withdrawal payout first, then deposit
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'w2', public.request_withdrawal(500000, (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000211' and removed_at is null), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000137');
select lives_ok($$ select public.send_withdrawal(pg_temp.id('w2'), '900000000006') $$, 'another withdrawal is sent with another');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.request_deposit(1000000, '900000000006', pg_temp.id('axis'), gen_random_uuid()) $$, 'RVUTR', null, 'that reference pays no deposit');
-- same kind twice
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'upi', gen_random_uuid(), '900000000001') $$, null, null, 'a buy-in''s reference buys no second lot of chips');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.request_deposit(1000000, '900000000003', pg_temp.id('axis'), gen_random_uuid()) $$, 'RVUTR', null, 'a deposit''s reference pays no second deposit');
reset role;
-- ledger still balanced at the venue after all this
select is((select count(*)::int from (select transaction_id from public.ledger_entry group by transaction_id having sum(amount) <> 0) x), 0, 'every ledger transaction sums to zero');
select * from finish();
rollback;
