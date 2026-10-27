-- The table-side menu (#123) for the seeded venues: the starter list 20261028391600_fnb_items.sql gives every venue that
-- existed when it ran, which a fresh database's seeded venues did not. A venue that has a menu already is left alone.
insert into public.fnb_item (venue_id, name, kind, position)
select v.id, m.name, m.kind::public.fnb_item_kind, m.position
from public.venue v
cross join (values ('Masala chai', 'soft_drink', 1), ('Fresh lime soda', 'soft_drink', 2), ('Mineral water', 'soft_drink', 3),
                   ('Club sandwich', 'food', 10), ('Paneer tikka', 'food', 11), ('French fries', 'food', 12),
                   ('Beer', 'alcohol', 20), ('Whisky', 'alcohol', 21)) as m (name, kind, position)
where not exists (select 1 from public.fnb_item i where i.venue_id = v.id);

-- The F&B flow's own people (#123): a general manager (a super admin, who runs F&B and sets the dealer's PIN for the
-- flow's tablet), who seats the member at Table 3 in the flow, and the member, 30 by his KYC. Each signs in with the
-- test code.
create temporary table seed_person_fnb (id uuid, phone text, full_name text);
insert into seed_person_fnb values
  ('00000000-0000-4000-8000-000000000615', '+919000000615', 'Meera Iyer'),
  ('00000000-0000-4000-8000-000000000288', '+919000000288', 'Ishan Mehta');

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from seed_person_fnb p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_person_fnb p
on conflict (provider_id, provider) do nothing;

insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select '00000000-0000-4000-8000-000000000001', p.id, p.full_name, 'General manager', 'super_admin', p.phone
from seed_person_fnb p where p.id = '00000000-0000-4000-8000-000000000615'
on conflict (venue_id, user_id) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from seed_person_fnb p where p.id = '00000000-0000-4000-8000-000000000288'
on conflict (id) do nothing;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000288', 'verified', 'digilocker', '1996-03-14', 'ABCPM2881F',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000288/selfie.jpg', now())
on conflict do nothing;

