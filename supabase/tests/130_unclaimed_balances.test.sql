-- Unclaimed balances (#110; decision 0230). New members of the club: Quiet Cash, whose cash has lain 400 days;
-- Quiet Bonus, who joined 500 days ago and holds only bonus, some of it expiring 5 days ago (the club's doing);
-- Seen Lately, quiet 400 days but at the door 10 days ago; Active Cash, who moved cash 10 days ago; and Repaid
-- Lately, whose cash has lain 400 days but who repaid a marker 5 days ago. 198 Arjun is the owner (reports.read);
-- 104 a cashier, who reads no reports; 103 Aditya an admin at the club and the practice venue; 191 Nisha an admin
-- at the club only.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone, tier_id)
select m.id, '00000000-0000-4000-8000-000000000001', m.name, m.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from (values ('00000000-0000-4000-8000-0000000004d1'::uuid, 'Quiet Cash', '+919000099801'),
             ('00000000-0000-4000-8000-0000000004d2'::uuid, 'Seen Lately', '+919000099802'),
             ('00000000-0000-4000-8000-0000000004d3'::uuid, 'Active Cash', '+919000099803'),
             ('00000000-0000-4000-8000-0000000004d4'::uuid, 'Quiet Bonus', '+919000099804'),
             ('00000000-0000-4000-8000-0000000004d5'::uuid, 'Repaid Lately', '+919000099805')) as m (id, name, phone);
update public.member set created_at = now() - interval '500 days' where id = '00000000-0000-4000-8000-0000000004d4';

-- A credit to a member's cash or bonus from the cash drawer, dated `p_days` ago.
create function pg_temp.credit(p_member uuid, p_code text, p_paise bigint, p_days integer) returns void language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at, memo)
  values ('00000000-0000-4000-8000-000000000001', 'opening_balance', 'unclaimed-test:' || p_member || p_code || p_days, now() - make_interval(days => p_days), 'test')
  returning id into v_id;
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select '00000000-0000-4000-8000-000000000001', v_id, a.id, case when a.member_id is null then p_paise else -p_paise end
  from public.ledger_account a
  where a.venue_id = '00000000-0000-4000-8000-000000000001'
    and ((a.member_id = p_member and a.code = p_code) or (a.member_id is null and a.code = 'venue.cash_drawer'));
end;
$$;
select pg_temp.credit('00000000-0000-4000-8000-0000000004d1', 'member.cash', 250000, 400);
select pg_temp.credit('00000000-0000-4000-8000-0000000004d2', 'member.bonus', 50000, 400);
select pg_temp.credit('00000000-0000-4000-8000-0000000004d3', 'member.cash', 90000, 10);
select pg_temp.credit('00000000-0000-4000-8000-0000000004d4', 'member.bonus', 70000, 400);
select pg_temp.credit('00000000-0000-4000-8000-0000000004d4', 'member.bonus', -20000, 5);
select pg_temp.credit('00000000-0000-4000-8000-0000000004d5', 'member.cash', 30000, 400);
select pg_temp.credit('00000000-0000-4000-8000-0000000004d5', 'member.receivable', -10000, 5);
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000004d2', now() - interval '10 days', now() - interval '10 days', 'door');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000198", "role": "authenticated"}', true);
select results_eq(
  $$ select full_name, cash_paise, bonus_paise from public.unclaimed_balances('00000000-0000-4000-8000-000000000001')
     where full_name in ('Quiet Cash', 'Seen Lately', 'Active Cash', 'Quiet Bonus', 'Repaid Lately') $$,
  $$ values ('Quiet Bonus'::text, 0::bigint, 50000::bigint), ('Quiet Cash', 250000, 0) $$,
  'balances untouched by their members for a year are unclaimed, the quietest first, bonus ones too whatever the club did to them; one whose member visited, moved cash or repaid a marker lately is not');
reset role;

-- The venue sets a shorter period.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'reports.unclaimed_days', '', '{"days": 30}', now() - interval '1 minute', 'test');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000198", "role": "authenticated"}', true);
select ok((select count(*) from public.unclaimed_balances('00000000-0000-4000-8000-000000000001')
           where full_name in ('Quiet Cash', 'Seen Lately', 'Active Cash', 'Quiet Bonus', 'Repaid Lately')) = 2,
  'with 30 days the balances seen 10 days ago still count as claimed');
reset role;

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}', true);
select throws_ok($$ select * from public.unclaimed_balances('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'a cashier reads no reports');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}', true);
select throws_ok($$ select * from public.unclaimed_balances('00000000-0000-4000-8000-000000000002') $$, '22023', null,
  'the practice venue has no reports');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000191", "role": "authenticated"}', true);
select throws_ok($$ select * from public.unclaimed_balances('00000000-0000-4000-8000-000000000002') $$, '42501', null,
  'nor does an admin of the club see another venue''s');
reset role;

select * from finish();
rollback;
