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

-- With KYC sign-up stopped, nothing moves.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Vendor breach', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select throws_ok($$ select public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005d1') $$, 'RVKIL', null,
  'no check moves while KYC sign-up is stopped');

-- Only the service role sends a check to the desk.
select ok(not has_function_privilege('authenticated', 'public.record_kyc_digilocker_failed(uuid)', 'execute'), 'a signed-in user cannot');
select ok(not has_function_privilege('anon', 'public.record_kyc_digilocker_failed(uuid)', 'execute'), 'nor anyone signed out');
select ok(has_function_privilege('service_role', 'public.record_kyc_digilocker_failed(uuid)', 'execute'), 'the service role can');

select * from finish();
rollback;
