-- Seed people for lane A's Cage computer flow (#384), kept in their own file so that two lane A branches
-- in flight never edit the same list (same numbering as 11_people_a.sql: staff 150 to 169, members 250 to
-- 269). Local stacks accept code 123456 for these numbers (supabase/config.template.toml).

create temporary table seed_person_a_computers (
  id uuid primary key,
  phone text not null,
  full_name text not null
) on commit drop;

insert into seed_person_a_computers (id, phone, full_name) values
  -- The flow's own duty manager, who enrols the office's admin console and sets the club's networks.
  ('00000000-0000-4000-8000-000000000159', '+919000000159', 'Leela Rao'),
  -- Its second duty manager, who enrols the cage's computer, seats the member and issues chips there.
  ('00000000-0000-4000-8000-000000000160', '+919000000160', 'Omar Siddiqui'),
  -- The member bought in at the enrolled cage, who has finished the identity check.
  ('00000000-0000-4000-8000-000000000254', '+919000000254', 'Naveen Iyer');

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from seed_person_a_computers p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_person_a_computers p
on conflict (provider_id, provider) do nothing;

-- Staff work at both venues: the practice venue is where they train.
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select v.venue_id, p.id, p.full_name, 'Duty manager', 'super_admin', p.phone
from seed_person_a_computers p
cross join (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
where p.id in ('00000000-0000-4000-8000-000000000159', '00000000-0000-4000-8000-000000000160')
on conflict (venue_id, user_id) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone
from seed_person_a_computers p
where p.id = '00000000-0000-4000-8000-000000000254'
on conflict (id) do nothing;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000254', 'verified', 'digilocker', '1990-08-21', 'ABCPI2544K',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000254/selfie.jpg', now())
on conflict do nothing;
