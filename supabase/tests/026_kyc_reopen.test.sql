-- A super admin reopens a refused check done in person (#267). 101 Vikram (super admin), 103 Aditya
-- (admin: KYC review, not a super admin); 203 Naina refused by hand, 204 Rohan refused by a vendor.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.kyc_record (venue_id, member_id, status, method, refusal, date_of_birth, masked_aadhaar, pan, photo_path) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'refused', 'manual', 'duplicate_aadhaar',
   '1990-04-12', 'XXXX XXXX 1234', 'ABCPN1234D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/in-person-00000000-0000-4000-8000-0000000000a1.jpg'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'refused', 'digilocker', 'duplicate_face',
   '1991-01-01', 'XXXX XXXX 5678', 'ABCPR5678R',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000204/selfie.jpg');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000203', 'Wrong date of birth typed') $$,
  '42501', null, 'a KYC reviewer who is not a super admin cannot reopen a check');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000203', 'no') $$,
  '22023', null, 'a super admin gives a reason');
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000203', 'Her PAN is ABCPN1234D, not a duplicate') $$,
  '22023', null, 'with no document number in it');
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000204', 'Not the same face') $$,
  'RVKYC', null, 'only a check done in person is reopened: a vendor''s refusal stands');
select lives_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000203', 'The date of birth was typed wrong at the desk') $$,
  'a super admin reopens a refused check done in person');
select results_eq($$ select full_name from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'naina') $$,
  $$ values ('Naina Kapoor'::text) $$, 'and the member can be checked in person again');
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000203', 'Again') $$,
  'RVKYC', null, 'a check is reopened only while refused');
reset role;

select results_eq($$ select status, refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('started'::text, null::text) $$, 'the check is started again, with no refusal');
select results_eq(
  $$ select a.reason, a.actor_user_id::text from public.audit_log a
     where a.entity = 'kyc_record' and a.before ->> 'status' = 'refused' and a.after ->> 'status' = 'started' $$,
  $$ values ('The date of birth was typed wrong at the desk'::text, '00000000-0000-4000-8000-000000000101'::text) $$,
  'the audit log keeps the reopening, its reason and who did it');

-- Never one's own record.
select set_config('request.jwt.claims', '', true);
insert into public.member (id, venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000002f9', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101',
        'Vikram Rao', '+919000000101');
insert into public.kyc_record (venue_id, member_id, status, method, refusal, date_of_birth, photo_path) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002f9', 'refused', 'manual', 'under_18', '2012-01-01',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002f9/in-person-00000000-0000-4000-8000-0000000000a2.jpg');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-0000000002f9', 'My own check') $$,
  '42501', null, 'a super admin never reopens their own check');
reset role;

select * from finish();
rollback;
