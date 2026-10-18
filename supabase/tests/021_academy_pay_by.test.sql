-- When an unpaid Academy seat stops being held (#247): 48 hours after booking, in one place for the
-- seat count and for the pay-by time the member sees. 202 Kabir and 210 Dev (members of the club).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(private.academy_seat_hold(), interval '48 hours', 'an unpaid seat is held for 48 hours');

insert into public.academy_batch (id, venue_id, name, starts_on, ends_on, seats, is_open) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001', 'Pay by', current_date + 5, current_date + 6, 2, true);
insert into public.academy_booking (id, venue_id, is_practice, batch_id, member_id, kind, seats, amount, created_at) values
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000d1',
   '00000000-0000-4000-8000-000000000202', 'individual', 1, 200000, '2026-10-18 10:00:00+00'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-0000000000d1',
   '00000000-0000-4000-8000-000000000210', 'individual', 1, 200000, now() - interval '49 hours');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select results_eq($$ select hold_until from public.my_academy_bookings() where batch_name = 'Pay by' $$,
  $$ values ('2026-10-20 10:00:00+00'::timestamptz) $$, 'an unpaid seat says when it stops being held: 48 hours after booking');
select results_eq($$ select seats_left from public.academy_open_batches() where name = 'Pay by' $$, $$ values (1) $$,
  'a seat whose hold has lapsed is free for another member, a seat still held is not');
select public.claim_academy_payment('00000000-0000-4000-8000-0000000000d2', '412345678911');
select results_eq($$ select hold_until from public.my_academy_bookings() where batch_name = 'Pay by' $$,
  $$ values (null::timestamptz) $$, 'once a UTR is given, there is nothing to pay by');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000210", "role": "authenticated"}';
select ok((select hold_until < now() from public.my_academy_bookings() where batch_name = 'Pay by'),
  'a member whose hold has lapsed is told it has, and can still pay');
reset role;

select * from finish();
rollback;
