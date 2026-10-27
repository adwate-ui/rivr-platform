-- The bank's name for a UPI payout address (#503; question #496 item 2; decision 0241). Ishaan (211, KYC verified)
-- adds UPI addresses (three at most at a time) and a bank account. The payout-name-check function (the service role)
-- claims the UPI addresses alone, once, and records what the bank says of each; the cage (Sana, 104) sees it beside
-- Ishaan's name. Ishaan never reads the bank's name. A real venue is asked only once the function can reach the
-- provider; a frozen venue, an unverified member and an address tried five times are not asked. Neither a member nor
-- staff may claim or record.
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
insert into ids select 'quiet', public.add_payout_account('upi', 'Axis Bank', 'ishaan.quiet@okaxis');
select throws_ok($$ select * from public.claim_payout_name_checks(true) $$, '42501', null, 'a member claims no check');
select throws_ok($$ select bank_holder_name from public.payout_account $$, '42501', null, 'nor reads the bank''s name');
select results_eq($$ select vpa from public.payout_account where id = (select id from ids where name = 'upi') $$,
  $$ values ('ishaan.verma@hdfcbank'::text) $$, 'though their own accounts read as before');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.record_payout_name_check((select id from ids where name = 'upi'), 'found', 'Someone Else') $$, '42501', null,
  'nor does the cage record one');

-- The function, as the service role.
reset role;
select set_config('role', 'service_role', true);
select is_empty($$ select * from public.claim_payout_name_checks(false) $$, 'a real venue is not asked while the provider is out of reach');
reset role;
select is((select count(*) from private.payout_name_check_claim where account_id in (select id from ids))::int, 0, 'and spends no tries');
select set_config('role', 'service_role', true);
create temp table claimed as select * from public.claim_payout_name_checks(true);
select set_eq($$ select account_id from claimed $$, $$ select id from ids $$, 'the UPI addresses are claimed');
select results_eq($$ select full_name, is_practice from claimed where account_id = (select id from ids where name = 'upi') $$,
  $$ values ('Ishaan Verma'::text, false) $$, 'with the member''s name, and whether the venue is the practice one');
select is_empty($$ select * from public.claim_payout_name_checks(true) $$, 'a claimed address is not claimed again within two minutes');
select lives_ok($$ select public.record_payout_name_check((select id from ids where name = 'upi'), 'found', ' ISHAAN VERMA ') $$,
  'the bank''s name is recorded');
select lives_ok($$ select public.record_payout_name_check((select id from ids where name = 'unknown'), 'not_found') $$,
  'an address the bank does not know');
select lives_ok($$ select public.record_payout_name_check((select id from ids where name = 'quiet'), 'no_name') $$,
  'and one it knows but names no one for');
select throws_ok($$ select public.record_payout_name_check((select id from ids where name = 'quiet'), 'found', ' ') $$, '22023', null,
  'found comes with a name');
select throws_ok($$ select public.record_payout_name_check((select id from ids where name = 'quiet'), 'no_name', 'Someone') $$, '22023', null,
  'and no_name without one');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select set_eq($$ select i.name, v.name_check, v.bank_holder_name
                 from public.payout_accounts_to_verify('00000000-0000-4000-8000-000000000001') v join ids i on i.id = v.account_id $$,
  $$ values ('upi'::text, 'found'::text, 'ISHAAN VERMA'::text), ('unknown', 'not_found', null), ('quiet', 'no_name', null) $$,
  'the cage sees what the bank said of each');
reset role;

-- Two removed make room for a fourth address and a bank account; the bank account is never asked.
update public.payout_account set removed_at = now() where id in (select id from ids where name in ('unknown', 'quiet'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'retry', public.add_payout_account('upi', 'Kotak', 'ishaan.retry@kotak');
insert into ids select 'bank', public.add_payout_account('bank', 'ICICI Bank', null, '001234567890', 'icic0000123', 'Ishaan Verma');
reset role;
select set_config('role', 'service_role', true);
select results_eq($$ select account_id from public.claim_payout_name_checks(true) $$, $$ select id from ids where name = 'retry' $$,
  'the new UPI address is claimed, not the bank account');
reset role;

-- An unanswered claim older than two minutes is claimed again, up to five tries.
update private.payout_name_check_claim set claimed_at = now() - interval '3 minutes' where account_id = (select id from ids where name = 'retry');
select set_config('role', 'service_role', true);
select results_eq($$ select account_id from public.claim_payout_name_checks(true) $$, $$ select id from ids where name = 'retry' $$,
  'an address with no answer is asked again');
reset role;
update private.payout_name_check_claim set attempts = 5, claimed_at = now() - interval '1 hour' where account_id = (select id from ids where name = 'retry');
select set_config('role', 'service_role', true);
select is_empty($$ select * from public.claim_payout_name_checks(true) $$, 'five tries, then no more');
reset role;

-- Not while the venue is frozen, nor for a member whose KYC is not verified; asked again once both are put right.
update private.payout_name_check_claim set attempts = 1 where account_id = (select id from ids where name = 'retry');
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select set_config('role', 'service_role', true);
select is_empty($$ select * from public.claim_payout_name_checks(true) $$, 'a frozen venue is not asked');
reset role;
update public.control_state set released_at = now(), release_reason = 'Test over',
  released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001'),
  release_second_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000102' and venue_id = '00000000-0000-4000-8000-000000000001')
where venue_id = '00000000-0000-4000-8000-000000000001' and level = 'venue_freeze' and released_at is null;
update public.kyc_record set status = 'needs_review', verified_at = null where member_id = '00000000-0000-4000-8000-000000000211';
select set_config('role', 'service_role', true);
select is_empty($$ select * from public.claim_payout_name_checks(true) $$, 'nor a member whose KYC is not verified');
reset role;
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000211';
select set_config('role', 'service_role', true);
select results_eq($$ select account_id from public.claim_payout_name_checks(true) $$, $$ select id from ids where name = 'retry' $$,
  'and asked once the venue is open and the member verified');
reset role;

select * from finish();
rollback;
