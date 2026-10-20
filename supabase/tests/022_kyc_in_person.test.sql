-- KYC in person at the club (#246): a KYC reviewer checks a member's originals while no vendor is
-- live. 101 Vikram (super admin: KYC review, at both venues), 104 Sana (cashier: no KYC review); at the
-- club 203 Naina, 204 Rohan, 202 Kabir, 201 Arjun, 209 Tara and 210 Dev (members with no check); 301
-- Asha in the practice venue. Photos are stood in for by storage rows.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Arjun's seeded identity check (#21) is set aside: this test takes him through the check from the start.
delete from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000201';

-- As the Edge Function does: the reviewer asks where this check's photo goes, and the photo is stored there.
create function pg_temp.photo_for(p_member_id uuid) returns text language plpgsql as $$
declare
  v_path text := public.authorize_in_person_kyc(p_member_id);
begin
  set local role postgres;
  insert into storage.objects (bucket_id, name) values ('kyc', v_path);
  set local role authenticated;
  return v_path;
end;
$$;

-- A check as the reviewer, with its own photo.
create function pg_temp.check(p_member_id uuid, p_date_of_birth date, p_last4 text, p_pan text) returns text language sql as $$
  select public.check_kyc_in_person(p_member_id, pg_temp.photo_for(p_member_id), p_date_of_birth, p_last4, p_pan, true);
$$;

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.photo_for(uuid), pg_temp.check(uuid, date, text, text), pg_temp.as_user(uuid) to authenticated;

-- Finding a member.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select results_eq($$ select full_name, phone_last4, status from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'naina') $$,
  $$ values ('Naina Kapoor'::text, '0203'::text, null::text) $$, 'a KYC reviewer finds a member with no check by name, with only the last four digits');
select results_eq($$ select full_name from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', '0204') $$,
  $$ values ('Rohan Bhatia'::text) $$, 'or by the last digits of their number');
select is_empty($$ select * from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', '%%') $$,
  'a search is text, never a pattern');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'naina') $$,
  'staff without KYC review find nobody');
select throws_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000201') $$,
  '42501', null, 'nor check anyone');

-- The photo.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select matches(public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000203'),
  '^00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/in-person-[0-9a-f-]{36}\.jpg$',
  'each check''s photo has a path of its own, never the member''s selfie');
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203',
    public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000203'), '1990-04-12', '1234', 'ABCPN1234D', true) $$,
  'RVPHT', null, 'never without the photo stored');
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg', '1990-04-12', '1234', 'ABCPN1234D', true) $$,
  'RVPHT', null, 'nor with a photo the check did not take');
reset role;
insert into storage.objects (bucket_id, name, created_at) values
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/in-person-00000000-0000-4000-8000-0000000000aa.jpg',
   now() - interval '11 minutes');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/in-person-00000000-0000-4000-8000-0000000000aa.jpg',
    '1990-04-12', '1234', 'ABCPN1234D', true) $$,
  'RVPHT', null, 'nor with one taken more than ten minutes ago');

-- The details and consent.
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203',
    pg_temp.photo_for('00000000-0000-4000-8000-000000000203'), '1990-04-12', '1234', 'ABCPN1234D', false) $$,
  '22023', null, 'never without the member''s consent');
select throws_ok($$ select pg_temp.check('00000000-0000-4000-8000-000000000203', '1990-04-12', '12345', 'ABCPN1234D') $$,
  '22023', null, 'and only the last four Aadhaar digits');

-- Naina is checked and verified.
select is(pg_temp.check('00000000-0000-4000-8000-000000000203', '1990-04-12', '1234', 'abcpn1234d'), 'verified',
  'a member checked in person, 18 or over and with a PAN and Aadhaar no verified member holds, is verified');
reset role;
select results_eq(
  $$ select method, masked_aadhaar, pan, date_of_birth, photo_path ~ '/in-person-' from public.kyc_record
     where member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('manual'::text, 'XXXX XXXX 1234'::text, 'ABCPN1234D'::text, '1990-04-12'::date, true) $$,
  'with the check''s photo, the masked Aadhaar and the PAN kept, and never the full Aadhaar number');
select ok(private.is_kyc_complete('00000000-0000-4000-8000-000000000203'), 'and may now take a seat');
select results_eq(
  $$ select c.purpose, s.full_name from public.consent c join public.staff s on s.id = c.recorded_by_staff_id
     where c.member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('kyc_verification'::text, 'Vikram Rao'::text) $$, 'their consent is recorded, with who took it');
select results_eq(
  $$ select r.decision, r.method, r.outcome, s.full_name from public.kyc_review r join public.staff s on s.id = r.reviewed_by_staff_id
     where r.member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('approved'::text, 'manual'::text, 'verified'::text, 'Vikram Rao'::text) $$, 'and the check is kept as manual, with the reviewer''s name');
select results_eq(
  $$ select a.after ->> 'decision', a.after ->> 'method' from public.audit_log a
     where a.entity = 'kyc_review' and a.after ->> 'member_id' = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('approved', 'manual') $$, 'the audit log keeps the decision, made in person');
select is((select count(*)::integer from public.audit_log a
           where concat(a.before::text, a.after::text, a.reason) ~ '(ABCPN1234D|XXXX XXXX 1234)'), 0,
  'and never a document number');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000203') $$,
  'RVKYC', null, 'a check already decided is not checked again');
select is_empty($$ select * from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'naina') $$,
  'nor offered to check');

-- The gate still decides.
select is(pg_temp.check('00000000-0000-4000-8000-000000000204', '1991-01-01', '5678', 'ABCPN1234D'), 'refused',
  'a PAN a verified member already holds is refused');
select is(pg_temp.check('00000000-0000-4000-8000-000000000201', (current_date - interval '17 years')::date, '4321', 'ABCPA4321Q'),
  'refused', 'someone under 18 is refused');
select is(pg_temp.check('00000000-0000-4000-8000-000000000202', '1990-04-12', '1234', 'ABCPK1234K'), 'refused',
  'the last four Aadhaar digits and date of birth of a verified member are refused, whatever the PAN');
reset role;
select results_eq($$ select member_id::text, refusal from public.kyc_record
                     where member_id in ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000201',
                                         '00000000-0000-4000-8000-000000000202') order by member_id $$,
  $$ values ('00000000-0000-4000-8000-000000000201', 'under_18'), ('00000000-0000-4000-8000-000000000202', 'duplicate_aadhaar'),
            ('00000000-0000-4000-8000-000000000204', 'duplicate_pan') $$,
  'under 18, a duplicate Aadhaar and a duplicate PAN, each for its reason');

-- Against a member a vendor verified: the same last four digits and date of birth are the same Aadhaar.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, masked_aadhaar, pan, aadhaar_reference, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000209', 'verified', 'digilocker', '1985-01-01',
        'XXXX XXXX 5555', 'ABCPT5555T', 'ref-tara', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000209/selfie.jpg', now());
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is(pg_temp.check('00000000-0000-4000-8000-000000000210', '1985-01-01', '5555', 'ABCPD5555D'), 'refused',
  'a check in person matching a vendor-verified member''s last four Aadhaar digits and date of birth is refused');
reset role;

-- What the app's selfie found is kept: a face like a verified member's is refused. Members the test
-- adds, not the reviewer: no claims, so the audit log names nobody.
select set_config('request.jwt.claims', '', true);
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000002f1', '00000000-0000-4000-8000-000000000001', 'Meher Sood', '+919000000291'),
  ('00000000-0000-4000-8000-0000000002f2', '00000000-0000-4000-8000-000000000001', 'Zoya Rana', '+919000000292');
insert into public.kyc_record (venue_id, member_id, status, method, same_face_as, photo_path) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002f1', 'started', 'digilocker',
   '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002f1/selfie.jpg');
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, masked_aadhaar, aadhaar_reference, photo_path) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002f2', 'needs_pan', 'digilocker', '1992-02-02',
   'XXXX XXXX 7777', 'ref-zoya', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002f2/selfie.jpg');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is(pg_temp.check('00000000-0000-4000-8000-0000000002f1', '1993-03-03', '8888', 'ABCPM8888M'), 'refused',
  'a check the app started keeps the face its selfie matched, and the gate refuses it');
select throws_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-0000000002f2') $$,
  'RVKYC', null, 'a check DigiLocker finished, waiting for the PAN, is not replaced');
reset role;
select is((select refusal || ' ' || coalesce(same_face_as::text, 'none') from public.kyc_record
           where member_id = '00000000-0000-4000-8000-0000000002f1'),
  'duplicate_face 00000000-0000-4000-8000-000000000203', 'refused as a duplicate face');

-- Never one's own check, nor a member the reviewer added or changed. Vikram's own member record is
-- the test's, not his: no claims, so the audit log names nobody.
select set_config('request.jwt.claims', '', true);
insert into public.member (venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Vikram Rao', '+919000000101');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok(
  $$ select public.authorize_in_person_kyc((select id from public.member where user_id = '00000000-0000-4000-8000-000000000101')) $$,
  '42501', null, 'a reviewer never checks their own record');
-- A member Vikram adds: his claims are still set, so the audit log names him, as when staff add one.
reset role;
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000002f3', '00000000-0000-4000-8000-000000000001', 'V Rao', '+919000000293');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-0000000002f3') $$,
  '42501', null, 'nor a member they added, who could be anyone they made up');
select is_empty($$ select * from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'v rao') $$,
  'nor is offered one');

-- The practice venue: a check settles there too, and its event reaches no consumer.
select is(pg_temp.check('00000000-0000-4000-8000-000000000301', '1990-01-01', '1111', 'ABCPZ1111Z'), 'verified',
  'a practice-venue member is checked with practice documents');
reset role;
select ok(exists (select 1 from public.outbox_event e where e.venue_id = '00000000-0000-4000-8000-000000000002'
                  and e.event_type = 'kyc.completed' and e.payload ->> 'member_id' = '00000000-0000-4000-8000-000000000301'),
  'its check completes');
-- Its event reaches no consumer: deliveries leave out the practice venue (006_kill_switch_and_outbox).

-- A check that clashes with another check, here one waiting for review with the same PAN, goes to review.
select set_config('request.jwt.claims', '', true);
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000002f4', '00000000-0000-4000-8000-000000000001', 'Ira Shah', '+919000000294'),
  ('00000000-0000-4000-8000-0000000002f5', '00000000-0000-4000-8000-000000000001', 'Kiran Rao', '+919000000295');
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002f4', 'needs_review', 'pan', '1988-08-08',
   'ABCPI4444I', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002f4/selfie.jpg');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is(pg_temp.check('00000000-0000-4000-8000-0000000002f5', '1989-09-09', '9999', 'ABCPI4444I'), 'needs_review',
  'a check in person holding the PAN of another unfinished check goes to review');
select results_eq($$ select waiting_because from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')
                     where member_id = '00000000-0000-4000-8000-0000000002f5' $$,
  $$ values ('clash'::text) $$, 'where the queue says it clashes');
reset role;
select results_eq($$ select outcome, method from public.kyc_review where member_id = '00000000-0000-4000-8000-0000000002f5' $$,
  $$ values ('needs_review'::text, 'manual'::text) $$, 'and its review row says where it went');

-- The KYC sign-up kill switch stops checks in person. Last: the switch is not released in this test.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Vendor outage', s.id from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000202') $$,
  'RVKIL', null, 'the KYC sign-up kill switch stops them');
reset role;

select * from finish();
rollback;
