-- The high hand flows' own people (redesign RD-23 to RD-25; staff 0161 to 0165, members 0261 and 0262), at the club. After
-- 10_people.sql; every statement is idempotent. Each signs in with code 123456 locally (supabase/config.template.toml):
-- Auth sends one code a minute to a number, so no flow shares a number with another.
create temporary table high_hand_person (
  id uuid primary key,
  phone text not null,
  full_name text not null,
  -- Staff only: a member has none.
  job_title text,
  role public.staff_role
) on commit drop;

insert into high_hand_person (id, phone, full_name, job_title, role) values
  -- High hand promotion (e2e/flows/high-hand-promotion.spec.ts): Nisha builds it, Kabir approves it.
  ('00000000-0000-4000-8000-000000000161', '+919000000161', 'Nisha Rao', 'Promotions manager', 'admin'),
  ('00000000-0000-4000-8000-000000000162', '+919000000162', 'Kabir Anand', 'General manager', 'super_admin'),
  -- Log a high hand (high-hand-floor.spec.ts): Farid logs Devansh's hand on the Live floor, Leena reads it in Activity.
  ('00000000-0000-4000-8000-000000000163', '+919000000163', 'Farid Khan', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-000000000164', '+919000000164', 'Leena Dutt', 'General manager', 'super_admin'),
  ('00000000-0000-4000-8000-000000000261', '+919000000261', 'Devansh Malik', null, null),
  -- High hand payout (high-hand-payout.spec.ts): Om pays Ananya, who watches her app.
  ('00000000-0000-4000-8000-000000000165', '+919000000165', 'Om Bajaj', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-000000000262', '+919000000262', 'Ananya Sen', null, null);

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from high_hand_person p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from high_hand_person p
on conflict (provider_id, provider) do nothing;

insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.job_title, p.role, p.phone
from high_hand_person p
where p.role is not null
on conflict (venue_id, user_id) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from high_hand_person p
where p.role is null
on conflict (id) do nothing;

-- Both members have finished the identity check, so the floor can seat them.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', p.id, 'verified', 'digilocker', '1992-06-15', 'ABCPH' || right(p.id::text, 4) || 'H',
       '00000000-0000-4000-8000-000000000001/' || p.id || '/selfie.jpg', now()
from high_hand_person p
where p.role is null
on conflict do nothing;
