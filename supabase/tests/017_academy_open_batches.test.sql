-- What the player app reads for RIVR Academy (#8): the batches a member can book (open, not started,
-- seats left and the fee, behind the tier), the member's own seats (never another member's, nor a
-- company's), and the UTR the cage turned down. 101 Vikram and 104 Sana (staff), 201 Arjun, 202 Kabir
-- (members of the club), 301 Asha (practice venue).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.academy_batch (id, venue_id, name, starts_on, ends_on, seats, is_open) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'Open', current_date + 5, current_date + 6, 3, true),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'Closed', current_date + 5, current_date + 6, 3, false),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000000001', 'Started', current_date - 1, current_date + 1, 3, true),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-000000000002', 'Practice', current_date + 5, current_date + 6, 3, true);
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, company_name, seats, amount, request_id) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000b1',
   '00000000-0000-4000-8000-000000000202', 'individual', null, 1, 200000, null),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000b3',
   '00000000-0000-4000-8000-000000000202', 'individual', null, 1, 200000, null),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000b1',
   '00000000-0000-4000-8000-000000000202', 'corporate', 'Acme Pvt Ltd', 1, 150000, '00000000-0000-4000-8000-0000000000c1');
-- The cashier is also a member of the club: one login, both records.
insert into public.member (venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', 'Sana Qureshi', '+919000000104');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select results_eq(
  $$ select name, seats_left, fee from public.academy_open_batches() where name in ('Open', 'Closed', 'Started', 'Practice') $$,
  $$ values ('Open'::text, 1, 200000::bigint) $$,
  'a member sees their venue''s open batches that have not started, with the seats others took counted and the fee');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000301", "role": "authenticated"}';
select results_eq(
  $$ select name from public.academy_open_batches() where name in ('Open', 'Closed', 'Started', 'Practice') $$, $$ values ('Practice'::text) $$,
  'a member of the practice venue sees only its batches');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select is_empty($$ select * from public.academy_open_batches() $$, 'staff with no member record see none');
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'academy.booking', false, 'Test');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is_empty($$ select * from public.academy_open_batches() $$, 'nor does a member whose tier lacks Academy booking');
reset role;
set local role anon;
select throws_ok($$ select public.academy_open_batches() $$, '42501', null, 'nor anyone signed out');
reset role;

-- A member's own seats, with their batch even once it has started; never a company's booking.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select results_eq($$ select batch_name, status, amount from public.my_academy_bookings() $$,
  $$ values ('Started'::text, 'awaiting_payment'::text, 200000::bigint), ('Open'::text, 'awaiting_payment'::text, 200000::bigint) $$,
  'a member sees their own seats, soonest first, also in a batch that has started, and not the company they are the contact for');
select is_empty($$ select * from public.academy_payment_details('00000000-0000-4000-8000-0000000000e3') $$,
  'nor is the contact shown a company''s bill to pay');
-- A cashier who is also a member reads the venue's bookings as staff, but only their own seats here.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select ok((select count(*) from public.academy_booking) >= 3, 'the cashier reads the venue''s bookings as staff');
select is_empty($$ select * from public.my_academy_bookings() $$, 'but has no seats of their own');
reset role;

-- A UTR the cage turned down stays on the booking until a UTR is given again.
update public.academy_booking set status = 'payment_claimed', utr = '412345678901', claimed_at = now()
where id = '00000000-0000-4000-8000-0000000000e1';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e1', '412345678901');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select results_eq($$ select status, utr, turned_down_utr from public.my_academy_bookings() where batch_name = 'Open' $$,
  $$ values ('awaiting_payment'::text, null::text, '412345678901'::text) $$, 'a UTR the cage turned down is kept, so the member is told');
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e1', '412345678902');
select results_eq($$ select status, utr, turned_down_utr from public.my_academy_bookings() where batch_name = 'Open' $$,
  $$ values ('payment_claimed'::text, '412345678902'::text, null::text) $$, 'and cleared when the member gives a UTR again');
reset role;

select * from finish();
rollback;
