-- The KYC review queue (#31): a KYC reviewer sees the venue's checks waiting for review, approves or
-- rejects each with a reason, never their own; the gate still refuses under 18 and a duplicate of a
-- verified member; every decision is kept with who made it. 101 Vikram (super admin), 103 Aditya
-- (admin, KYC reviewer, also a member), 104 Sana (cashier); members 201 Arjun, 202 Kabir, 203 Naina,
-- 204 Rohan, 209 Tara, 210 Dev.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.photo(p_member uuid) returns text language sql as $$
  select '00000000-0000-4000-8000-000000000001/' || p_member || '/selfie.jpg'
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

insert into public.member (id, venue_id, user_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000001a3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103',
   'Aditya Malhotra', '+919000000103');
delete from public.kyc_record where venue_id = '00000000-0000-4000-8000-000000000001';
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  -- Arjun is verified and holds this PAN.
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'verified', 'digilocker', '1985-01-01',
   'ABCPD1111D', pg_temp.photo('00000000-0000-4000-8000-000000000201'), now()),
  -- Kabir gave a PAN alone (#198).
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'needs_review', 'pan', '1990-05-01',
   'ABCPK1234K', pg_temp.photo('00000000-0000-4000-8000-000000000202'), null),
  -- Naina's DigiLocker record was in another name, so nothing of it was kept.
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'needs_review', 'digilocker', null,
   null, pg_temp.photo('00000000-0000-4000-8000-000000000203'), null),
  -- Rohan gave the PAN Arjun holds.
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'needs_review', 'pan', '1995-01-01',
   'ABCPD1111D', pg_temp.photo('00000000-0000-4000-8000-000000000204'), null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000209', 'needs_review', 'pan', '1993-07-07',
   'ABCPT2222T', pg_temp.photo('00000000-0000-4000-8000-000000000209'), null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000210', 'needs_review', 'digilocker', null,
   null, pg_temp.photo('00000000-0000-4000-8000-000000000210'), null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000001a3', 'needs_review', 'pan', '1980-02-02',
   'ABCPA3333A', pg_temp.photo('00000000-0000-4000-8000-0000000001a3'), null);

-- The queue.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select full_name, status, clashes_with from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
     where full_name in ('Kabir Sethi', 'Rohan Bhatia', 'Arjun Mehta') order by full_name $$,
  $$ values ('Kabir Sethi'::text, 'needs_review'::text, '{}'::text[]), ('Rohan Bhatia', 'needs_review', '{Arjun Mehta}') $$,
  'a KYC reviewer sees the checks waiting for review, with the members who hold the same PAN, and not the verified ones');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') $$, 'a cashier sees none');

-- Deciding.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000001a3', true, 'My own PAN card') $$, '42501', null,
  'a reviewer never decides their own check');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000202', true, ' ') $$, '22023', null, 'a decision needs its reason');
select is(public.review_kyc('00000000-0000-4000-8000-000000000202', true, 'PAN card seen at the desk'), 'verified',
  'a PAN alone, approved, verifies the member');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000202', false, 'Second look') $$, 'RVKYC', null,
  'and is decided once');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000203', true, 'Aadhaar seen at the desk') $$, 'RVDOB', null,
  'a check with no date of birth needs the one on the original document');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000203', true, 'Aadhaar seen at the desk', current_date + 1) $$,
  '22023', null, 'which is never in the future');
select is(public.review_kyc('00000000-0000-4000-8000-000000000203', true, 'Aadhaar seen at the desk; name as registered', '1992-03-04'),
  'verified', 'with it, the reviewer verifies the member');
select is(public.review_kyc('00000000-0000-4000-8000-000000000204', true, 'PAN card seen at the desk'), 'refused',
  'the gate still refuses a PAN a verified member holds, whatever the reviewer decides');
select is(public.review_kyc('00000000-0000-4000-8000-000000000210', true, 'Aadhaar seen at the desk', '2012-01-01'), 'refused',
  'and anyone under 18');
select is(public.review_kyc('00000000-0000-4000-8000-000000000209', false, 'The photo is not the person at the desk'), 'refused',
  'a reviewer rejects a check');
reset role;

select results_eq(
  $$ select k.status, k.refusal from public.kyc_record k
     where k.member_id in ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203',
                           '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000209',
                           '00000000-0000-4000-8000-000000000210')
     order by k.member_id $$,
  $$ values ('verified'::text, null::text), ('verified', null), ('refused', 'duplicate_pan'), ('refused', 'staff_rejected'),
            ('refused', 'under_18') $$,
  'each check ends where the decision and the gate put it');
select results_eq(
  $$ select r.decision, r.outcome, r.entered_date_of_birth, s.user_id from public.kyc_review r join public.staff s on s.id = r.reviewed_by_staff_id
     where r.member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('approved'::text, 'verified'::text, true, '00000000-0000-4000-8000-000000000103'::uuid) $$,
  'the decision is kept, with the reviewer and the date of birth they entered');
select is((select count(*)::int from public.outbox_event where event_type = 'kyc.completed'
           and payload ->> 'member_id' in ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203')), 2,
  'kyc.completed goes out for each member verified');
select ok(exists (select 1 from public.audit_log where entity = 'kyc_review'), 'the audit log records the decisions');

-- A venue freeze stops a decision; nobody signed out reaches the queue.
insert into public.control_state (venue_id, level, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Audit', s.id from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000001a3', true, 'PAN card seen at the desk') $$, 'RVFRZ', null,
  'a venue freeze stops a decision');
reset role;
set local role anon;
select throws_ok($$ select public.kyc_review_queue('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nobody signed out reaches the queue');
reset role;

select * from finish();
rollback;
