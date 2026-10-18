-- Sign-up (#10): a new number confirmed by a code joins the club with a name and the codes it came
-- with; a registered number links instead; member.signed_up carries the codes. 202 Kabir (member),
-- 101 Vikram (super admin), 103 Aditya (admin).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- New numbers: two confirmed by a code, one never confirmed.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', '919000000951', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', '919000000952', null, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', '919000000953', now(), now(), now());

-- Signed in as a user whose session began with a code, as every session does (#187).
create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;

select pg_temp.as_user('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$ select public.sign_up('X', '{}') $$, '22023', null, 'a full name is needed');
select lives_ok($$ select public.sign_up('  Tara   Joshi ', '{"referral": "FRIEND1", "utmSource": "instagram",
  "utmCampaign": "launch week", "creator": "<bad>", "firstSeenAt": "2026-10-17T10:00:00Z"}') $$, 'a new number signs up');
select is(public.sign_up('Someone Else', '{}'), (select m.id from public.member m where m.user_id = '00000000-0000-4000-8000-0000000000a1'),
  'signing up again gives the same member');
reset role;

select results_eq(
  $$ select m.venue_id, m.full_name, m.phone, t.name from public.member m join public.tier t on t.id = m.tier_id
     where m.user_id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::uuid, 'Tara Joshi'::text, '+919000000951'::text, 'Member'::text) $$,
  'a member of the club, never the practice venue, named as given, on their number, in the default tier'
);
select results_eq(
  $$ select a.referral_code::text, a.creator_code::text, a.utm_source::text, a.utm_campaign::text, a.first_seen_at
     from public.sign_up_attribution a join public.member m on m.id = a.member_id
     where m.user_id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('FRIEND1'::text, null::text, 'instagram'::text, 'launch week'::text, '2026-10-17T10:00:00Z'::timestamptz) $$,
  'with the codes it arrived with, a malformed one dropped'
);
select is((select payload - 'member_id' from public.outbox_event where event_type = 'member.signed_up'),
  '{"referral_code": "FRIEND1", "utm_source": "instagram", "utm_campaign": "launch week"}'::jsonb,
  'member.signed_up carries the codes');
select is((select count(*)::int from public.outbox_event where event_type = 'member.signed_up'), 1, 'once');

-- A number staff registered is its member, not a sign-up.
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select is(public.sign_up(null, '{"referral": "X"}'), '00000000-0000-4000-8000-000000000202'::uuid, 'a registered number is its member');
reset role;
select is((select count(*)::int from public.outbox_event where event_type = 'member.signed_up'), 1, 'with no sign-up event');

-- Nobody joins without a code session, or while KYC sign-up is switched off.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a2');
select throws_ok($$ select public.sign_up('Ravi Kumar', '{}') $$, '42501', null, 'a number never confirmed by a code cannot join');
reset role;
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Paused', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a3');
select throws_ok($$ select public.sign_up('Ravi Kumar', '{}') $$, 'RVKIL', null, 'while KYC sign-up is switched off, nobody new joins');
reset role;

-- Who sees the codes.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}';
select is((select count(*)::int from public.sign_up_attribution), 0, 'a member does not see sign-up codes');
select throws_ok($$ select private.sign_up('Tara Joshi', '{}') $$, '42501', null, 'nor calls the private function');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select is((select count(*)::int from public.sign_up_attribution), 1, 'staff with member access do');
set local role anon;
select throws_ok($$ select public.sign_up('Anon Person', '{}') $$, '42501', null, 'the public cannot sign up without a number');
reset role;

select * from finish();
rollback;
