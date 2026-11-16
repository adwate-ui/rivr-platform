-- A DigiLocker check verifies at once only after a liveness check (#1024's safest reading; decision 0675). Zoop has none,
-- so its selfie is kept with no liveness score (decision 0671): a matching DigiLocker check then waits for a KYC
-- reviewer, who is told why, instead of verifying at once (decision 0400). A selfie that passed a vendor's liveness check
-- still verifies at once. 103 Aditya is a KYC reviewer. The members are made here.
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
  ('00000000-0000-4000-8000-0000000005e3', '00000000-0000-4000-8000-000000000001', 'Leela Das', '+919000051803');

-- A check whose selfie is in, with the liveness score its vendor gave (none from Zoop), and its hand-off begun.
create function pg_temp.started(p_member uuid, p_liveness smallint) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, method, digilocker_session_id, photo_path, liveness_score)
  values ('00000000-0000-4000-8000-000000000001', p_member, 'started', 'digilocker', 'session-' || p_member,
          '00000000-0000-4000-8000-000000000001/' || p_member || '/selfie.jpg', p_liveness);
$$;

-- Neha's selfie had no liveness check: DigiLocker's Aadhaar and PAN match her face, and still a reviewer looks.
select pg_temp.started('00000000-0000-4000-8000-0000000005e1', null);
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005e1', '1994-02-14', 'XXXX XXXX 5181', null, 'NEHPJ5181J',
            'Gurugram', 'zoop-dl-1', true, 100, 'neha joshi|1994-02-14|5181', 'Neha Joshi'), 'needs_review',
  'a match whose selfie had no liveness check waits for a reviewer');
select is((select row(date_of_birth, masked_aadhaar, pan, verified_at is null)::text from public.kyc_record
           where member_id = '00000000-0000-4000-8000-0000000005e1'),
  '(1994-02-14,"XXXX XXXX 5181",NEHPJ5181J,t)', 'with what DigiLocker gave kept for the reviewer, and not verified');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select is((select waiting_because from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
           where member_id = '00000000-0000-4000-8000-0000000005e1'), 'no_liveness', 'and the reviewer is told why');
select is((select waiting_because from public.kyc_review_page('00000000-0000-4000-8000-000000000001')
           where member_id = '00000000-0000-4000-8000-0000000005e1'), 'no_liveness', 'on the console''s page of the queue too');
reset role;

-- Arjun's selfie passed a vendor's liveness check: verified at once, as before.
select pg_temp.started('00000000-0000-4000-8000-0000000005e2', 93::smallint);
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005e2', '1990-10-10', 'XXXX XXXX 5182', null, 'ARJPB5182B',
            'Gurugram', 'zoop-dl-2', true, 96, 'arjun bhat|1990-10-10|5182', 'Arjun Bhat'), 'verified',
  'a match after a liveness check verifies at once');

-- Leela's DigiLocker face is not her selfie: waiting, keeping nothing, as before (the reason is the face, not liveness).
select pg_temp.started('00000000-0000-4000-8000-0000000005e3', null);
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005e3', '1987-03-03', 'XXXX XXXX 5183', null, 'LEEPD5183D',
            'Gurugram', 'zoop-dl-3', false, 0, 'leela das|1987-03-03|5183', 'Leela Das'), 'needs_review',
  'a face that is not the selfie''s waits too');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select is((select waiting_because from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
           where member_id = '00000000-0000-4000-8000-0000000005e3'), 'nothing_kept', 'for its own reason');
reset role;

select * from finish();
rollback;
