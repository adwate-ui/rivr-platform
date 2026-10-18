-- The console's Academy batches (#8): Academy staff and the cage see a venue's batches, closed ones
-- too, with the seats taken as bookings hold them; only where they are active staff. 103 Aditya
-- (admin), 104 Sana (cashier), 106 Pema (dealer), 202 Kabir (member).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.academy_batch (id, venue_id, name, starts_on, ends_on, seats, is_open) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'Console club batch', current_date + 5, current_date + 6, 12, false),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000002', 'Console practice batch', current_date + 5, current_date + 6, 3, true);
-- A company's 10 heads booked three days ago and never paid: their hold has lapsed. Kabir's seat is claimed.
insert into public.academy_booking (venue_id, is_practice, batch_id, member_id, kind, company_name, seats, amount, request_id, created_at, status, utr) values
  ('00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000203',
   'corporate', 'Acme Pvt Ltd', 10, 1500000, '00000000-0000-4000-8000-0000000000c1', now() - interval '3 days', 'awaiting_payment', null),
  ('00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000202',
   'individual', null, 1, 200000, null, now(), 'payment_claimed', '412345678901');

-- Every role that reads bookings in the console also reads members, so a booking always has its name.
select is_empty($$
  select rp.role from public.role_permission rp
  where rp.permission in ('members.manage', 'cage.transact')
    and not exists (select 1 from public.role_permission r where r.role = rp.role and r.permission = 'members.read')
$$, 'every role that reads Academy bookings also reads members');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select results_eq(
  $$ select name, seats, is_open, seats_taken from public.staff_academy_batches('00000000-0000-4000-8000-000000000001') where name like 'Console%' $$,
  $$ values ('Console club batch'::text, 12, false, 1) $$,
  'an admin sees the club''s batches, closed ones too, with the seats taken as the database counts them: the claimed seat, not the lapsed hold');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select results_eq(
  $$ select name from public.staff_academy_batches('00000000-0000-4000-8000-000000000001') where name like 'Console%' $$,
  $$ values ('Console club batch'::text) $$, 'a cashier sees them, to know what a payment is for');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
select is_empty($$ select * from public.staff_academy_batches('00000000-0000-4000-8000-000000000001') $$, 'a dealer sees none');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select is_empty($$ select * from public.staff_academy_batches('00000000-0000-4000-8000-000000000001') $$, 'nor does a member');
reset role;

-- Where a cashier is no longer active staff, they see nothing of that venue's batches.
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select is_empty($$ select * from public.staff_academy_batches('00000000-0000-4000-8000-000000000002') $$,
  'a cashier sees no batches of a venue where they are not active staff');
reset role;
set local role anon;
select throws_ok($$ select public.staff_academy_batches('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor does anyone signed out');
reset role;

select * from finish();
rollback;
