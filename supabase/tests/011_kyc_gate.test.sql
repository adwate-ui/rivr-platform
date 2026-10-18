-- The selfie, the 18+ gate and duplicate identities (#5). 201 Arjun, 202 Kabir, 203 Naina and
-- 204 Rohan (members of the club), 301 Asha (practice venue); 205 to 208 are added here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- More members of the club, on the same tier as Kabir.
insert into public.member (id, venue_id, full_name, phone, tier_id)
select ('00000000-0000-4000-8000-00000000020' || n)::uuid, m.venue_id, 'Member ' || n, '+91900000020' || n, m.tier_id
from public.member m, unnest(array[5, 6, 7, 8]) as n
where m.id = '00000000-0000-4000-8000-000000000202';

-- The member consents and the gate passes, as the kyc Edge Function does before the selfie.
create function pg_temp.begin_check(p_member uuid) returns void language sql as $$
  insert into public.consent (venue_id, member_id, purpose)
  select m.venue_id, m.id, 'kyc_verification' from public.member m where m.id = p_member
  on conflict (member_id, purpose) where withdrawn_at is null do nothing;
  select public.begin_kyc_vendor_call(p_member, true);
$$;

-- A selfie that passed liveness, with whoever the face search found.
create function pg_temp.selfie(p_member uuid, p_same_face_as uuid default null) returns text language sql as $$
  select pg_temp.begin_check(p_member);
  select public.claim_kyc_selfie(p_member);
  select public.record_kyc_selfie(p_member, 95, p_same_face_as);
$$;

-- DigiLocker for a member whose selfie is in: their own name, and a photo that matches the selfie.
create function pg_temp.digilocker(p_member uuid, p_birth date, p_pan text, p_aadhaar text) returns text language sql as $$
  select public.record_kyc_started(p_member, 'session');
  select public.record_kyc_digilocker(p_member, p_birth, 'XXXX XXXX 1234', p_aadhaar, p_pan, 'Gurugram', 'vendor', true, true, 97);
$$;

-- The selfie comes first, one check at a time, and is the KYC photo.
select pg_temp.begin_check('00000000-0000-4000-8000-000000000202');
select public.record_kyc_started('00000000-0000-4000-8000-000000000202', 'early');
select is((select digilocker_session_id from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000202'), null,
  'no DigiLocker before the selfie');
select pg_temp.begin_check('00000000-0000-4000-8000-000000000201');
select ok(public.claim_kyc_selfie('00000000-0000-4000-8000-000000000201'), 'a selfie check begins');
select ok(not public.claim_kyc_selfie('00000000-0000-4000-8000-000000000201'), 'a second one at the same time does not');
update public.kyc_record set selfie_claimed_at = now() - interval '11 minutes' where member_id = '00000000-0000-4000-8000-000000000201';
select ok(public.claim_kyc_selfie('00000000-0000-4000-8000-000000000201'), 'a check that died lapses after ten minutes');
select public.release_kyc_selfie('00000000-0000-4000-8000-000000000201');
select is(public.record_kyc_selfie('00000000-0000-4000-8000-000000000201', 96, null), null, 'a selfie is only recorded by the check holding the claim');
select ok(public.claim_kyc_selfie('00000000-0000-4000-8000-000000000201'), 'and a failed one is released at once');
select is(public.record_kyc_selfie('00000000-0000-4000-8000-000000000201', 96, null), 'started', 'a live selfie is kept');
select is((select photo_path from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000201'),
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg',
  'in the private bucket, under the venue and the member');
select ok(not public.claim_kyc_selfie('00000000-0000-4000-8000-000000000201'), 'and no other selfie can replace it');

-- An adult whose selfie matches DigiLocker's photo is verified and may take a seat.
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000201', '1990-04-12', 'ABCPM1234F', 'aadhaar-arjun'), 'verified',
  'a live selfie matching DigiLocker''s photo verifies an adult');
select ok(private.is_kyc_complete('00000000-0000-4000-8000-000000000201'), 'and the member may take a seat');
select is((select count(*)::int from public.outbox_event
           where event_type = 'kyc.completed' and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000201'),
  1, 'kyc.completed is emitted once');
select isnt((select aadhaar_reference from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000201'), 'aadhaar-arjun',
  'the Aadhaar reference is kept only as an HMAC');

-- The gate re-reads the age itself: 18 today passes, a day short does not.
update public.kyc_record set date_of_birth = (now() at time zone 'Asia/Kolkata')::date - interval '18 years'
where member_id = '00000000-0000-4000-8000-000000000201';
select ok(private.is_kyc_complete('00000000-0000-4000-8000-000000000201'), 'a member who turns 18 today may play');
update public.kyc_record set date_of_birth = (now() at time zone 'Asia/Kolkata')::date - interval '18 years' + interval '1 day'
where member_id = '00000000-0000-4000-8000-000000000201';
select ok(not private.is_kyc_complete('00000000-0000-4000-8000-000000000201'), 'a member a day short of 18 may not');
update public.kyc_record set date_of_birth = '1990-04-12' where member_id = '00000000-0000-4000-8000-000000000201';

-- Under 18, or no date of birth at all.
select pg_temp.selfie('00000000-0000-4000-8000-000000000204');
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000204',
  ((now() at time zone 'Asia/Kolkata')::date - interval '18 years' + interval '1 day')::date, 'DEFPR4567J', 'aadhaar-rohan'),
  'refused', 'a member a day short of 18 is refused');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000204'), 'under_18', 'as under 18');
select ok(not private.is_kyc_complete('00000000-0000-4000-8000-000000000204'), 'and never reaches a seat');
select pg_temp.selfie('00000000-0000-4000-8000-000000000205');
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000205', null, 'EFGPS5678K', 'aadhaar-five'), 'needs_review',
  'DigiLocker without a date of birth waits for staff, never verifies');

-- A PAN, an Aadhaar or a face that a verified member holds is refused.
select pg_temp.selfie('00000000-0000-4000-8000-000000000202');
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000202', '1992-02-02', 'ABCPM1234F', 'aadhaar-kabir'), 'refused',
  'a PAN a verified member holds is refused');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000202'), 'duplicate_pan',
  'as a duplicate PAN');
select ok(not private.is_kyc_complete('00000000-0000-4000-8000-000000000202'), 'and never reaches a seat');
select pg_temp.selfie('00000000-0000-4000-8000-000000000203');
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000203', '1993-03-03', 'CDEPK3456H', 'aadhaar-arjun'), 'refused',
  'an Aadhaar a verified member holds is refused');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000203'), 'duplicate_aadhaar',
  'as a duplicate Aadhaar');
select is(pg_temp.selfie('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000201'), 'refused',
  'a face a verified member has is refused at the selfie');
select is((select row(refusal, same_face_as)::text from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000206'),
  '(duplicate_face,00000000-0000-4000-8000-000000000201)', 'as a duplicate face, naming the member for staff');
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000206', '1990-01-01', 'FGHPT5678K', 'aadhaar-six'), null,
  'and a refused check never restarts');
select throws_ok(
  $$ update public.kyc_record set status = 'verified', refusal = null, verified_at = now()
     where member_id = '00000000-0000-4000-8000-000000000202' $$,
  '23505', null, 'however checks race, a venue never has two verified members with one PAN'
);

-- A clash with a check that is not verified refuses no one: the first to arrive may be the impostor.
select pg_temp.selfie('00000000-0000-4000-8000-000000000207');
select public.record_kyc_started('00000000-0000-4000-8000-000000000207', 'session');
select public.record_kyc_digilocker_failed('00000000-0000-4000-8000-000000000207');
select is(public.record_kyc_pan('00000000-0000-4000-8000-000000000207', 'JKLPB7890M', '1985-05-05', 'vendor-pan'), 'needs_review',
  'a PAN alone waits for staff');
select pg_temp.selfie('00000000-0000-4000-8000-000000000208');
select is(pg_temp.digilocker('00000000-0000-4000-8000-000000000208', '1986-06-06', 'JKLPB7890M', 'aadhaar-eight'), 'needs_review',
  'the real holder of a PAN an unfinished check claims is not refused: staff decide');

-- A DigiLocker photo that is not the selfie's face: someone else's documents, so staff review.
select pg_temp.selfie('00000000-0000-4000-8000-000000000301');
select public.record_kyc_started('00000000-0000-4000-8000-000000000301', 'session');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-000000000301', '1990-01-01', 'XXXX XXXX 9999', 'aadhaar-other',
  'GHIPA6789L', 'Elsewhere', 'vendor', true, false, 31), 'needs_review', 'a DigiLocker photo that does not match the selfie waits for staff');
select is((select row(pan, aadhaar_reference, date_of_birth)::text from public.kyc_record
           where member_id = '00000000-0000-4000-8000-000000000301'), '(,,)', 'keeping none of that identity');
select ok(exists (select 1 from public.audit_log where entity = 'kyc_record' and after ->> 'refusal' = 'duplicate_face'),
  'the audit log records why a check was refused');

-- Members see their own status, never why it was refused or the vendor's scores; only the kyc Edge
-- Function writes; only lanes' own functions ask the gate.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select is((select status from public.kyc_record), 'refused', 'a member sees that their check was refused');
select throws_ok($$ select refusal from public.kyc_record $$, '42501', null, 'but not why');
select throws_ok($$ select liveness_score, face_match_score, aadhaar_reference, same_face_as from public.kyc_record $$, '42501', null,
  'nor the vendor''s scores and references');
select throws_ok($$ select public.record_kyc_selfie('00000000-0000-4000-8000-000000000203', 99, null) $$, '42501', null,
  'a member cannot record their own selfie');
select throws_ok($$ select public.claim_kyc_selfie('00000000-0000-4000-8000-000000000203') $$, '42501', null,
  'nor start a selfie check');
select throws_ok($$ select private.is_kyc_complete('00000000-0000-4000-8000-000000000203') $$, '42501', null,
  'nor ask the gate directly');
reset role;

select * from finish();
rollback;
