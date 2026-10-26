-- Lane D builder's seed people (members 0000…0270 to 0299, staff 0170 to 0199). Self-contained, after
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
create temporary table lane_d_person (
  id uuid primary key,
  phone text not null,
  full_name text not null,
  job_title text not null,
  role public.staff_role not null
) on commit drop;

insert into lane_d_person (id, phone, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000175', '+919000000175', 'Gautam Sood', 'Duty manager', 'super_admin'),
  ('00000000-0000-4000-8000-000000000176', '+919000000176', 'Priya Nath', 'Duty manager', 'super_admin'),
  ('00000000-0000-4000-8000-000000000178', '+919000000700', 'Tanya Rao', 'Marketing manager', 'marketing'),
  ('00000000-0000-4000-8000-000000000179', '+919000000701', 'Kabir Anand', 'Floor manager', 'admin');

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
on conflict (venue_id, user_id) do nothing;
