-- Lane D builder's seed people (members 0000…0270 to 0299, staff 0170 to 0199, and from 26 Oct the ids …0d07xx that match their sign-in numbers 9190000007xx). Self-contained, after
-- 10_people.sql; every statement is idempotent. Those who sign in take code 123456 locally
-- (supabase/config.template.toml, [auth.sms.test_otp]).
--
-- The practice venue's own Kabir Sethi, Naina Kapoor and Rohan Bhatia, so its 100/200 list waits as the
-- club's does (55_waitlist.sql, #54). Practice records never sign in: no login, numbers of their own.

insert into public.member (id, venue_id, full_name, phone)
values
  ('00000000-0000-4000-8000-000000000270', '00000000-0000-4000-8000-000000000002', 'Kabir Sethi', '+919000000270'),
  ('00000000-0000-4000-8000-000000000271', '00000000-0000-4000-8000-000000000002', 'Naina Kapoor', '+919000000271'),
  ('00000000-0000-4000-8000-000000000272', '00000000-0000-4000-8000-000000000002', 'Rohan Bhatia', '+919000000272')
on conflict (id) do nothing;

-- The practice Kabir and Naina have finished the identity check, so the Paper fallback flow can seat
-- them and issue their chips (#52).
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000270', 'verified', 'digilocker', '1990-04-11', 'ABCPS2701K',
   '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000270/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000271', 'verified', 'digilocker', '1993-09-27', 'ABCPK2711L',
   '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000271/selfie.jpg', now())
on conflict do nothing;

-- The Paper fallback flow's own duty managers, super admins at both venues: one runs the drill and asks
-- to release the freeze, the other releases it (#52). The Rewards catalogue flow's marketing manager,
-- who keeps the catalogue and the League's seasons, and its floor manager, who reads the standings (#145, #147).
-- The Rewards flow's member, who redeems from the app, and its floor manager, who pairs a TV on the rewards
-- ticker and hands the redemption over (#148, #152). The Pot data flow's super admin (#114). The Tournament clock flow's floor manager and
-- member, who watches the clock on Home (#119). The Tournament registration flow's member, who registers and re-enters
-- from the app, and its floor manager (#118, #120). The Member erasure flow's super admin (#424). The super admins who
-- approve the Publish a promotion and Promotion simulation flows' promotions (#144). A row with no role is a member.
create temporary table lane_d_person (
  id uuid primary key,
  phone text not null,
  full_name text not null,
  job_title text,
  role public.staff_role
) on commit drop;

insert into lane_d_person (id, phone, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000175', '+919000000175', 'Gautam Sood', 'Duty manager', 'super_admin'),
  ('00000000-0000-4000-8000-000000000176', '+919000000176', 'Priya Nath', 'Duty manager', 'super_admin'),
  ('00000000-0000-4000-8000-000000000178', '+919000000700', 'Tanya Rao', 'Marketing manager', 'marketing'),
  ('00000000-0000-4000-8000-000000000179', '+919000000701', 'Kabir Anand', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-0000000d0702', '+919000000702', 'Riya Sen', null, null),
  ('00000000-0000-4000-8000-0000000d0703', '+919000000703', 'Meher Lal', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-0000000d0704', '+919000000704', 'Anika Rao', 'Owner', 'super_admin'),
  ('00000000-0000-4000-8000-0000000d0750', '+919000000750', 'Vikram Bedi', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-0000000d0751', '+919000000751', 'Sara Gill', null, null),
  ('00000000-0000-4000-8000-0000000d0752', '+919000000752', 'Neha Bhalla', null, null),
  ('00000000-0000-4000-8000-0000000d0753', '+919000000753', 'Ira Menon', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-0000000d0754', '+919000000754', 'Rhea Kapoor', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-0000000d0755', '+919000000755', 'Tara Malhotra', null, null),
  ('00000000-0000-4000-8000-0000000d0756', '+919000000756', 'Dev Khanna', null, null),
  ('00000000-0000-4000-8000-0000000d0757', '+919000000757', 'Nisha Bhatt', 'Duty manager', 'super_admin'),
  ('00000000-0000-4000-8000-0000000d0759', '+919000000759', 'Arjun Batra', 'Owner', 'super_admin'),
  ('00000000-0000-4000-8000-0000000d0760', '+919000000760', 'Leela Varma', 'Owner', 'super_admin'),
  ('00000000-0000-4000-8000-0000000d0780', '+919000000780', 'Kiran Joshi', 'Duty manager', 'super_admin');

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from lane_d_person p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from lane_d_person p
on conflict (provider_id, provider) do nothing;

insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select v.venue_id, p.id, p.full_name, p.job_title, p.role, p.phone
from lane_d_person p
cross join (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
where p.role is not null
on conflict (venue_id, user_id) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from lane_d_person p
where p.role is null
on conflict (id) do nothing;

-- Riya's 20,000 points, once, to redeem in the Rewards flow.
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0702', 20000, 'Seed',
                             'seed:rewards-flow:0d0702');

-- The Tournament registration flow's Neha has passed the identity check and has ₹1,00,000 in her wallet, once,
-- to register and re-enter from the app (#118).
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0752', 'verified', 'digilocker', '1994-06-12', 'ABCPB7521N',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0752/selfie.jpg', now())
on conflict do nothing;
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'opening_balance', 'seed:tournament-flow:0d0752',
  jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                      and a.code = 'venue.opening_balance' and a.member_id is null), 'amount', '10000000'),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = '00000000-0000-4000-8000-0000000d0752'
                                      and a.code = 'member.cash'), 'amount', '-10000000')), null);

-- The Tournament with re-entry and bounty flow's Tara and Dev have passed the identity check and have ₹1,00,000
-- each in their wallets, once, to register, re-enter and be paid (#149, design flow 18).
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0755', 'verified', 'digilocker', '1992-02-18', 'ABCPM7551Q',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0755/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0756', 'verified', 'digilocker', '1989-08-03', 'ABCPK7561R',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0756/selfie.jpg', now())
on conflict do nothing;
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'opening_balance', 'seed:tournament-flow:' || right(m.id::text, 6),
  jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                      and a.code = 'venue.opening_balance' and a.member_id is null), 'amount', '10000000'),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.cash'), 'amount', '-10000000')),
  null)
from public.member m where m.id in ('00000000-0000-4000-8000-0000000d0755', '00000000-0000-4000-8000-0000000d0756');

-- The practice member the Member erasure flow erases on request (#424): an identity check and 500 points to
-- forfeit, once. Practice records never sign in.
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000d0758', '00000000-0000-4000-8000-000000000002', 'Neel Kapur', '+919000000758')
on conflict (id) do nothing;
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000d0758', 'verified', 'digilocker', '1991-07-14', 'ABCPK7581S',
   '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-0000000d0758/selfie.jpg', now())
on conflict do nothing;
select private.credit_points('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000d0758', 500, 'Seed',
                             'seed:member-erasure-flow:0d0758');

-- The practice member whose number the Phone change flow changes (#502). Practice records never sign in.
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000d0781', '00000000-0000-4000-8000-000000000002', 'Omar Sheikh', '+919000000781')
on conflict (id) do nothing;
