-- KYC in person at the club (#246): a KYC reviewer checks a member's originals while no vendor is
-- live. 101 Vikram (super admin: KYC review), 104 Sana (cashier: no KYC review), 203 Naina, 204
-- Rohan and 202 Kabir (members with no check), 201 Arjun (member). Photos are stood in for by storage rows.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The photo the Edge Function stores before the check: <venue>/<member>/selfie.jpg.
insert into storage.objects (bucket_id, name) values
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg'),
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000204/selfie.jpg');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select results_eq($$ select full_name, phone_last4, status from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'naina') $$,
  $$ values ('Naina Kapoor'::text, '0203'::text, null::text) $$, 'a KYC reviewer finds a member with no check by name, with only the last four digits');
select results_eq($$ select full_name from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', '0204') $$,
  $$ values ('Rohan Bhatia'::text) $$, 'or by the last digits of their number');
select is_empty($$ select * from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', '%') $$,
  'a search is text, never a pattern');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select is_empty($$ select * from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'naina') $$,
  'staff without KYC review find nobody');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select results_eq($$ select photo_path, has_photo from public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000203') $$,
  $$ values ('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg'::text, false) $$,
  'a KYC reviewer may check a member with no check in person, and is told where the photo goes');
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203', '1990-04-12', '1234', 'ABCPN1234D', false) $$,
  '22023', null, 'never without the member''s consent');
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203', '1990-04-12', '12345', 'ABCPN1234D', true) $$,
  '22023', null, 'and only the last four Aadhaar digits');
select is(public.check_kyc_in_person('00000000-0000-4000-8000-000000000203', '1990-04-12', '1234', 'abcpn1234d', true), 'verified',
  'a member checked in person, 18 or over and with a PAN no verified member holds, is verified');
reset role;
select results_eq(
  $$ select method, masked_aadhaar, pan, date_of_birth, photo_path from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('manual'::text, 'XXXX XXXX 1234'::text, 'ABCPN1234D'::text, '1990-04-12'::date,
             '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg'::text) $$,
  'with the photo, the masked Aadhaar and the PAN kept, and never the full Aadhaar number');
select ok(private.is_kyc_complete('00000000-0000-4000-8000-000000000203'), 'and may now take a seat');
select results_eq(
  $$ select c.purpose, s.full_name from public.consent c join public.staff s on s.id = c.recorded_by_staff_id
     where c.member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('kyc_verification'::text, 'Vikram Rao'::text) $$, 'their consent is recorded, with who took it');
select results_eq(
  $$ select r.decision, r.method, r.outcome, s.full_name from public.kyc_review r join public.staff s on s.id = r.reviewed_by_staff_id
     where r.member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('approved'::text, 'manual'::text, 'verified'::text, 'Vikram Rao'::text) $$, 'and the check is kept as manual, with the reviewer''s name');
select results_eq(
  $$ select a.after ->> 'decision', a.after ->> 'method' from public.audit_log a
     where a.entity = 'kyc_review' and a.after ->> 'member_id' = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('approved', 'manual') $$, 'the audit log keeps the decision, made in person');
select is((select count(*)::integer from public.audit_log a
           where concat(a.before::text, a.after::text, a.reason) ~ '(ABCPN1234D|XXXX XXXX 1234)'), 0,
  'and never a document number');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select throws_ok($$ select * from public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000203') $$,
  'RVKYC', null, 'a check already decided is not checked again');
select is_empty($$ select * from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'naina') $$,
  'nor offered to check');
-- The gate still decides: a PAN a verified member holds is refused.
select is(public.check_kyc_in_person('00000000-0000-4000-8000-000000000204', '1991-01-01', '5678', 'ABCPN1234D', true), 'refused',
  'a PAN a verified member already holds is refused');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select throws_ok($$ select * from public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000201') $$,
  '42501', null, 'staff without KYC review cannot check anyone');
reset role;
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000204'), 'duplicate_pan',
  'refused for the duplicate PAN');

-- No photo stored: refused before anything is kept.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000201', '1985-06-01', '4321', 'ABCPA4321Q', true) $$,
  'RVPHT', null, 'nor without the member''s photo');
reset role;

-- Under 18 is refused, whatever the reviewer saw.
insert into storage.objects (bucket_id, name)
values ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select is(public.check_kyc_in_person('00000000-0000-4000-8000-000000000201', (current_date - interval '17 years')::date, '4321', 'ABCPA4321Q', true),
  'refused', 'someone under 18 is refused');
reset role;

-- With no Aadhaar reference, the last four digits and date of birth of a verified member are taken as their Aadhaar.
insert into storage.objects (bucket_id, name)
values ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/selfie.jpg');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select is(public.check_kyc_in_person('00000000-0000-4000-8000-000000000202', '1990-04-12', '1234', 'ABCPK1234K', true), 'refused',
  'the last four Aadhaar digits and date of birth of a verified member are refused, whatever the PAN');
reset role;
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000202'), 'duplicate_aadhaar',
  'as a duplicate Aadhaar');

-- Never one's own check: Vikram is staff and, here, also a member.
insert into public.member (venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Vikram Rao', '+919000000101');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.authorize_in_person_kyc((select id from public.member where user_id = '00000000-0000-4000-8000-000000000101')) $$,
  '42501', null, 'a reviewer never checks their own record');
reset role;

-- The KYC sign-up kill switch stops checks in person. Last: the switch is not released in this test.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Vendor outage', s.id from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select throws_ok($$ select * from public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000202') $$,
  'RVKIL', null, 'the KYC sign-up kill switch stops them');
reset role;

select * from finish();
rollback;
