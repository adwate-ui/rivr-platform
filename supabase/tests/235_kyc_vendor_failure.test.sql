-- Why a KYC vendor call failed is kept with the member's check, for the server only (#704).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table checked as select k.member_id from public.kyc_record k order by k.member_id limit 1;
select is((select count(*)::int from checked), 1, 'a member with a check to note against');
grant select on checked to service_role, authenticated;

set local role service_role;
select lives_ok($$ select public.note_kyc_vendor_failure((select member_id from checked), 'start', 'Cashfree redirect_url_value_invalid') $$,
  'the kyc function notes a failed call as the server');
reset role;
select is((select k.vendor_failure from public.kyc_record k join checked c using (member_id)), 'start: Cashfree redirect_url_value_invalid',
  'the step and Cashfree''s code are kept');
select ok((select k.vendor_failed_at is not null from public.kyc_record k join checked c using (member_id)), 'with when it failed');

set local role service_role;
select public.note_kyc_vendor_failure((select member_id from checked), 'complete', repeat('x', 300));
select public.note_kyc_vendor_failure((select member_id from checked), '', 'unavailable');
select public.note_kyc_vendor_failure((select member_id from checked), 'anything', 'unavailable');
reset role;
select is((select length(k.vendor_failure) from public.kyc_record k join checked c using (member_id)), 200,
  'a long reason is cut to 200 characters, and a step that is not a KYC step notes nothing over it');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select throws_ok($$ select public.note_kyc_vendor_failure((select member_id from checked), 'start', 'unavailable') $$, '42501', null,
  'a member cannot note a failure');
select throws_ok($$ select vendor_failure from public.kyc_record limit 1 $$, '42501', null,
  'nor read why a vendor call failed: it stays with the server');
reset role;

select ok(not has_function_privilege('authenticated', 'public.note_kyc_vendor_failure(uuid, text, text)', 'execute')
          and not has_function_privilege('anon', 'public.note_kyc_vendor_failure(uuid, text, text)', 'execute'),
  'only the server notes a failure');
select ok(not exists (select 1 from public.audit_log a where a.entity = 'kyc_record' and (a.after ? 'vendor_failure' or a.before ? 'vendor_failure')),
  'and the audit log never copies why');

select * from finish();
rollback;
