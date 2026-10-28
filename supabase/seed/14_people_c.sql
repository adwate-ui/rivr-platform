-- Seed people for the flows of the builder in worktree A on lane C and D tasks, kept apart from
-- 10_people.sql so that builders working in parallel never edit the same list (staff 0000…0190 to 0199,
-- members 0000…0290 to 0299). Same pattern as 11_people_a.sql; local stacks accept code 123456 for these
-- numbers (supabase/config.template.toml).

create temporary table seed_person_c (
  id uuid primary key,
  phone text not null,
  full_name text not null
) on commit drop;

insert into seed_person_c (id, phone, full_name) values
  -- The Membership card flow's own front desk (#71).
  ('00000000-0000-4000-8000-000000000190', '+919000000190', 'Farhan Ali'),
  -- The Door kiosk flow's own floor manager, who adds the kiosk and resolves the feedback (decisions 0164, 0165).
  ('00000000-0000-4000-8000-000000000191', '+919000000191', 'Nisha Arora'),
  -- The Credit and accounts flow's own duty manager, who takes repayments and asks for an expense, and the
  -- admin who approves it (#92, #94, #95; decisions 0167 and 0168).
  ('00000000-0000-4000-8000-000000000192', '+919000000192', 'Karan Ahuja'),
  ('00000000-0000-4000-8000-000000000193', '+919000000193', 'Meher Gill'),
  -- The Credit and accounts flow's duty manager for its repayments, with Devansh Malik, the member who
  -- owes them: identity checked and in three times this month, so he can be given credit (#92).
  ('00000000-0000-4000-8000-000000000194', '+919000000194', 'Ira Sethi'),
  -- The TDS and register flow's super admins: one takes the TDS extract, one keeps the register (#93, #97).
  ('00000000-0000-4000-8000-000000000195', '+919000000195', 'Simran Gill'),
  ('00000000-0000-4000-8000-000000000196', '+919000000196', 'Rehan Kapur'),
  -- The Tally flow's own admin, who maps the accounts and takes a day's vouchers (#96).
  ('00000000-0000-4000-8000-000000000197', '+919000000197', 'Pooja Bhatia'),
  -- The Reports flow's own owner, who reads tonight's rake and the monthly MIS (#99).
  ('00000000-0000-4000-8000-000000000198', '+919000000198', 'Arjun Mehra'),
  -- The Statements flow's own super admin, who opens a partner's monthly statement (#98).
  ('00000000-0000-4000-8000-000000000199', '+919000000199', 'Kiara Sethi'),
  -- The Export flow's own admin, who exports members filtered by tier (#102; additions flow 20).
  ('00000000-0000-4000-8000-000000000610', '+919000000610', 'Tara Menon'),
  -- The owner dashboard flow's own owner, who reads the dashboard on a phone (#101).
  ('00000000-0000-4000-8000-000000000611', '+919000000611', 'Vikram Oberoi'),
  -- Cashfree's sandbox test member (#474): the name its test PAN ABCPV1234D answers to, born 1990-01-01.
  -- On staging, sign in and check with the sandbox's values (docs/runbooks/ci-and-release.md, step 8).
  ('00000000-0000-4000-8000-000000000612', '+919000000612', 'John Doe'),
  ('00000000-0000-4000-8000-000000000296', '+919000000296', 'Devansh Malik'),
  -- The Sessions flow's own duty manager, who seats Rhea Kaul and cashes her out, and Rhea, identity checked, who
  -- then reads the session in her history (#127).
  ('00000000-0000-4000-8000-000000000613', '+919000000613', 'Sahil Arora'),
  -- The Tournament events flow's own floor manager, who makes satellites and flights (#519, #524).
  ('00000000-0000-4000-8000-000000000623', '+919000000623', 'Neel Desai'),
  -- The Graduation flow's own super admin, who marks a student present and graduates her (#128).
  ('00000000-0000-4000-8000-000000000624', '+919000000624', 'Anika Rao'),
  -- And its own cashier, who confirms the student's UTR in the bank.
  ('00000000-0000-4000-8000-000000000625', '+919000000625', 'Omar Siddiqui'),
  -- The Events flow's own marketing manager, who adds a pro night, and member, who books it (#143); the Creators flow's
  -- own marketing manager, who adds a creator (#163).
  ('00000000-0000-4000-8000-000000000626', '+919000000626', 'Leela Nair'),
  ('00000000-0000-4000-8000-000000000627', '+919000000627', 'Aman Bedi'),
  ('00000000-0000-4000-8000-000000000628', '+919000000628', 'Rohan Das'),
  -- The Learn flow's own member, who drills a licensed title, and super admin, who uploads it (#133, #136).
  ('00000000-0000-4000-8000-000000000630', '+919000000630', 'Mira Shah'),
  ('00000000-0000-4000-8000-000000000631', '+919000000631', 'Dev Malhotra'),
  -- The Glaza flow's own finance manager, who imports Glaza's CSV (#109).
  ('00000000-0000-4000-8000-000000000632', '+919000000632', 'Neha Gill'),
  -- The Spin wheel flow's own duty manager, who spins the wheel, and member, whose spin the seed gives (#150).
  ('00000000-0000-4000-8000-000000000633', '+919000000633', 'Kunal Sethi'),
  ('00000000-0000-4000-8000-000000000634', '+919000000634', 'Tara Bose'),
  -- The Social wall flow's own marketing manager, who approves a tagged post (#157).
  ('00000000-0000-4000-8000-000000000635', '+919000000635', 'Ira Sethi'),
  -- The Publishing flow's own marketing manager, who publishes a post (#154).
  ('00000000-0000-4000-8000-000000000636', '+919000000636', 'Arjun Kohli'),
  -- The Website edit flow's own marketing manager, who edits, publishes and rolls back a page (#129).
  ('00000000-0000-4000-8000-000000000637', '+919000000637', 'Sara Iqbal'),
  -- The Push flow's own member, who turns notifications on for her phone (#139).
  ('00000000-0000-4000-8000-000000000638', '+919000000638', 'Leela Menon'),
  -- The Winner card flow's own member, whose card the seed draws, and marketing manager, who downloads it (#155).
  ('00000000-0000-4000-8000-000000000639', '+919000000639', 'Kavya Rao'),
  ('00000000-0000-4000-8000-000000000640', '+919000000640', 'Nikhil Batra'),
  -- The Academy lessons flow's own member, who takes a lesson and its quiz (#134).
  ('00000000-0000-4000-8000-000000000641', '+919000000641', 'Vivaan Rao'),
  -- The Host queue flow's own lapsed regular, and host, who calls her (#165).
  ('00000000-0000-4000-8000-000000000642', '+919000000642', 'Ritika Bhalla'),
  ('00000000-0000-4000-8000-000000000643', '+919000000643', 'Sameer Joshi'),
  -- The Learn sources flow's own super admin, who uploads a licensed encoding (#131).
  ('00000000-0000-4000-8000-000000000629', '+919000000629', 'Isha Kapoor'),
  ('00000000-0000-4000-8000-000000000297', '+919000000297', 'Rhea Kaul'),
  -- The Share card flow's own member, who shares her referral card (#153).
  ('00000000-0000-4000-8000-000000000299', '+919000000299', 'Zoya Merchant'),
  -- The Membership card flow's own member, whose card the door scans (#71).
  ('00000000-0000-4000-8000-000000000290', '+919000000290', 'Kavya Rao');

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from seed_person_c p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_person_c p
on conflict (provider_id, provider) do nothing;

insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select '00000000-0000-4000-8000-000000000001', p.id, p.full_name, 'Front desk', 'host', p.phone
from seed_person_c p
where p.id = '00000000-0000-4000-8000-000000000190'
on conflict (venue_id, user_id) do nothing;

insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select '00000000-0000-4000-8000-000000000001', p.id, p.full_name, 'Floor manager', 'admin', p.phone
from seed_person_c p
where p.id in ('00000000-0000-4000-8000-000000000191', '00000000-0000-4000-8000-000000000643')
on conflict (venue_id, user_id) do nothing;

insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select '00000000-0000-4000-8000-000000000001', p.id, p.full_name, j.job_title, j.role::public.staff_role, p.phone
from seed_person_c p
join (values ('00000000-0000-4000-8000-000000000192'::uuid, 'Duty manager', 'super_admin'),
             ('00000000-0000-4000-8000-000000000193'::uuid, 'General manager', 'admin'),
             ('00000000-0000-4000-8000-000000000194'::uuid, 'Duty manager', 'super_admin'),
             ('00000000-0000-4000-8000-000000000195'::uuid, 'Finance manager', 'super_admin'),
             ('00000000-0000-4000-8000-000000000196'::uuid, 'Director', 'super_admin'),
             ('00000000-0000-4000-8000-000000000197'::uuid, 'Accounts manager', 'admin'),
             ('00000000-0000-4000-8000-000000000198'::uuid, 'Owner', 'owner_view'),
             ('00000000-0000-4000-8000-000000000199'::uuid, 'Managing partner', 'super_admin'),
             ('00000000-0000-4000-8000-000000000610'::uuid, 'Operations manager', 'admin'),
             ('00000000-0000-4000-8000-000000000611'::uuid, 'Owner', 'owner_view'),
             ('00000000-0000-4000-8000-000000000613'::uuid, 'Duty manager', 'super_admin'),
             ('00000000-0000-4000-8000-000000000623'::uuid, 'Floor manager', 'admin'),
             ('00000000-0000-4000-8000-000000000624'::uuid, 'Academy manager', 'super_admin'),
             ('00000000-0000-4000-8000-000000000625'::uuid, 'Cashier', 'cashier'),
             ('00000000-0000-4000-8000-000000000626'::uuid, 'Marketing manager', 'marketing'),
             ('00000000-0000-4000-8000-000000000628'::uuid, 'Marketing manager', 'marketing'),
             ('00000000-0000-4000-8000-000000000635'::uuid, 'Marketing manager', 'marketing'),
             ('00000000-0000-4000-8000-000000000636'::uuid, 'Marketing manager', 'marketing'),
             ('00000000-0000-4000-8000-000000000637'::uuid, 'Marketing manager', 'marketing'),
             ('00000000-0000-4000-8000-000000000640'::uuid, 'Marketing manager', 'marketing'),
             ('00000000-0000-4000-8000-000000000629'::uuid, 'Learning lead', 'super_admin'),
             ('00000000-0000-4000-8000-000000000631'::uuid, 'Learning lead', 'super_admin'),
             ('00000000-0000-4000-8000-000000000632'::uuid, 'Finance manager', 'super_admin'),
             ('00000000-0000-4000-8000-000000000633'::uuid, 'Duty manager', 'super_admin')) as j (id, job_title, role) on j.id = p.id
on conflict (venue_id, user_id) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from seed_person_c p
where p.id in ('00000000-0000-4000-8000-000000000642', '00000000-0000-4000-8000-000000000641', '00000000-0000-4000-8000-000000000639', '00000000-0000-4000-8000-000000000638', '00000000-0000-4000-8000-000000000630', '00000000-0000-4000-8000-000000000634', '00000000-0000-4000-8000-000000000627', '00000000-0000-4000-8000-000000000290', '00000000-0000-4000-8000-000000000296', '00000000-0000-4000-8000-000000000612',
               '00000000-0000-4000-8000-000000000297', '00000000-0000-4000-8000-000000000299')
on conflict (id) do nothing;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000296', 'verified', 'digilocker', '1990-02-11', 'ABCPM2961D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000296/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000297', 'verified', 'digilocker', '1994-08-23', 'ABCPK2971R',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000297/selfie.jpg', now())
on conflict do nothing;

insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000296', now() - d.ago, now() - d.ago + interval '5 hours', 'door'
from (values (interval '3 days'), (interval '10 days'), (interval '17 days')) as d (ago)
where not exists (select 1 from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000296');

-- The Spin wheel flow's member has a spin waiting, from Spin the wheel (#150).
insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, trigger, effect, cost_paise, points, source_key, club_day)
select p.venue_id, p.id, r.id, '00000000-0000-4000-8000-000000000634', r.trigger, r.effect, 0, 0, 'seed:spin-wheel-flow', (now() at time zone 'Asia/Kolkata')::date
from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'spin_wheel'
on conflict do nothing;

-- The Social wall flow's posts waiting for moderation, as Instagram's pull would record them (#157).
insert into public.wall_post (venue_id, source_id, handle, caption, media_url, media_kind, permalink, posted_at) values
  ('00000000-0000-4000-8000-000000000001', 'seed-wall-1', 'zoya.plays', 'Final table at RIVR tonight', 'https://cdn.example/seed-wall-1.jpg', 'image',
   'https://www.instagram.com/p/seedwall1/', now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000001', 'seed-wall-2', 'kabir.s', 'Sunday at the club', 'https://cdn.example/seed-wall-2.jpg', 'image',
   'https://www.instagram.com/p/seedwall2/', now() - interval '1 hour')
on conflict do nothing;
