-- A turned-down Academy UTR (#222). 202 Kabir, 210 Dev and 209 Tara (members of the club), 104 Sana
-- and 105 Dev Arora (cashiers). Every time is relative to now, so the test never expires.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.academy_batch (id, venue_id, name, starts_on, ends_on, seats, is_open) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000001', 'Turn downs', current_date + 5, current_date + 6, 5, true);
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, seats, amount, created_at) values
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000202', 'individual', 1, 200000, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000210', 'individual', 1, 200000, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000209', 'individual', 1, 200000, now() - interval '49 hours');

-- 1. Sana turns down Kabir's UTR, Dev gives the same UTR on his own booking, and Sana may not confirm it.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e2', '412345678921');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e2', '412345678921');
select results_eq(
  $$ select k.status, r.utr, s.full_name from public.academy_booking k
     join public.academy_utr_rejection r on r.booking_id = k.id join public.staff s on s.id = r.rejected_by_staff_id
     where k.id = '00000000-0000-4000-8000-0000000000e2' $$,
  $$ values ('awaiting_payment'::text, '412345678921'::text, 'Sana Qureshi'::text) $$,
  'a turn-down within the hold puts the seat back to unpaid, and is kept with who made it');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000210", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e3', '412345678921');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select throws_ok($$ select public.confirm_academy_payment('00000000-0000-4000-8000-0000000000e3', '412345678921') $$,
  '42501', null, 'a cashier never confirms a UTR they turned down on another booking');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000105", "role": "authenticated"}';
select isnt(public.confirm_academy_payment('00000000-0000-4000-8000-0000000000e3', '412345678921'), null,
  'another cashier, who looks for it in the bank, may');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select is_empty($$ select * from public.academy_utr_rejection $$, 'members never see turn-downs');
reset role;

-- 2. Tara's seat is past its hold: a turned-down UTR gives the seat up, and she sees why.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e4', '412345678922');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e4', '412345678922');
select results_eq($$ select count(*)::integer from public.academy_utr_rejection $$, $$ values (2) $$,
  'the cage sees every turn-down at its venue');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select results_eq($$ select status, turned_down_utr, hold_until from public.my_academy_bookings() where batch_name = 'Turn downs' $$,
  $$ values ('cancelled'::text, '412345678922'::text, null::timestamptz) $$,
  'a seat past its hold is cancelled when its UTR is turned down, and the member sees which UTR');
select throws_ok($$ select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e4', '412345678923') $$,
  '42501', null, 'so no further UTR keeps it');
select isnt(public.book_academy('00000000-0000-4000-8000-0000000000e1'), null, 'the member may book the batch again while seats are left');
select results_eq($$ select status from public.my_academy_bookings() where batch_name = 'Turn downs' order by status $$,
  $$ values ('awaiting_payment'::text), ('cancelled'::text) $$, 'and sees the new seat beside the cancelled one');
reset role;

-- A company's booking, whose UTR only staff record, goes back to unpaid however old it is.
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, company_name, seats, amount, request_id,
                                    status, utr, claimed_at, created_at) values
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000203', 'corporate', 'Acme', 2, 400000, gen_random_uuid(),
   'payment_claimed', '412345678924', now(), now() - interval '49 hours');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e5', '412345678924');
reset role;
select is((select status from public.academy_booking where id = '00000000-0000-4000-8000-0000000000e5'), 'awaiting_payment',
  'a company''s booking is never cancelled by a turn-down');

select * from finish();
rollback;
