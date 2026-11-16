-- When Zoop does not verify a member, their check waits for the desk, as while the venue checks identity at the club (the
-- owner, 16 Nov 2026; decision 0678): record_kyc_digilocker_failed keeps the check started, marks it for the desk
-- (at_club_from) and ends the DigiLocker session, with what was delivered for it. A check that moved on stays. The members
-- are made here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000005d1', '00000000-0000-4000-8000-000000000001', 'Meera Sethi', '+919000052201'),
  ('00000000-0000-4000-8000-0000000005d2', '00000000-0000-4000-8000-000000000001', 'Varun Khanna', '+919000052202');

-- Meera's selfie is in and her DigiLocker hand-off began, with a key for Zoop's delivery.
insert into public.kyc_record (venue_id, member_id, status, photo_path)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005d1', 'started',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000005d1/selfie.jpg');
select public.record_kyc_started('00000000-0000-4000-8000-0000000005d1', 'zoop-session-meera', 'key-for-session-meera-00');

select ok(public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005d1'), 'a DigiLocker that failed sends the check to the desk');
select is((select row(status, at_club_from is not null, digilocker_session_id is null)::text from public.kyc_record
           where member_id = '00000000-0000-4000-8000-0000000005d1'), '(started,t,t)',
  'still started, marked for the desk (so let in, and on the floor''s list), its DigiLocker session ended');
select is((select count(*)::int from private.kyc_digilocker_delivery where member_id = '00000000-0000-4000-8000-0000000005d1'), 0,
  'and what was waiting for Zoop''s delivery goes with it');
select is(public.kyc_digilocker_session('key-for-session-meera-00'), null, 'so a late delivery is not kept');

-- Failing again changes nothing, and keeps when she first went to the desk.
select is((select at_club_from from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005d1'),
  (select at_club_from from public.kyc_record k where k.member_id = '00000000-0000-4000-8000-0000000005d1'
   and public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005d1')),
  'failing again keeps when the check first went to the desk');

-- The desk then checks her in person, as any check waiting for it (check_kyc_in_person takes a started check).
select is((select status from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005d1'), 'started',
  'the desk''s check in person takes it from here');

-- Varun was verified: a late failure changes nothing.
insert into public.kyc_record (venue_id, member_id, status, photo_path, verified_at, date_of_birth)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005d2', 'verified',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000005d2/selfie.jpg', now(), '1990-01-01');
select ok(not public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005d2'), 'a verified check does not go to the desk');
select is((select row(status, at_club_from is null)::text from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005d2'),
  '(verified,t)', 'and is left as it was');

-- Why each check is at the desk is kept for the desk (the security review of #1039): above all the app's face check not
-- confirming the member against their Aadhaar photo.
select is((select desk_reason from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005d1'), 'digilocker_failed',
  'Meera''s DigiLocker failed, and the desk is told so');
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000005d3', '00000000-0000-4000-8000-000000000001', 'Ishaan Malhotra', '+919000052203');
insert into public.kyc_record (venue_id, member_id, status, photo_path)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005d3', 'started',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000005d3/selfie.jpg');
select public.record_kyc_started('00000000-0000-4000-8000-0000000005d3', 'zoop-session-ishaan', 'key-for-session-ishaan-0');
select ok(public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005d3', 'face_unconfirmed', 31),
  'a face the app could not match to the Aadhaar photo sends the check to the desk');
select is((select row(desk_reason, face_match_score)::text from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005d3'),
  '(face_unconfirmed,31)', 'with why, and Zoop''s score');
select public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005d3', 'digilocker_failed');
select is((select row(desk_reason, face_match_score)::text from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005d3'),
  '(face_unconfirmed,31)', 'a later, weaker failure (DigiLocker tried again in the app) never hides it');

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is((select desk_reason from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Ishaan')), 'face_unconfirmed',
  'the desk finding him is told his face was not confirmed');
select lives_ok($$ select desk_reason from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001') $$,
  'and its list for tonight carries why too');
reset role;

update public.kyc_record set status = 'needs_review' where member_id = '00000000-0000-4000-8000-0000000005d3';
select is((select desk_reason from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005d3'), null,
  'once the check is decided, it is no longer at the desk, and the reason goes');
select throws_ok($$ select public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005d1', 'because') $$, '23514', null,
  'a reason the desk does not know is refused');

-- With KYC sign-up stopped, nothing moves.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Vendor breach', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select throws_ok($$ select public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005d1') $$, 'RVKIL', null,
  'no check moves while KYC sign-up is stopped');

-- Only the service role sends a check to the desk.
select ok(not has_function_privilege('authenticated', 'public.record_kyc_digilocker_failed(uuid, text, integer)', 'execute'), 'a signed-in user cannot');
select ok(not has_function_privilege('anon', 'public.record_kyc_digilocker_failed(uuid, text, integer)', 'execute'), 'nor anyone signed out');
select ok(has_function_privilege('service_role', 'public.record_kyc_digilocker_failed(uuid, text, integer)', 'execute'), 'the service role can');

select * from finish();
rollback;
