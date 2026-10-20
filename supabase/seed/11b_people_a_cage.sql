-- Seed people for lane A's Cage shift flow (#376), kept in their own file so that two lane A branches in
-- flight never edit the same list (11_people_a.sql has the rest; same numbering, staff 150 to 169,
-- members 250 to 269). Local stacks accept code 123456 for these numbers (supabase/config.template.toml).

create temporary table seed_person_a_cage (
  id uuid primary key,
  phone text not null,
  full_name text not null
) on commit drop;

insert into seed_person_a_cage (id, phone, full_name) values
  -- The Cage shift flow's own cashier, who is refused a buy-in with no shift open, opens one, and buys in.
  ('00000000-0000-4000-8000-000000000156', '+919000000156', 'Zubin Mistry'),
  -- Its own floor manager, who seats the member.
  ('00000000-0000-4000-8000-000000000157', '+919000000157', 'Gauri Sehgal'),
  -- The member that flow seats at the practice venue's Table 1, who has finished the identity check.
  ('00000000-0000-4000-8000-000000000252', '+919000000252', 'Ishita Bhalla');

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from seed_person_a_cage p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_person_a_cage p
on conflict (provider_id, provider) do nothing;

-- Staff work at both venues: the practice venue is where they train.
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select v.venue_id, p.id, p.full_name, s.job_title, s.role::public.staff_role, p.phone
from (values
  ('00000000-0000-4000-8000-000000000156'::uuid, 'Cashier', 'cashier'),
  ('00000000-0000-4000-8000-000000000157'::uuid, 'Floor manager', 'admin')
) as s (person_id, job_title, role)
join seed_person_a_cage p on p.id = s.person_id
cross join (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, user_id) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone)
select p.id, '00000000-0000-4000-8000-000000000002', p.id, p.full_name, p.phone
from seed_person_a_cage p
where p.id = '00000000-0000-4000-8000-000000000252'
on conflict (id) do nothing;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000252', 'verified', 'digilocker', '1993-04-17', 'ABCPB2522C',
   '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000252/selfie.jpg', now())
on conflict do nothing;
