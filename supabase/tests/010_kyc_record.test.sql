-- KYC records (#4): only the server writes them; members see their own, KYC reviewers their
-- venue's; the audit log keeps no identity details; every vendor call passes a gate (kill switch,
-- consent, five paid calls a day). 103 Aditya (admin, kyc.review), 108 Karan (host), 201 Arjun,
-- 202 Kabir, 203 Naina and 204 Rohan (members), 302 Rajat (practice venue).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A KYC reviewer who works at the practice venue only (seeded staff work at both).
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000ea', 'authenticated', 'authenticated',
        '919000000998', now(), now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000ea', 'Practice admin', 'Admin', 'admin', '+919000000998');

create function pg_temp.consent(p_member uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_member, 'role', 'authenticated')::text, true);
  perform public.give_consent('kyc_verification');
  perform set_config('role', 'postgres', true);
end;
$$;

-- The gate.
select throws_ok($$ select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000201', true) $$, 'RVCON', null,
  'no vendor call without the member''s KYC consent');
select pg_temp.consent('00000000-0000-4000-8000-000000000201');
select lives_ok($$ select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000201', true) $$, 'with consent the call may go');

-- DigiLocker with a PAN: verified.
select public.claim_kyc_selfie('00000000-0000-4000-8000-000000000201');
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000201', 95, null);
select lives_ok($$ select public.record_kyc_started('00000000-0000-4000-8000-000000000201', 'session-1') $$, 'a hand-off is recorded');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-000000000201', '1990-04-12', 'XXXX XXXX 4321', 'aadhaar-201',
  'ABCPM1234F', 'Sector 65, Gurugram', 'vendor-1', true, true, 97), 'verified', 'DigiLocker with a PAN verifies the member');
select lives_ok($$ select public.record_kyc_started('00000000-0000-4000-8000-000000000201', 'session-2') $$, 'a second hand-off is harmless');
select is((select status from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000201'), 'verified', 'a verified record stays verified');

-- DigiLocker without a PAN, then a PAN: verified, DigiLocker's date of birth kept.
select pg_temp.consent('00000000-0000-4000-8000-000000000202');
select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000202', true);
select public.claim_kyc_selfie('00000000-0000-4000-8000-000000000202');
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000202', 95, null);
select public.record_kyc_started('00000000-0000-4000-8000-000000000202', 'session-3');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-000000000202', '1992-02-02', 'XXXX XXXX 1111', 'aadhaar-202', null, 'DLF Phase 3', 'vendor-2', true, true, 96),
  'needs_pan', 'without a PAN the check waits for one');
select is(public.record_kyc_pan('00000000-0000-4000-8000-000000000202', 'BCDPS2345G', '2000-01-01', 'vendor-pan'), 'verified', 'a valid PAN completes it');
select is((select date_of_birth from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000202'), '1992-02-02'::date,
  'DigiLocker''s date of birth is kept');

-- Someone else's DigiLocker (the name does not match the member's): staff review.
select pg_temp.consent('00000000-0000-4000-8000-000000000204');
select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000204', true);
select public.claim_kyc_selfie('00000000-0000-4000-8000-000000000204');
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000204', 95, null);
select public.record_kyc_started('00000000-0000-4000-8000-000000000204', 'session-6');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-000000000204', '1980-03-03', 'XXXX XXXX 2222', 'aadhaar-x', 'DEFPR4567J', 'Elsewhere', 'vendor-3', false, true, 95),
  'needs_review', 'a DigiLocker record in another name waits for staff, never verifies');
select is((select row(pan, date_of_birth, masked_aadhaar, address)::text from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000204'),
  '(,,,)', 'and none of that other person''s identity is kept');
select pg_temp.consent('00000000-0000-4000-8000-000000000302');
select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000302', true);
select public.claim_kyc_selfie('00000000-0000-4000-8000-000000000302');
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000302', 95, null);
select public.record_kyc_started('00000000-0000-4000-8000-000000000302', 'session-7');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-000000000302', '1981-04-04', 'XXXX XXXX 3333', 'aadhaar-y', null, 'Elsewhere', 'vendor-4', false, true, 95),
  'needs_review', 'another name without a PAN waits for staff too, never for a PAN that would verify it');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-000000000302', '1981-04-04', 'XXXX XXXX 3333', 'aadhaar-y', 'DEFPR4567J', 'Elsewhere', 'vendor-4', null, true, 95),
  null, 'and a record already with staff is not pulled again');

-- DigiLocker fails: a PAN alone waits for staff.
select pg_temp.consent('00000000-0000-4000-8000-000000000203');
select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000203', true);
select public.claim_kyc_selfie('00000000-0000-4000-8000-000000000203');
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000203', 95, null);
select public.record_kyc_started('00000000-0000-4000-8000-000000000203', 'session-4');
select lives_ok($$ select public.record_kyc_digilocker_failed('00000000-0000-4000-8000-000000000203') $$, 'a DigiLocker failure is recorded');
select is(public.record_kyc_pan('00000000-0000-4000-8000-000000000203', 'CDEPK3456H', '1995-05-05', 'vendor-pan'),
  'needs_review', 'a PAN alone, with no DigiLocker photo, waits for staff review');

-- Five paid calls a day.
select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000203', true);
select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000203', true);
select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000203', true);
select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000203', true);
select throws_ok($$ select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000203', true) $$, 'RVRAT', null,
  'the sixth paid call in a day is refused');
select lives_ok($$ select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000203', false) $$, 'an unpaid call still goes');

-- The kill switch.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Vendor breach', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select throws_ok($$ select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000202', false) $$, 'RVKIL', null,
  'no vendor call while KYC sign-up is stopped');
select throws_ok($$ select public.record_kyc_started('00000000-0000-4000-8000-000000000202', 'session-5') $$, 'RVKIL', null,
  'and no record changes either');

select throws_ok(
  $$ update public.kyc_record set masked_aadhaar = '1234 5678 9012' where member_id = '00000000-0000-4000-8000-000000000201' $$,
  '23514', null, 'a full Aadhaar number can never be stored'
);
select is(
  (select count(*)::int from public.audit_log
   where entity = 'kyc_record' and (coalesce(after, '{}') ?| array['pan', 'date_of_birth', 'address', 'masked_aadhaar']
                                    or coalesce(before, '{}') ?| array['pan', 'date_of_birth', 'address', 'masked_aadhaar'])),
  0, 'the audit log keeps no identity details'
);
select ok((select count(*) from public.audit_log where entity = 'kyc_record') > 0, 'but it records how each check moved');

-- Who sees what, and who writes.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*)::int from public.kyc_record), 1, 'a member sees only their own record');
select results_eq($$ select member_id, full_name from public.kyc_subject() $$,
  $$ values ('00000000-0000-4000-8000-000000000201'::uuid, 'Arjun Mehta'::text) $$, 'kyc_subject names the signed-in member');
select throws_ok($$ select public.record_kyc_started('00000000-0000-4000-8000-000000000201', 'mine') $$, '42501', null,
  'a member cannot write their own record');
select throws_ok($$ select public.begin_kyc_vendor_call('00000000-0000-4000-8000-000000000201', true) $$, '42501', null,
  'nor pass the gate themselves');
select throws_ok($$ update public.kyc_record set status = 'verified' $$, '42501', null, 'nor change it directly');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select is((select count(*)::int from public.kyc_record), 12,
  'a KYC reviewer sees the records of the venues they work at (seeded staff: both; seven seeded records)');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000108", "role": "authenticated"}';
select is((select count(*)::int from public.kyc_record), 0, 'a host sees none');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000ea", "role": "authenticated"}';
select results_eq($$ select member_id from public.kyc_record $$, $$ values ('00000000-0000-4000-8000-000000000302'::uuid) $$,
  'a KYC reviewer of the practice venue sees only its records');
reset role;

select * from finish();
rollback;
