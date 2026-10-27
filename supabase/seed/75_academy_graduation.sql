-- The Graduation flow's own student (#128): Ritu Malhotra, booked on a batch running this week with her UTR given, so
-- staff mark her present and graduate her. Written as the booking stands once she has given her UTR; the cage's check
-- of the payment is the Academy payments flow's. She signs in with the test code.
insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000622', 'authenticated', 'authenticated', '919000000622', now(),
  '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000622', '00000000-0000-4000-8000-000000000622',
        '{"sub": "00000000-0000-4000-8000-000000000622", "phone": "919000000622"}', 'phone', now(), now(), now())
on conflict (provider_id, provider) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select '00000000-0000-4000-8000-000000000622', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000622',
       'Ritu Malhotra', '+919000000622', t.id
from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member'
on conflict (id) do nothing;

with batch as (
  insert into public.academy_batch (id, venue_id, name, starts_on, ends_on, seats)
  values ('00000000-0000-4000-8000-0000000ac128', '00000000-0000-4000-8000-000000000001', 'Graduation flow batch',
          (now() at time zone 'Asia/Kolkata')::date - 2, (now() at time zone 'Asia/Kolkata')::date + 2, 10)
  on conflict (id) do nothing
  returning id, venue_id
)
insert into public.academy_booking (venue_id, is_practice, batch_id, member_id, kind, seats, amount, status, utr, claimed_at)
select b.venue_id, false, b.id, '00000000-0000-4000-8000-000000000622', 'individual', 1, 200000, 'payment_claimed', '600000000622', now()
from batch b;
