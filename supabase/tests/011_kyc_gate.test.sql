-- The selfie, the 18+ gate and duplicate identities (#5). 201 Arjun, 202 Kabir, 203 Naina and
-- 204 Rohan (members of the club), 301 Asha and 302 Rajat (practice venue).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The member consents and the gate passes, as the kyc Edge Function does before the selfie.
create function pg_temp.begin_check(p_member uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_member, 'role', 'authenticated')::text, true);
  perform public.give_consent('kyc_verification');
  perform set_config('role', 'postgres', true);
  perform public.begin_kyc_vendor_call(p_member, true);
end;
$$;

-- DigiLocker for a member whose selfie is in: their own name, and a photo that matches the selfie.
create function pg_temp.digilocker(p_member uuid, p_birth date, p_pan text, p_aadhaar text) returns text language sql as $$
  select public.record_kyc_started(p_member, 'session');
  select public.record_kyc_digilocker(p_member, p_birth, 'XXXX XXXX 1234', p_aadhaar, p_pan, 'Gurugram', 'vendor', true, true, 97);
$$;

-- The selfie comes first and is the KYC photo.
select pg_temp.begin_check('00000000-0000-4000-8000-000000000202');
select public.record_kyc_started('00000000-0000-4000-8000-000000000202', 'early');
select is((select digilocker_session_id from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000202'), null,
  'no DigiLocker before the selfie');
select pg_temp.begin_check('00000000-0000-4000-8000-000000000201');
select is(public.record_kyc_selfie('00000000-0000-4000-8000-000000000201', 96, null), 'started', 'a live selfie is taken');
select is((select photo_path from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000201'),
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg',
  'and kept in the private bucket under the venue and the member');

-- An adult whose selfie matches DigiLocker's photo is verified and may take a seat.
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000201', '1990-04-12', 'ABCPM1234F', 'aadhaar-arjun'), 'verified',
  'a live selfie matching DigiLocker''s photo verifies an adult');
select ok(private.is_kyc_complete('00000000-0000-4000-8000-000000000201'), 'and the member may take a seat');
select is((select count(*)::int from public.outbox_event
           where event_type = 'kyc.completed' and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000201'),
  1, 'kyc.completed is emitted once');
select is(public.record_kyc_selfie('00000000-0000-4000-8000-000000000201', 90, null), null, 'a verified member''s photo is never replaced');

-- The gate re-reads the age itself: 18 today passes, a day short does not.
update public.kyc_record set date_of_birth = (now() at time zone 'Asia/Kolkata')::date - interval '18 years'
where member_id = '00000000-0000-4000-8000-000000000201';
select ok(private.is_kyc_complete('00000000-0000-4000-8000-000000000201'), 'a member who turns 18 today may play');
update public.kyc_record set date_of_birth = (now() at time zone 'Asia/Kolkata')::date - interval '18 years' + interval '1 day'
where member_id = '00000000-0000-4000-8000-000000000201';
select ok(not private.is_kyc_complete('00000000-0000-4000-8000-000000000201'), 'a member a day short of 18 may not');
update public.kyc_record set date_of_birth = '1990-04-12' where member_id = '00000000-0000-4000-8000-000000000201';

-- Under 18 on DigiLocker: refused.
select pg_temp.begin_check('00000000-0000-4000-8000-000000000204');
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000204', 95, null);
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000204',
  ((now() at time zone 'Asia/Kolkata')::date - interval '18 years' + interval '1 day')::date, 'DEFPR4567J', 'aadhaar-rohan'),
  'refused', 'a member a day short of 18 is refused');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000204'), 'under_18', 'as under 18');
select ok(not private.is_kyc_complete('00000000-0000-4000-8000-000000000204'), 'and never reaches a seat');

-- Duplicates: a PAN, an Aadhaar or a face another member already holds.
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000202', 95, null);
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000202', '1992-02-02', 'ABCPM1234F', 'aadhaar-kabir'), 'refused',
  'a PAN another member holds is refused');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000202'), 'duplicate_pan',
  'as a duplicate PAN');
select ok(not private.is_kyc_complete('00000000-0000-4000-8000-000000000202'), 'and never reaches a seat');
select pg_temp.begin_check('00000000-0000-4000-8000-000000000203');
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000203', 95, null);
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000203', '1993-03-03', 'CDEPK3456H', 'aadhaar-arjun'), 'refused',
  'an Aadhaar another member holds is refused');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000203'), 'duplicate_aadhaar',
  'as a duplicate Aadhaar');
select pg_temp.begin_check('00000000-0000-4000-8000-000000000302');
select is(public.record_kyc_selfie('00000000-0000-4000-8000-000000000302', 95, '00000000-0000-4000-8000-000000000301'), 'refused',
  'a face the vendor already holds for another member is refused at the selfie');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000302'), 'duplicate_face',
  'as a duplicate face');
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000302', '1990-01-01', 'FGHPT5678K', 'aadhaar-rajat'), null,
  'and a refused check never restarts');
select throws_ok(
  $$ update public.kyc_record set status = 'verified', refusal = null, verified_at = now()
     where member_id = '00000000-0000-4000-8000-000000000202' $$,
  '23505', null, 'however checks race, a venue never has two verified members with one PAN'
);

-- A DigiLocker photo that is not the selfie's face: someone else's documents, so staff review.
select pg_temp.begin_check('00000000-0000-4000-8000-000000000301');
select public.record_kyc_selfie('00000000-0000-4000-8000-000000000301', 95, null);
select public.record_kyc_started('00000000-0000-4000-8000-000000000301', 'session');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-000000000301', '1990-01-01', 'XXXX XXXX 9999', 'aadhaar-other',
  'GHIPA6789L', 'Elsewhere', 'vendor', true, false, 31), 'needs_review', 'a DigiLocker photo that does not match the selfie waits for staff');
select is((select row(pan, aadhaar_reference, date_of_birth)::text from public.kyc_record
           where member_id = '00000000-0000-4000-8000-000000000301'), '(,,)', 'keeping none of that identity');
select ok(exists (select 1 from public.audit_log where entity = 'kyc_record' and after ->> 'refusal' = 'duplicate_face'),
  'the audit log records why a check was refused');

-- Only the kyc Edge Function records a selfie; only lanes' own functions ask the gate.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select throws_ok($$ select public.record_kyc_selfie('00000000-0000-4000-8000-000000000203', 99, null) $$, '42501', null,
  'a member cannot record their own selfie');
select throws_ok($$ select private.is_kyc_complete('00000000-0000-4000-8000-000000000203') $$, '42501', null,
  'nor ask the gate directly');
reset role;

select * from finish();
rollback;
