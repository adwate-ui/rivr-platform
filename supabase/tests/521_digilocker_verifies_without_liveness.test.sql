-- A DigiLocker check verifies at once with no liveness check (the owner, 16 Nov 2026; decision 0677, answering #1024). Zoop
-- has no liveness, so its selfie is kept with no score (decision 0671): a DigiLocker match (the face, a date of birth, and a
-- PAN or the identity key) verifies at once, as decision 0400 has it, and the queue never says a check waits for liveness.
-- 103 Aditya is a KYC reviewer. The members are made here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-000000000001', 'Neha Joshi', '+919000051801'),
  ('00000000-0000-4000-8000-0000000005e2', '00000000-0000-4000-8000-000000000001', 'Arjun Bhat', '+919000051802'),
  ('00000000-0000-4000-8000-0000000005e3', '00000000-0000-4000-8000-000000000001', 'Leela Das', '+919000051803'),
  ('00000000-0000-4000-8000-0000000005e4', '00000000-0000-4000-8000-000000000001', 'Kavya Iyer', '+919000051804');

-- A check whose selfie is in, with the liveness score its vendor gave (none from Zoop), and its hand-off begun.
create function pg_temp.started(p_member uuid, p_liveness smallint) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, method, digilocker_session_id, photo_path, liveness_score)
  values ('00000000-0000-4000-8000-000000000001', p_member, 'started', 'digilocker', 'session-' || p_member,
          '00000000-0000-4000-8000-000000000001/' || p_member || '/selfie.jpg', p_liveness);
$$;

-- Neha's selfie had no liveness check (Zoop): DigiLocker's Aadhaar and PAN match her face, and she is verified at once.
select pg_temp.started('00000000-0000-4000-8000-0000000005e1', null);
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005e1', '1994-02-14', 'XXXX XXXX 5181', null, 'NEHPJ5181J',
            'Gurugram', 'zoop-dl-1', true, 100, 'neha joshi|1994-02-14|5181', 'Neha Joshi'), 'verified',
  'a match whose selfie had no liveness check is verified at once');
select is((select row(date_of_birth, masked_aadhaar, pan, verified_at is not null)::text from public.kyc_record
           where member_id = '00000000-0000-4000-8000-0000000005e1'),
  '(1994-02-14,"XXXX XXXX 5181",NEHPJ5181J,t)', 'with what DigiLocker gave kept');

-- Arjun's selfie passed a vendor's liveness check: verified at once, as always.
select pg_temp.started('00000000-0000-4000-8000-0000000005e2', 93::smallint);
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005e2', '1990-10-10', 'XXXX XXXX 5182', null, 'ARJPB5182B',
            'Gurugram', 'zoop-dl-2', true, 96, 'arjun bhat|1990-10-10|5182', 'Arjun Bhat'), 'verified',
  'a match after a liveness check is verified at once too');

-- Leela's DigiLocker face is not her selfie: she waits, with nothing kept, as before.
select pg_temp.started('00000000-0000-4000-8000-0000000005e3', null);
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005e3', '1987-03-03', 'XXXX XXXX 5183', null, 'LEEPD5183D',
            'Gurugram', 'zoop-dl-3', false, 0, 'leela das|1987-03-03|5183', 'Leela Das'), 'needs_review',
  'a face that is not the selfie''s still waits');

-- Kavya's Aadhaar gives the year of birth alone: she waits, for that and not for liveness.
select pg_temp.started('00000000-0000-4000-8000-0000000005e4', null);
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005e4', null, 'XXXX XXXX 5184', null, 'KAVPI5184I',
            'Gurugram', 'zoop-dl-4', true, 100, null, 'Kavya Iyer'), 'needs_review',
  'a match with no date of birth still waits');

select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select is((select waiting_because from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
           where member_id = '00000000-0000-4000-8000-0000000005e3'), 'nothing_kept', 'the reviewer is told the face is not the selfie''s');
select is((select waiting_because from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
           where member_id = '00000000-0000-4000-8000-0000000005e4'), 'no_date_of_birth', 'and the date of birth is missing, not liveness');
select is((select waiting_because from public.kyc_review_page('00000000-0000-4000-8000-000000000001')
           where member_id = '00000000-0000-4000-8000-0000000005e4'), 'no_date_of_birth', 'on the console''s page of the queue too');
select is((select count(*)::int from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') where waiting_because = 'no_liveness'), 0,
  'no check waits for liveness');
select is((select count(*)::int from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
           where member_id = '00000000-0000-4000-8000-0000000005e1'), 0, 'and Neha is not in the queue');
reset role;

select * from finish();
rollback;
