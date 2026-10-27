-- Builder B's seed people (staff 0180 to 0189, members 0280 to 0289). Self-contained, after
-- 10_people.sql; every statement is idempotent. Those who sign in take code 123456 locally
-- (supabase/config.template.toml, [auth.sms.test_otp]).

-- The Publish a promotion flow's own floor manager, at both venues, who builds and publishes the
-- promotion and pairs the TV (#84, #86, flow 7), and its own member, who reads it on Home. The Buy-in
-- with the Tuesday bonus flow's own duty manager, who seats its member and issues her chips (#88, flow 3),
-- and that member.
create temporary table lane_b_person (
  id uuid primary key,
  phone text not null,
  full_name text not null,
  -- Staff only: a member has none.
  job_title text,
  role public.staff_role
) on commit drop;

insert into lane_b_person (id, phone, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000180', '+919000000180', 'Tara Bhalla', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-000000000181', '+919000000181', 'Dev Arora', 'Duty manager', 'super_admin'),
  ('00000000-0000-4000-8000-000000000280', '+919000000280', 'Rhea Sood', null, null),
  ('00000000-0000-4000-8000-000000000281', '+919000000281', 'Kiran Joshi', null, null),
  -- The Dealers flow's own floor manager (#124).
  ('00000000-0000-4000-8000-000000000770', '+919000000770', 'Sameer Kohli', 'Floor manager', 'admin');

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
where p.role is not null
on conflict (venue_id, user_id) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from lane_b_person p
where p.role is null
on conflict (id) do nothing;

-- Kiran Joshi has finished the identity check and holds ₹1,00,000 of wallet cash, for six ₹10,000
-- buy-ins (#88).
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000281', 'verified', 'digilocker', '1994-02-11', 'ABCPJ2811K',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000281/selfie.jpg', now())
on conflict do nothing;

select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'opening_balance', 'seed:kiran:cash',
  jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                       and a.code = 'venue.opening_balance' and a.member_id is null), 'amount', '10000000'),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = '00000000-0000-4000-8000-000000000281'
                                       and a.code = 'member.cash'), 'amount', '-10000000')), null);
