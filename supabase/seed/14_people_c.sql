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

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from seed_person_c p
where p.id = '00000000-0000-4000-8000-000000000290'
on conflict (id) do nothing;

