-- KYC on Cashfree (#474; decision 0197). Cashfree keeps no Aadhaar reference and searches no faces, so a
-- check with the same identity key (DigiLocker's name by the name match's rule, date of birth and last four
-- Aadhaar digits, kept as a keyed hash) as another member's is held for a KYC reviewer, who sees whose: never
-- refused, as two people can share all three. 103 Aditya is a KYC reviewer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000004c1', '00000000-0000-4000-8000-000000000001', 'Rahul Sharma', '+919000099701'),
  ('00000000-0000-4000-8000-0000000004c2', '00000000-0000-4000-8000-000000000001', 'Rahul Sharma.', '+919000099702'),
  ('00000000-0000-4000-8000-0000000004c3', '00000000-0000-4000-8000-000000000001', 'Rahul Verma', '+919000099703');

-- Rahul Sharma was verified through DigiLocker; his identity key was kept.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, masked_aadhaar, identity_key, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000004c1', 'verified', 'digilocker', '1995-02-02',
        'XXXX XXXX 5647', private.kyc_reference('rahul sharma|1995-02-02|5647'),
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000004c1/selfie.jpg', now());
-- Two new checks, selfies taken: the same person registered as `Rahul Sharma.`, and Rahul Verma.
insert into public.kyc_record (venue_id, member_id, status, method, photo_path)
select '00000000-0000-4000-8000-000000000001', m, 'started', 'digilocker', '00000000-0000-4000-8000-000000000001/' || m || '/selfie.jpg'
from unnest(array['00000000-0000-4000-8000-0000000004c2', '00000000-0000-4000-8000-0000000004c3']::uuid[]) m;

select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004c2', '1995-02-02', 'XXXX XXXX 5647', null, 'ABCPV1234D',
            'Gurugram', 'rivr-1', true, true, 91, 'rahul sharma|1995-02-02|5647'), 'needs_review',
  'a DigiLocker check with the identity key of another member''s check waits for a KYC reviewer, though everything else passed');
select is((select identity_key from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000004c2'),
  private.kyc_reference('rahul sharma|1995-02-02|5647'), 'the key is kept as a keyed hash, never the name and digits');
select ok(private.kyc_clashes('00000000-0000-4000-8000-0000000004c1'), 'and the clash is seen from either check');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004c3', '1995-02-02', 'XXXX XXXX 5647', null, 'XYZPP4321W',
            'Gurugram', 'rivr-2', true, true, 90, 'rahul verma|1995-02-02|5647'), 'verified',
  'another name with the same date of birth and digits is verified');

-- A document in someone else's name keeps none of the identity, the key included.
update public.kyc_record set status = 'started', verified_at = null, identity_key = null, date_of_birth = null, masked_aadhaar = null, pan = null
where member_id = '00000000-0000-4000-8000-0000000004c3';
select public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004c3', '1995-02-02', 'XXXX XXXX 5647', null, 'XYZPP4321W',
         'Gurugram', 'rivr-3', false, true, 90, 'someone else|1995-02-02|5647');
select is((select identity_key from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000004c3'), null::text,
  'a document in another name keeps no identity key');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}', true);
select results_eq(
  $$ select waiting_because, clashes_with from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
     where member_id = '00000000-0000-4000-8000-0000000004c2' $$,
  $$ values ('clash'::text, array['Rahul Sharma']::text[]) $$,
  'the reviewer sees why it waits, and whose check it matches');
reset role;

select * from finish();
rollback;
