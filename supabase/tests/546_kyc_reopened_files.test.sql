-- A reopened desk check's files go at once (#931): reopening a verified check done in person lists its face photo and two
-- document photos to go; a super admin of the member's venue reads them and forgets them once Storage removed them; nobody
-- else does. 101 Vikram (super admin), 103 Aditya (admin, no super admin). Asha was verified at the desk.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000002e1', '00000000-0000-4000-8000-000000000001', 'Asha Reopened', '+919000077281');
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, masked_aadhaar, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002e1', 'verified', 'manual', '1988-02-03', 'XXXX XXXX 4321', 'ABCPK4321D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e1/in-person-00000000-0000-4000-8000-0000000000b1.jpg', now());
insert into public.kyc_document (venue_id, member_id, kind, path, taken_by_staff_id, covers_confirmed_by_staff_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002e1', d.kind,
       '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e1/doc-' || d.file || '-00000000-0000-4000-8000-0000000000b1.jpg',
       s.id, case when d.kind = 'aadhaar_front' then s.id end
from (values ('pan', 'pan'), ('aadhaar_front', 'aadhaar')) as d (kind, file),
     public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select lives_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-0000000002e1', 'Saved on the wrong member at the desk') $$,
  'the super admin reopens the verified desk check');
select is(public.reopened_kyc_files('00000000-0000-4000-8000-0000000002e1'), array[
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e1/doc-aadhaar-00000000-0000-4000-8000-0000000000b1.jpg',
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e1/doc-pan-00000000-0000-4000-8000-0000000000b1.jpg',
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e1/in-person-00000000-0000-4000-8000-0000000000b1.jpg'],
  'its photo and two document photos are listed to go');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select public.reopened_kyc_files('00000000-0000-4000-8000-0000000002e1') $$, '42501', null, 'an admin who is no super admin reads none');
select throws_ok($$ select public.forget_reopened_kyc_files('00000000-0000-4000-8000-0000000002e1', array['x']) $$, '42501', null, 'nor forgets any');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000002e1", "role": "authenticated"}';
select throws_ok($$ select public.reopened_kyc_files('00000000-0000-4000-8000-0000000002e1') $$, '42501', null, 'nor does the member');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select is(public.forget_reopened_kyc_files('00000000-0000-4000-8000-0000000002e1',
  array['00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002e1/doc-pan-00000000-0000-4000-8000-0000000000b1.jpg']), 1,
  'once Storage removed one, it is forgotten');
select is(cardinality(public.reopened_kyc_files('00000000-0000-4000-8000-0000000002e1')), 2, 'and the rest stay listed until removed');
reset role;
select is((select count(*)::integer from public.kyc_document where member_id = '00000000-0000-4000-8000-0000000002e1'), 0, 'the documents'' records went with the reopening, as before');
select ok(not has_function_privilege('anon', 'public.reopened_kyc_files(uuid)', 'execute'), 'nobody signed out asks');

select * from finish();
rollback;
