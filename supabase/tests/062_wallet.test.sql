-- Balance (#18). 201 Arjun (design prompt): cash ₹1,85,000, a ₹4,000 bonus, an open ₹50,000 marker
-- against a ₹2,00,000 limit, 18,420 points. 211 Ishaan buys in at Table 3 and is credited a bonus, so
-- his movements name the table and the bonus's reason. 101 the owner reads the ledger; 301 Asha is the
-- practice venue's member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions (57_promotions.sql) back to drafts: on a Tuesday its bonus would be on the statement too (#88).
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Arjun's wallet, as the design prompt has it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select member_id, cash_paise, points, credit_limit_paise from public.my_wallet() $$,
  $$ values ('00000000-0000-4000-8000-000000000201'::uuid, 18500000::bigint, 18420::bigint, 20000000::bigint) $$,
  'Arjun has ₹1,85,000 of cash, 18,420 points and a ₹2,00,000 limit');
select results_eq($$ select account, amount, kind from public.my_wallet_movement order by account $$,
  $$ values ('bonus'::text, 400000::bigint, 'opening_balance'::text), ('cash', 18500000, 'opening_balance'), ('receivable', 5000000, 'opening_balance') $$,
  'his movements: cash and bonus as more he holds, the marker as more he owes');
select is((select bonus_reason from public.my_wallet_movement where account = 'bonus'), 'Buy-in bonus Tuesday', 'the bonus line has its reason');
select is_empty($$ select * from public.my_wallet_movement where account not in ('cash', 'bonus', 'receivable') $$,
  'only his money: points history is Rewards'', behind its tier (decision 0062)');

-- A buy-in at Table 3 and a bonus: the movement names the table and the reason.
reset role;
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-wallet-deposit',
  jsonb_build_array(jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.bank'), 'amount', '2000000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000211' and code = 'member.cash'),
                                       'amount', '-2000000')), null);
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 100000, 'Referral', now() + interval '1 day', 'test:wallet:bonus');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet', gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select kind, account, amount, table_name, bonus_reason from public.my_wallet_movement order by kind $$,
  $$ values ('bonus'::text, 'bonus'::text, 100000::bigint, null::text, 'Referral'::text), ('buy_in', 'cash', -1000000, 'Table 3', null),
            ('deposit', 'cash', 2000000, null, null) $$,
  'Ishaan''s deposit, his bonus with its reason, and his buy-in at Table 3 as less cash');
select results_eq($$ select cash_paise, points, credit_limit_paise from public.my_wallet() $$,
  $$ values (1000000::bigint, 0::bigint, null::bigint) $$, 'he holds ₹10,000 of cash, no points and no credit line');
reset role;
insert into public.credit_line (venue_id, member_id, limit_paise, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 0, 'Waiting for a super admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select credit_limit_paise from public.my_wallet()), null, 'a credit line at nothing is no limit to show');

-- Each sees their own: not Arjun's, not as ledger staff, not across venues.
select is_empty($$ select * from public.my_wallet_movement where amount = 18500000 $$, 'Ishaan sees none of Arjun''s lines');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is_empty($$ select * from public.my_wallet() $$, 'the owner, who reads the whole ledger, has no wallet of his own');
select is_empty($$ select * from public.my_wallet_movement $$, 'and lists no member''s movements as his');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select results_eq($$ select cash_paise, credit_limit_paise from public.my_wallet() $$, $$ values (5000000::bigint, null::bigint) $$,
  'the practice venue''s member sees her own ₹50,000');
select is((select count(*)::integer from public.my_wallet_movement), 1, 'and her one line');
set local role anon;
select throws_ok($$ select * from public.my_wallet() $$, '42501', null, 'nobody signed out has a wallet');
select throws_ok($$ select * from public.my_wallet_movement $$, '42501', null, 'or movements');
reset role;

select * from finish();
rollback;
