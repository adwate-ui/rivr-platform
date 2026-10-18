-- Sign-up (#10): a new number confirmed by a code joins the club with a name and the codes it came
-- with; a registered number links instead; member.signed_up carries the codes. 202 Kabir (member),
-- 101 Vikram (super admin), 103 Aditya (admin), 106 Pema (dealer).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- New numbers: two confirmed by a code, one never confirmed.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', '919000000951', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', '919000000952', null, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', '919000000953', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', '919000000954', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', '919000000955', now(), now(), now());

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
select throws_ok($$ select public.sign_up('Tаra Joshi', '{}') $$, '22023', null, 'a name with a lookalike letter is refused');
select lives_ok(format($$ select public.sign_up('  Tara   Joshi ', '{"referral": "FRIEND1", "utmSource": "instagram",
  "utmCampaign": "launch week", "creator": "<bad>", "firstSeenAt": "%s"}') $$,
  to_char((now() - interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), 'a new number signs up');
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
  $$ select a.referral_code::text, a.creator_code::text, a.utm_source::text, a.utm_campaign::text,
            a.first_seen_at between now() - interval '2 days' and now()
     from public.sign_up_attribution a join public.member m on m.id = a.member_id
     where m.user_id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('FRIEND1'::text, null::text, 'instagram'::text, 'launch week'::text, true) $$,
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

-- A practice-venue record made with a real number never takes a real sign-up.
insert into public.member (venue_id, full_name, phone)
values ('00000000-0000-4000-8000-000000000002', 'Training record', '+919000000954');
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a4');
select lives_ok($$ select public.sign_up('Meera Shah', '{}') $$, 'a number with only a practice record signs up');
reset role;
select is((select venue_id from public.member where user_id = '00000000-0000-4000-8000-0000000000a4'),
  '00000000-0000-4000-8000-000000000001'::uuid, 'as a member of the club');
select is((select user_id from public.member where full_name = 'Training record'), null, 'the practice record stays unlinked');

-- A first-seen time that is not a real time, or too old, is dropped; the sign-up goes through.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a5');
select lives_ok($$ select public.sign_up('Kiran Rao', '{"referral": "FRIEND2", "firstSeenAt": "2026-02-30T10:00:00Z"}') $$,
  'a first-seen time that is not a real date never stops a sign-up');
reset role;
select is((select a.first_seen_at from public.sign_up_attribution a join public.member m on m.id = a.member_id
           where m.user_id = '00000000-0000-4000-8000-0000000000a5'), null, 'and it is dropped');

-- Staff do not sign themselves up as players (#216).
select pg_temp.as_user('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.sign_up('Pema Lepcha', '{}') $$, 'RVSTF', null, 'a staff login cannot sign itself up as a player');
reset role;

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

-- Who sees the codes. Another venue has a sign-up too.
-- As the system, not a signed-in user: a venue's first settings take effect from the start.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
with elsewhere_member as (
  insert into public.member (venue_id, full_name, phone)
  values ('00000000-0000-4000-8000-0000000000e1', 'Elsewhere Member', '+919000000998') returning id, venue_id
)
insert into public.sign_up_attribution (member_id, venue_id, referral_code) select id, venue_id, 'THERE' from elsewhere_member;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}';
select is((select count(*)::int from public.sign_up_attribution), 0, 'a member does not see sign-up codes');
select throws_ok($$ select private.sign_up('Tara Joshi', '{}') $$, '42501', null, 'a session not started by a code cannot sign up');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select is((select count(*)::int from public.sign_up_attribution where venue_id = '00000000-0000-4000-8000-000000000001'), 3,
  'staff with member access see the venue''s sign-up codes');
select is((select count(*)::int from public.sign_up_attribution where venue_id = '00000000-0000-4000-8000-0000000000e1'), 0,
  'but not another venue''s');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
select is((select count(*)::int from public.sign_up_attribution), 0, 'a dealer, without member access, sees none');
set local role anon;
select throws_ok($$ select public.sign_up('Anon Person', '{}') $$, '42501', null, 'the public cannot sign up without a number');
reset role;

select * from finish();
rollback;
