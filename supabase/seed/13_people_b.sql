-- Builder B's seed people (staff 0180 to 0189, members 0280 to 0289). Self-contained, after
-- 10_people.sql; every statement is idempotent. Those who sign in take code 123456 locally
-- (supabase/config.template.toml, [auth.sms.test_otp]).

-- The Publish a promotion flow's own marketing manager, at both venues (#84, flow 7).
create temporary table lane_b_person (
  id uuid primary key,
  phone text not null,
  full_name text not null,
  job_title text not null,
  role public.staff_role not null
) on commit drop;

insert into lane_b_person (id, phone, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000180', '+919000000180', 'Tara Bhalla', 'Marketing manager', 'marketing');

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from lane_b_person p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from lane_b_person p
on conflict (provider_id, provider) do nothing;

insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select v.venue_id, p.id, p.full_name, p.job_title, p.role, p.phone
from lane_b_person p
cross join (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, user_id) do nothing;
