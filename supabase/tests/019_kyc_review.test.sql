-- The KYC review queue (#31, decision 0035): a KYC reviewer sees the venue's checks waiting for review
-- with why each waits, and approves or rejects each with a reason, never their own (by login, phone or
-- name). Approving needs the date of birth and the PAN, entered from the originals where none was kept,
-- and goes through settle_kyc, so the gate still refuses under 18 and any PAN, Aadhaar reference or face
-- (either way) a verified member holds. Every decision is kept, and audited without the reason; the
-- kill switch, freezes and other venues hold. 101 Vikram (super admin), 103 Aditya (admin, reviewer),
-- 104 Sana (cashier); members 201 Arjun, 202 Kabir, 203 Naina, 204 Rohan, 209 Tara, 210 Dev.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.check(p_member uuid, p_status text, p_method text, p_dob date, p_pan text, p_same_face uuid default null)
returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, same_face_as, photo_path, verified_at)
  values ('00000000-0000-4000-8000-000000000001', p_member, p_status, p_method, p_dob, p_pan, p_same_face,
          '00000000-0000-4000-8000-000000000001/' || p_member || '/selfie.jpg', case when p_status = 'verified' then now() end);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- Four more members: one to reject, one frozen, one for the kill switch, and Aditya's second number.
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000002b1', '00000000-0000-4000-8000-000000000001', 'Meher Arora', '+919000000291'),
  ('00000000-0000-4000-8000-0000000002b2', '00000000-0000-4000-8000-000000000001', 'Ira Shah', '+919000000292'),
  ('00000000-0000-4000-8000-0000000002b3', '00000000-0000-4000-8000-000000000001', 'Kunal Rao', '+919000000293'),
  ('00000000-0000-4000-8000-0000000002b4', '00000000-0000-4000-8000-000000000001', 'Aditya Malhotra', '+919000000294');
delete from public.kyc_record where venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.check('00000000-0000-4000-8000-000000000201', 'verified', 'digilocker', '1985-01-01', 'ABCPD1111D');
select pg_temp.check('00000000-0000-4000-8000-000000000202', 'needs_review', 'pan', '1990-05-01', 'ABCPK1234K');
-- Naina's DigiLocker record was in another name, so nothing of it was kept.
select pg_temp.check('00000000-0000-4000-8000-000000000203', 'needs_review', 'digilocker', null, null);
select pg_temp.check('00000000-0000-4000-8000-000000000204', 'needs_review', 'pan', '1995-01-01', 'ABCPD1111D');
-- Dev's face search found Tara: one face, two checks.
select pg_temp.check('00000000-0000-4000-8000-000000000209', 'needs_review', 'pan', '1993-07-07', 'ABCPT2222T');
select pg_temp.check('00000000-0000-4000-8000-000000000210', 'needs_review', 'pan', '1994-08-08', 'ABCPV3333V',
                     '00000000-0000-4000-8000-000000000209');
select pg_temp.check('00000000-0000-4000-8000-0000000002b1', 'needs_review', 'pan', '1991-01-01', 'ABCPM4444M');
select pg_temp.check('00000000-0000-4000-8000-0000000002b2', 'needs_review', 'pan', '1992-02-02', 'ABCPI5555I');
select pg_temp.check('00000000-0000-4000-8000-0000000002b3', 'needs_review', 'pan', '1993-03-03', 'ABCPK6666K');
select pg_temp.check('00000000-0000-4000-8000-0000000002b4', 'needs_review', 'pan', '1980-02-02', 'ABCPA7777A');

-- The queue: why each waits, and clashes both ways.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select full_name, waiting_because, clashes_with from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
     where full_name in ('Kabir Sethi', 'Naina Kapoor', 'Rohan Bhatia', 'Tara Menon', 'Dev Malhotra', 'Arjun Mehta') order by full_name $$,
  $$ values ('Dev Malhotra'::text, 'pan_alone'::text, '{Tara Menon}'::text[]), ('Kabir Sethi', 'pan_alone', '{}'),
            ('Naina Kapoor', 'nothing_kept', '{}'), ('Rohan Bhatia', 'pan_alone', '{Arjun Mehta}'), ('Tara Menon', 'pan_alone', '{Dev Malhotra}') $$,
  'a reviewer sees the checks waiting, why, and who holds the same PAN or face, either way; not the verified');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') $$, 'a cashier sees none');

-- What a decision must carry.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000202', true, ' ') $$, '22023', null, 'a decision needs its reason');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000202', true, 'Aadhaar 1234.5678.9012 seen') $$, '22023', null,
  'with no Aadhaar number in it');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000202', true, 'Card ABCPK1234K seen') $$, '22023', null,
  'nor a PAN');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000202', true, 'PAN card seen', '1990-05-02') $$, '22023', null,
  'nor a date of birth where the check has one');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000202', true, 'PAN card seen', null, 'ABCPK9999K') $$, '22023', null,
  'nor a PAN where the check has one');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000002b4', true, 'PAN card seen') $$, '42501', null,
  'a reviewer never decides their own check, even under a second number');

-- Decisions.
select is(public.review_kyc('00000000-0000-4000-8000-000000000202', true, 'PAN card seen at the desk'), 'verified',
  'a PAN alone, approved, verifies the member');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000202', false, 'Second look') $$, 'RVKYC', null, 'and is decided once');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000201', true, 'Seen again') $$, 'RVKYC', null,
  'a verified check is not waiting for review');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000203', true, 'Aadhaar seen at the desk') $$, 'RVDOB', null,
  'a check that kept nothing needs the date of birth on the original document');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-000000000203', true, 'Aadhaar seen at the desk', '1992-03-04') $$, 'RVPAN', null,
  'and the PAN, so the gate can look for a duplicate');
select is(public.review_kyc('00000000-0000-4000-8000-000000000203', true, 'Aadhaar and PAN card seen at the desk', '1992-03-04', 'abcpn5555n'),
  'verified', 'with both, the reviewer verifies the member');
select is(public.review_kyc('00000000-0000-4000-8000-000000000204', true, 'PAN card seen at the desk'), 'refused',
  'the gate refuses a PAN a verified member holds, whatever the reviewer decides');
select is(public.review_kyc('00000000-0000-4000-8000-000000000210', true, 'PAN card seen at the desk'), 'verified', 'Dev, approved first, is verified');
select is(public.review_kyc('00000000-0000-4000-8000-000000000209', true, 'PAN card seen at the desk'), 'refused',
  'and then Tara, whose face his search found, is refused: one face is never two members');
select is(public.review_kyc('00000000-0000-4000-8000-0000000002b1', false, 'The photo is not the person at the desk'), 'refused',
  'a reviewer rejects a check');
reset role;

select results_eq(
  $$ select m.full_name, k.status, k.refusal, k.pan from public.kyc_record k join public.member m on m.id = k.member_id
     where m.full_name in ('Kabir Sethi', 'Naina Kapoor', 'Rohan Bhatia', 'Tara Menon', 'Dev Malhotra', 'Meher Arora')
       and m.venue_id = '00000000-0000-4000-8000-000000000001' order by m.full_name $$,
  $$ values ('Dev Malhotra'::text, 'verified'::text, null::text, 'ABCPV3333V'::text), ('Kabir Sethi', 'verified', null, 'ABCPK1234K'),
            ('Meher Arora', 'refused', 'staff_rejected', 'ABCPM4444M'), ('Naina Kapoor', 'verified', null, 'ABCPN5555N'),
            ('Rohan Bhatia', 'refused', 'duplicate_pan', 'ABCPD1111D'), ('Tara Menon', 'refused', 'duplicate_face', 'ABCPT2222T') $$,
  'each check ends where the decision and the gate put it');
select results_eq(
  $$ select r.decision, r.outcome, r.entered_date_of_birth, r.entered_pan, s.user_id from public.kyc_review r
     join public.staff s on s.id = r.reviewed_by_staff_id where r.member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('approved'::text, 'verified'::text, true, true, '00000000-0000-4000-8000-000000000103'::uuid) $$,
  'the decision is kept, with the reviewer and what they entered');
select is((select count(*)::int from public.outbox_event where event_type = 'kyc.completed'
           and payload ->> 'member_id' in ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203',
                                          '00000000-0000-4000-8000-000000000210')), 3,
  'kyc.completed goes out for each member verified, from settle_kyc');
select ok((select bool_and(after ? 'decision' and not after ? 'reason') from public.audit_log where entity = 'kyc_review'),
  'the audit log keeps each decision, never its reason');

-- Who reads the decisions.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select ok((select count(*) from public.kyc_review) >= 6, 'a reviewer reads the venue''s decisions');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select is((select count(*)::int from public.kyc_review), 0, 'a cashier reads none');
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select is((select count(*)::int from public.kyc_review), 0, 'nor does the member decided');
reset role;

-- The kill switch on KYC sign-up stops approvals, not rejections.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Vendor outage', s.id from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000002b3', true, 'PAN card seen') $$, 'RVKIL', null,
  'the KYC sign-up kill switch stops an approval');
select is(public.review_kyc('00000000-0000-4000-8000-0000000002b3', false, 'Not the person at the desk'), 'refused', 'not a rejection');
reset role;
update public.control_state
set released_at = now(), release_reason = 'Vendor back',
    released_by_staff_id = (select s.id from public.staff s
                            where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001')
where level = 'feature_kill' and released_at is null;

-- Freezes.
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-0000000002b2', 'Dispute', s.id from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000002b2', true, 'PAN card seen') $$, 'RVMBR', null,
  'a member freeze stops a decision');
reset role;
insert into public.control_state (venue_id, level, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Audit', s.id from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000002b2', false, 'Not the person') $$, 'RVFRZ', null,
  'and so does a venue freeze');
reset role;

-- Another venue, and nobody signed out.
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') $$,
  'a reviewer at the practice venue only sees nothing of the club');
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000002b2', false, 'Not the person') $$, '42501', null,
  'nor decides its checks');
select is((select count(*)::int from public.kyc_review), 0, 'nor reads its decisions');
reset role;
set local role anon;
select throws_ok($$ select public.kyc_review_queue('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nobody signed out reaches the queue');
reset role;
set local role service_role;
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000002b2', false, 'Not the person') $$, '42501', null,
  'nor does the service role');
reset role;

select * from finish();
rollback;
