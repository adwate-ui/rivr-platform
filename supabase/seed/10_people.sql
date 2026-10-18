-- Staff (one per role, two super admins and two cashiers for dual control) and members.
-- Everyone signs in by phone. Local stacks accept code 123456 for these numbers
-- (supabase/config.template.toml, [auth.sms.test_otp]); no password is stored anywhere.

create temporary table seed_person (
  id uuid primary key,
  phone text not null,
  full_name text not null
) on commit drop;

insert into seed_person (id, phone, full_name) values
  ('00000000-0000-4000-8000-000000000101', '+919000000101', 'Vikram Rao'),
  ('00000000-0000-4000-8000-000000000102', '+919000000102', 'Meera Iyer'),
  ('00000000-0000-4000-8000-000000000103', '+919000000103', 'Aditya Malhotra'),
  ('00000000-0000-4000-8000-000000000104', '+919000000104', 'Sana Qureshi'),
  ('00000000-0000-4000-8000-000000000105', '+919000000105', 'Dev Arora'),
  ('00000000-0000-4000-8000-000000000106', '+919000000106', 'Pema Lepcha'),
  ('00000000-0000-4000-8000-000000000107', '+919000000107', 'Ishita Bose'),
  ('00000000-0000-4000-8000-000000000108', '+919000000108', 'Karan Gill'),
  ('00000000-0000-4000-8000-000000000109', '+919000000109', 'Nikhil Bansal'),
  ('00000000-0000-4000-8000-000000000201', '+919000000201', 'Arjun Mehta'),
  ('00000000-0000-4000-8000-000000000202', '+919000000202', 'Kabir Sethi'),
  ('00000000-0000-4000-8000-000000000203', '+919000000203', 'Naina Kapoor'),
  ('00000000-0000-4000-8000-000000000204', '+919000000204', 'Rohan Bhatia'),
  ('00000000-0000-4000-8000-000000000209', '+919000000209', 'Tara Menon'),
  ('00000000-0000-4000-8000-000000000210', '+919000000210', 'Dev Malhotra'),
  ('00000000-0000-4000-8000-000000000301', '+919000000301', 'Asha Verma'),
  ('00000000-0000-4000-8000-000000000302', '+919000000302', 'Rajat Singh');

-- Supabase Auth users with confirmed phones. Auth stores the number without the plus sign.
insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from seed_person p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_person p
on conflict (provider_id, provider) do nothing;

-- Staff work at both venues: the practice venue is where they train.
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select v.venue_id, p.id, p.full_name, s.job_title, s.role::public.staff_role, p.phone
from (values
  ('00000000-0000-4000-8000-000000000101'::uuid, 'Owner', 'super_admin'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'General manager', 'super_admin'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-000000000104'::uuid, 'Cashier', 'cashier'),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'Cashier', 'cashier'),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'Dealer', 'dealer'),
  ('00000000-0000-4000-8000-000000000107'::uuid, 'Marketing manager', 'marketing'),
  ('00000000-0000-4000-8000-000000000108'::uuid, 'Host', 'host'),
  ('00000000-0000-4000-8000-000000000109'::uuid, 'Investor', 'owner_view')
) as s (person_id, job_title, role)
join seed_person p on p.id = s.person_id
cross join (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, user_id) do nothing;

-- Members of RIVR Gurugram. Arjun Mehta holds a black card qualifying at 100/200.
insert into public.member (id, venue_id, user_id, full_name, phone, tier_id, qualifying_small_blind, qualifying_big_blind)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = m.tier_name),
       m.small_blind, m.big_blind
from (values
  ('00000000-0000-4000-8000-000000000201'::uuid, 'Black card', 10000::bigint, 20000::bigint),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'Member', null, null),
  ('00000000-0000-4000-8000-000000000203'::uuid, 'Member', null, null),
  ('00000000-0000-4000-8000-000000000204'::uuid, 'Member', null, null),
  -- The Profile flow's own member: Auth sends one code a minute to a number, so each flow signs in as its own.
  ('00000000-0000-4000-8000-000000000209'::uuid, 'Member', null, null),
  -- The Academy booking flow's own member.
  ('00000000-0000-4000-8000-000000000210'::uuid, 'Member', null, null)
) as m (person_id, tier_name, small_blind, big_blind)
join seed_person p on p.id = m.person_id
on conflict (id) do nothing;

-- Dummy members of the practice venue, in its default tier.
insert into public.member (id, venue_id, user_id, full_name, phone)
select p.id, '00000000-0000-4000-8000-000000000002', p.id, p.full_name, p.phone
from seed_person p
where p.id in ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000302')
on conflict (id) do nothing;
