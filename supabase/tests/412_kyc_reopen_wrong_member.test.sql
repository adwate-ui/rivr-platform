-- A desk check saved on the wrong member (decision 0583): staff are told who holds the documents a duplicate clashed with,
-- and a super admin reopens the verified check done in person, which clears what the desk entered. 101 Vikram (super
-- admin), 103 Aditya (admin), 108 Karan (host). Asha was verified on Dev's documents; Dev, checked next, was refused.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000002e1', '00000000-0000-4000-8000-000000000001', 'Asha Wrongly', '+919000077281'),
  ('00000000-0000-4000-8000-0000000002e2', '00000000-0000-4000-8000-000000000001', 'Dev Kapoor', '+919000077282'),
  ('00000000-0000-4000-8000-0000000002e3', '00000000-0000-4000-8000-000000000001', 'Vendor Verified', '+919000077283');
insert into public.kyc_record (venue_id, member_id, status, method, refusal, date_of_birth, masked_aadhaar, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002e1', 'verified', 'manual', null,
   '1988-02-03', 'XXXX XXXX 4321', 'ABCPK4321D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e1/in-person-00000000-0000-4000-8000-0000000000b1.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002e2', 'refused', 'manual', 'duplicate_pan',
   '1988-02-03', 'XXXX XXXX 4321', 'ABCPK4321D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e2/in-person-00000000-0000-4000-8000-0000000000b2.jpg', null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002e3', 'verified', 'digilocker', null,
   '1979-09-09', 'XXXX XXXX 9999', 'ABCPV9999V',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e3/selfie.jpg', now());
insert into public.kyc_document (venue_id, member_id, kind, path, taken_by_staff_id, covers_confirmed_by_staff_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002e1', d.kind,
       '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e1/doc-' || d.file || '-00000000-0000-4000-8000-0000000000b1.jpg',
       s.id, case when d.kind = 'aadhaar_front' then s.id end
from (values ('pan', 'pan'), ('aadhaar_front', 'aadhaar')) as d (kind, file),
     public.staff s where s.user_id = '00000000-0000-4000-8000-000000000108' and s.venue_id = '00000000-0000-4000-8000-000000000001';

-- The desk is told who holds the documents.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000108", "role": "authenticated"}';
select results_eq($$ select full_name from public.kyc_duplicate_holder('00000000-0000-4000-8000-0000000002e2') $$,
  $$ values ('Asha Wrongly'::text) $$, 'a host sees which member holds the documents the duplicate clashed with');
select is_empty($$ select 1 from public.kyc_duplicate_holder('00000000-0000-4000-8000-0000000002e1') $$, 'nothing for a check that is not a duplicate');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000dead", "role": "authenticated"}';
select is_empty($$ select 1 from public.kyc_duplicate_holder('00000000-0000-4000-8000-0000000002e2') $$, 'nobody else is told');

-- Only a super admin reopens the verified check, and only one done in person.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-0000000002e1', 'Saved on the wrong member') $$,
  '42501', null, 'an admin cannot reopen a verified check');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-0000000002e3', 'Saved on the wrong member') $$,
  'RVKYC', null, 'a check the vendor verified stays');
select lives_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-0000000002e1', 'Saved on the wrong member') $$,
  'a super admin reopens a verified check done in person');
select throws_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-0000000002e1') $$,
  '42501', null, 'and does not do the check that follows');
reset role;
select set_config('request.jwt.claims', '', true);

select results_eq($$ select status, verified_at, date_of_birth, masked_aadhaar, pan, photo_path from public.kyc_record
                     where member_id = '00000000-0000-4000-8000-0000000002e1' $$,
  $$ values ('started'::text, null::timestamptz, null::date, null::text, null::text, null::text) $$,
  'the member waits for the desk again, with nothing the desk entered');
select is((select count(*)::integer from public.kyc_document where member_id = '00000000-0000-4000-8000-0000000002e1'), 0, 'and no document on file');
select is((select reason from public.audit_log where entity = 'kyc_record' and after ->> 'member_id' = '00000000-0000-4000-8000-0000000002e1'
           and before ->> 'status' = 'verified' and after ->> 'status' = 'started'), 'Saved on the wrong member', 'the audit log keeps why');
select is(private.kyc_refusal('00000000-0000-4000-8000-0000000002e2'), null, 'the other member''s documents clash with no one now');

-- The server reads which document files are on file, to clear the rest, and nothing else of the table.
select is(has_column_privilege('service_role', 'public.kyc_document', 'path', 'select'), true, 'the server reads the paths');
select is(has_column_privilege('service_role', 'public.kyc_document', 'retake_reason', 'select'), false, 'and no other column');
select is(has_table_privilege('service_role', 'public.kyc_document', 'insert, update, delete'), false, 'and writes none');
select is(has_function_privilege('anon', 'public.kyc_duplicate_holder(uuid)', 'execute'), false, 'nobody signed out asks who holds a document');

select * from finish();
rollback;
