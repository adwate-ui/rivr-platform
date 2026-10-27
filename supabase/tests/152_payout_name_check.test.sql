-- The bank's name for a UPI payout address (#503; question #496 item 2; decision 0241). Ishaan (211) adds a UPI address
-- and a bank account. The payout-name-check function (the service role) claims the UPI address alone, once, and
-- records the bank's name for it; the cage (Sana, 104) sees it beside Ishaan's name. A second address the bank does
-- not know shows so. Neither a member nor staff may claim or record a check.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'upi', public.add_payout_account('upi', 'HDFC Bank', 'ishaan.verma@hdfcbank');
insert into ids select 'unknown', public.add_payout_account('upi', 'SBI', 'nobody.here@sbi');
insert into ids select 'bank', public.add_payout_account('bank', 'ICICI Bank', null, '001234567890', 'icic0000123', 'Ishaan Verma');
select throws_ok($$ select * from public.claim_payout_name_checks() $$, '42501', null, 'a member claims no check');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.record_payout_name_check((select id from ids where name = 'upi'), 'found', 'Someone Else') $$, '42501', null,
  'nor does the cage record one');

-- The function, as the service role.
reset role;
select set_config('role', 'service_role', true);
create temp table claimed as select * from public.claim_payout_name_checks();
select set_eq($$ select account_id from claimed $$, $$ select id from ids where name in ('upi', 'unknown') $$,
  'the UPI addresses are claimed, not the bank account');
select results_eq($$ select full_name, is_practice from claimed where account_id = (select id from ids where name = 'upi') $$,
  $$ values ('Ishaan Verma'::text, false) $$, 'with the member''s name, and whether the venue is the practice one');
select is_empty($$ select * from public.claim_payout_name_checks() $$, 'a claimed address is not claimed again within two minutes');
select lives_ok($$ select public.record_payout_name_check((select id from ids where name = 'upi'), 'found', ' ISHAAN VERMA ') $$,
  'the bank''s name is recorded');
select lives_ok($$ select public.record_payout_name_check((select id from ids where name = 'unknown'), 'not_found') $$,
  'and an address the bank does not know');
select throws_ok($$ select public.record_payout_name_check((select id from ids where name = 'upi'), 'found', null) $$, '22023', null,
  'found comes with a name');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select full_name, name_check, bank_holder_name from public.payout_accounts_to_verify('00000000-0000-4000-8000-000000000001')
                     where account_id = (select id from ids where name = 'upi') $$,
  $$ values ('Ishaan Verma'::text, 'found'::text, 'ISHAAN VERMA'::text) $$, 'the cage sees the bank''s name beside Ishaan''s');
select results_eq($$ select name_check, bank_holder_name from public.payout_accounts_to_verify('00000000-0000-4000-8000-000000000001')
                     where account_id = (select id from ids where name = 'unknown') $$,
  $$ values ('not_found'::text, null::text) $$, 'and that the bank knows no such address');
select results_eq($$ select name_check from public.payout_accounts_to_verify('00000000-0000-4000-8000-000000000001')
                     where account_id = (select id from ids where name = 'bank') $$,
  $$ values (null::text) $$, 'a bank account is not asked');

-- Asked five times without an answer, an address is left for the cage as it is.
reset role;
update public.payout_account set name_check_attempts = 5, name_check_claimed_at = null, name_checked_at = null, name_check = null, bank_holder_name = null
where id = (select id from ids where name = 'upi');
select set_config('role', 'service_role', true);
select is_empty($$ select * from public.claim_payout_name_checks() $$, 'five tries, then no more');

select * from finish();
rollback;
