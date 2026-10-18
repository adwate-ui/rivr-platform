-- A turned-down Academy UTR (#222). 202 Kabir, 210 Dev, 209 Tara, 204 Rohan and 201 Arjun (members of
-- the club), 104 Sana and 105 Dev Arora (cashiers), 103 Aditya (admin, who cancels bookings). Every
-- time is relative to now, so the test never expires.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Another venue, with its own cashier, to prove its staff see none of this venue's turn-downs.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000f2', 'authenticated', 'authenticated', '919000000997', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2', 'Elsewhere Cashier', 'Cashier', 'cashier');

insert into public.academy_batch (id, venue_id, name, starts_on, ends_on, seats, is_open) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000001', 'Turn downs', current_date + 5, current_date + 6, 5, true);
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, seats, amount, created_at) values
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000202', 'individual', 1, 200000, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000210', 'individual', 1, 200000, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000209', 'individual', 1, 200000, now() - interval '49 hours');

-- 1. Sana turns down Kabir's UTR and Dev gives the same UTR on his own booking: neither Sana nor
--    another cashier confirms it; a manager checks whose money it is.
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
select throws_ok($$ select public.confirm_academy_payment('00000000-0000-4000-8000-0000000000e3', '412345678921') $$,
  '42501', null, 'nor does another cashier: it was turned down on another member''s booking');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select isnt(public.confirm_academy_payment('00000000-0000-4000-8000-0000000000e3', '412345678921'), null,
  'a manager who works the cage may, having checked whose payment it is');
-- A UTR turned down and given again on the same booking: the cashier who looks for it again may confirm it.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e2', '412345678925');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e2', '412345678925');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e2', '412345678925');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select isnt(public.confirm_academy_payment('00000000-0000-4000-8000-0000000000e2', '412345678925'), null,
  'a cashier confirms a UTR they turned down once it is given again for the same booking');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select is_empty($$ select * from public.academy_utr_rejection $$, 'members never see turn-downs');
reset role;

-- 2. Tara's seat is past its hold: a turned-down UTR gives the seat up, and she sees why.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e4', '412345678922');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e4', '412345678922');
select results_eq($$ select count(*)::integer from public.academy_utr_rejection $$, $$ values (3) $$,
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

-- A company's booking whose UTR staff recorded after the hold is cancelled the same way.
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, company_name, seats, amount, request_id,
                                    status, utr, claimed_at, created_at) values
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000203', 'corporate', 'Acme', 2, 400000, gen_random_uuid(),
   'payment_claimed', '412345678924', now(), now() - interval '49 hours');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e5', '412345678924');
reset role;
select is((select status from public.academy_booking where id = '00000000-0000-4000-8000-0000000000e5'), 'cancelled',
  'a company''s booking whose UTR was recorded after the hold is cancelled when it is turned down');

-- 3. Naina gave her UTR within the hold; the cage turns it down after it. Her seat goes back to unpaid,
--    as before. A UTR she gives now is late: it stays until the cage checks it, and a turn-down cancels.
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, seats, amount, status, utr, claimed_at, created_at) values
  ('00000000-0000-4000-8000-0000000000e8', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000203', 'individual', 1, 200000, 'payment_claimed', '412345678927',
   now() - interval '48 hours', now() - interval '49 hours');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e8', '412345678927');
reset role;
select is((select status from public.academy_booking where id = '00000000-0000-4000-8000-0000000000e8'), 'awaiting_payment',
  'a UTR given within the hold and turned down after it puts the seat back to unpaid');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e8', '412345678928');
select throws_ok($$ select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e8', '412345678929') $$,
  'RVLCK', null, 'a UTR given after the hold cannot be changed before the cage checks it');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e8', '412345678928');
reset role;
select is((select status from public.academy_booking where id = '00000000-0000-4000-8000-0000000000e8'), 'cancelled',
  'and turned down, it cancels the seat');

-- A company's turned-down UTR given on its contact's own seat: the contact is not the payer, so only a
-- manager confirms it.
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, company_name, seats, amount, request_id,
                                    status, utr, claimed_at, created_at) values
  ('00000000-0000-4000-8000-0000000000ea', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000203', 'corporate', 'Acme', 2, 400000, gen_random_uuid(),
   'payment_claimed', '412345678930', now(), now() - interval '1 hour');
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, seats, amount) values
  ('00000000-0000-4000-8000-0000000000e9', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000203', 'individual', 1, 200000);
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000ea', '412345678930');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e9', '412345678930');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000105", "role": "authenticated"}';
select throws_ok($$ select public.confirm_academy_payment('00000000-0000-4000-8000-0000000000e9', '412345678930') $$,
  '42501', null, 'a company''s turned-down UTR on its contact''s own seat is not confirmed by a cashier');
reset role;

-- A turn-down is never changed or removed.
select throws_ok($$ update public.academy_utr_rejection set utr = '412345678999' $$, '42501', null, 'a turn-down is never changed');
select throws_ok($$ delete from public.academy_utr_rejection $$, '42501', null, 'nor removed');
select throws_ok($$ truncate public.academy_utr_rejection $$, '42501', null, 'nor emptied');

-- A seat staff cancel stays out of the member's list, whether or not a UTR was turned down on it first.
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, seats, amount, created_at) values
  ('00000000-0000-4000-8000-0000000000e6', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000204', 'individual', 1, 200000, now() - interval '1 hour');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000204", "role": "authenticated"}';
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000e6', '412345678926');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select public.reject_academy_payment('00000000-0000-4000-8000-0000000000e6', '412345678926');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select public.cancel_academy_booking('00000000-0000-4000-8000-0000000000e6');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000204", "role": "authenticated"}';
select is_empty($$ select * from public.my_academy_bookings() where batch_name = 'Turn downs' $$,
  'a seat staff cancelled after a turn-down within the hold is not shown as the cage''s cancellation');
reset role;
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, seats, amount) values
  ('00000000-0000-4000-8000-0000000000e7', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-000000000201', 'individual', 1, 200000);
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select public.cancel_academy_booking('00000000-0000-4000-8000-0000000000e7');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is_empty($$ select * from public.my_academy_bookings() where batch_name = 'Turn downs' $$,
  'nor is a seat staff cancelled with no UTR ever given');
reset role;

-- Another venue's cashier sees none of this venue's turn-downs.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f2", "role": "authenticated"}';
select is_empty($$ select * from public.academy_utr_rejection $$, 'a cashier at another venue sees none of its turn-downs');
reset role;


select * from finish();
rollback;
