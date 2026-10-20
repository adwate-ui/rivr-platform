-- Seed people for lane A's flows, kept apart from 10_people.sql so that builders working in parallel never
-- edit the same list (staff 0000…0150 to 0169, members 0000…0250 to 0269). Same pattern as 10_people.sql;
-- local stacks accept code 123456 for these numbers (supabase/config.template.toml).

create temporary table seed_person_a (
  id uuid primary key,
  phone text not null,
  full_name text not null
) on commit drop;

insert into seed_person_a (id, phone, full_name) values
  -- The Tiers flow's own super admin, who takes Learn from the Member tier and gives it back to one member (#32, flow 21).
  ('00000000-0000-4000-8000-000000000152', '+919000000152', 'Rohini Das'),
  -- The Tiers flow's own members: one at Member, one with a black card (#32, flow 21).
  ('00000000-0000-4000-8000-000000000250', '+919000000250', 'Aarav Joshi'),
  ('00000000-0000-4000-8000-000000000251', '+919000000251', 'Kiara Shah');

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from seed_person_a p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_person_a p
on conflict (provider_id, provider) do nothing;

insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select v.venue_id, p.id, p.full_name, 'Duty manager', 'super_admin', p.phone
from seed_person_a p
cross join (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
where p.id = '00000000-0000-4000-8000-000000000152'
on conflict (venue_id, user_id) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = m.tier_name)
from (values
  ('00000000-0000-4000-8000-000000000250'::uuid, 'Member'),
  ('00000000-0000-4000-8000-000000000251'::uuid, 'Black card')
) as m (person_id, tier_name)
join seed_person_a p on p.id = m.person_id
on conflict (id) do nothing;
