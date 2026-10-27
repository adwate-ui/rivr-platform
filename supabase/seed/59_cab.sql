-- The Cab flow's own members (#140): Kabir Anand, with four visits closed this month, so he sees the cab, and Tara
-- Singh, with three, so she does not. Each visit lasted two hours, which counts toward the month. Each signs in with the
-- test code.
create temporary table seed_person_cab (id uuid, phone text, full_name text, visits integer);
insert into seed_person_cab values
  ('00000000-0000-4000-8000-000000000620', '+919000000620', 'Kabir Anand', 4),
  ('00000000-0000-4000-8000-000000000621', '+919000000621', 'Tara Singh', 3);

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from seed_person_cab p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_person_cab p
on conflict (provider_id, provider) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from seed_person_cab p
on conflict (id) do nothing;

-- Visits this month: two hours each, a day apart, ending today in IST at the latest.
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', p.id, closed - interval '2 hours', closed, 'door'
from seed_person_cab p
cross join lateral generate_series(1, p.visits) n
cross join lateral (select greatest(date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' + interval '3 hours',
                                    now() - (n || ' hours')::interval) as closed) c;
