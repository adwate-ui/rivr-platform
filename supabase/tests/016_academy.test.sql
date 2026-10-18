-- Academy (#8): the fee's one non-golden case (its golden cases are in 024); batches with dates and seats; a
-- member books at the individual fee and claims a UPI payment with its UTR; a cashier confirms the UTR
-- found in the bank, the ledger takes the money and academy.booked goes out, or turns down a UTR it
-- cannot find; staff book a company at the corporate fee per head and record its UTR. 101 super admin,
-- 103 Aditya (admin, members.manage), 104 Sana (cashier, cage.transact),
-- 106 Pema (dealer), 201 Arjun, 202 Kabir, 203 Naina, 204 Rohan (members), 301 Asha (practice venue).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Signs in as a user, for this transaction; reset role signs back out as the test itself.
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- Ids the steps below share, readable whoever is signed in.
create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
grant execute on function pg_temp.as_user(uuid), pg_temp.id(text) to authenticated;

-- The admin and the cashier are also members of the club: one login, both records.
insert into public.member (venue_id, user_id, full_name, phone) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'Aditya Malhotra', '+919000000103'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', 'Sana Qureshi', '+919000000104');

-- The fee's golden cases are proved in 024_golden_twins, from packages/testing/golden/academy.json itself.
select is(private.academy_fee('individual', 2, '{"individual_paise": 200000, "corporate_per_head_paise": 150000}'), null::bigint,
  'an individual booking is one seat');

-- Staff open batches; a member cannot.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
insert into ids values
  ('small', public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Level 1, small', current_date + 10, current_date + 12, 2)),
  ('large', public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Level 1, large', current_date + 20, current_date + 22, 10)),
  ('tiny', public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Level 1, tiny', current_date + 30, current_date + 31, 1));
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Mine', current_date, current_date, 5) $$,
  '42501', null, 'a member cannot open a batch');

-- A member books, sees what to pay, and gives the UTR.
insert into ids values ('arjun', public.book_academy(pg_temp.id('small')));
select is((select amount from public.academy_booking where id = pg_temp.id('arjun')), 200000::bigint,
  'a member books a seat at the individual fee, ₹2,000');
select is(public.book_academy(pg_temp.id('small')), pg_temp.id('arjun'), 'booking again gives the same booking');
select results_eq($$ select amount, upi_vpa from public.academy_payment_details(pg_temp.id('arjun')) $$,
  $$ values (200000::bigint, 'rivr.gurugram@icici'::text) $$, 'and is shown what to pay and the club''s UPI');
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('arjun'), '1234') $$, '22023', null, 'a UTR is 12 digits');
select lives_ok($$ select public.claim_academy_payment(pg_temp.id('arjun'), '412345678901') $$, 'the member gives the UTR of their payment');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('arjun'), '412345678901') $$, '42501', null,
  'a member cannot confirm their own payment');

-- Another member cannot touch it, and one UTR pays one booking.
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select is((select count(*)::int from public.academy_booking), 0, 'another member sees none of it');
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('arjun'), '999999999999') $$, '42501', null, 'nor claims a payment on it');
insert into ids values ('kabir', public.book_academy(pg_temp.id('small')));
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('kabir'), '412345678901') $$, 'RVUTR', null,
  'a UTR already given for another booking is refused, plainly');

-- The batch of two is full.
select pg_temp.as_user('00000000-0000-4000-8000-000000000203');
select throws_ok($$ select public.book_academy(pg_temp.id('small')) $$, 'RVFUL', null, 'a full batch takes no more bookings');

-- The cashier confirms the UTR found in the bank: paid, in the ledger, and academy.booked, once.
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('kabir'), '412345678901') $$, 'RVPAY', null,
  'a booking with no UTR given has nothing to confirm');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('arjun'), '499999999999') $$, 'RVUTM', null,
  'a UTR that is not the booking''s never confirms it, so a reference changed after the bank check pays nothing');
insert into ids values ('arjun_paid', public.confirm_academy_payment(pg_temp.id('arjun'), '412345678901'));
select is(public.confirm_academy_payment(pg_temp.id('arjun'), '412345678901'), pg_temp.id('arjun_paid'), 'confirming again changes nothing');
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select a.code, a.kind::text, e.amount from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
     where e.transaction_id = pg_temp.id('arjun_paid') order by e.amount desc $$,
  $$ values ('venue.bank'::text, 'asset'::text, 200000::bigint), ('venue.academy'::text, 'revenue'::text, -200000::bigint) $$,
  'the ledger takes the fee: bank in, Academy fees as revenue');
select results_eq($$ select status, confirmed_by_staff_id is not null from public.academy_booking where id = pg_temp.id('arjun') $$,
  $$ values ('paid'::text, true) $$, 'the booking is paid, by the cashier who confirmed it');
select results_eq($$ select payload ->> 'amount_paise', payload ->> 'kind' from public.outbox_event where event_type = 'academy.booked' $$,
  $$ values ('200000'::text, 'individual'::text) $$, 'academy.booked goes out, once');

-- A cashier never confirms their own booking.
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
insert into ids values ('sana', public.book_academy(pg_temp.id('large')));
select public.claim_academy_payment(pg_temp.id('sana'), '612345678901');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('sana'), '612345678901') $$, '42501', null,
  'a cashier who is also a member cannot confirm their own booking');

-- A company books its heads at the corporate fee, once per request, never for the staff member; staff
-- record the company's UTR when it pays.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
insert into ids values ('acme', public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000203', 'Acme Pvt Ltd', 3,
  '00000000-0000-4000-8000-0000000000c1'));
select results_eq($$ select amount, status from public.academy_booking where id = pg_temp.id('acme') $$,
  $$ values (450000::bigint, 'awaiting_payment'::text) $$, 'three heads at ₹1,500 each, waiting for the company to pay');
select is(public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000203', 'Acme Pvt Ltd', 3,
  '00000000-0000-4000-8000-0000000000c1'), pg_temp.id('acme'), 'a retried request books once');
select throws_ok($$ select public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000203', 'Acme Pvt Ltd', 4,
  '00000000-0000-4000-8000-0000000000c1') $$, '22023', null, 'a request id used for another booking is refused');
select throws_ok($$ select public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000203', 'Acme Pvt Ltd', 3,
  null) $$, '22023', null, 'a corporate booking needs its request id, so a retry never books twice');
select throws_ok($$ select public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000203', 'Acme Pvt Ltd', 0,
  '00000000-0000-4000-8000-0000000000c5') $$, '22023', null, 'and 1 to 100 heads');
select throws_ok($$ select public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000103', 'Mine Ltd', 1,
  '00000000-0000-4000-8000-0000000000c2') $$, '42501', null, 'staff cannot make themselves the contact of a corporate booking');
select lives_ok($$ select public.record_academy_payment(pg_temp.id('acme'), '512345678901') $$, 'staff record the UTR the company paid with');
select is((select status from public.academy_booking where id = pg_temp.id('acme')), 'payment_claimed', 'for the cage to confirm');
insert into ids values ('aditya', public.book_academy(pg_temp.id('large')));
select throws_ok($$ select public.record_academy_payment(pg_temp.id('aditya'), '522345678901') $$, '42501', null,
  'staff never record a payment for their own booking');
select throws_ok($$ select public.record_academy_payment(pg_temp.id('sana'), '532345678901') $$, 'RVPAY', null,
  'nor replace a UTR the payer gave: the cage turns a wrong one down first');
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000201', 'Me Ltd', 5,
  '00000000-0000-4000-8000-0000000000c3') $$, '42501', null, 'a member cannot give themselves the corporate fee');
select throws_ok($$ select public.record_academy_payment(pg_temp.id('acme'), '999999999997') $$, '42501', null, 'nor record a payment');
select pg_temp.as_user('00000000-0000-4000-8000-000000000203');
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('acme'), '999999999998') $$, '42501', null,
  'the company''s contact cannot change the UTR staff entered');

-- An unpaid booking holds its seat for 48 hours, then gives it up.
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
insert into ids values ('kabir_tiny', public.book_academy(pg_temp.id('tiny')));
reset role;
update public.academy_booking set created_at = now() - interval '49 hours' where id = pg_temp.id('kabir_tiny');
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
insert into ids values ('arjun_tiny', public.book_academy(pg_temp.id('tiny')));
select ok(pg_temp.id('arjun_tiny') is not null, 'a seat held unpaid for more than 48 hours goes to the next member');

-- A late payer's UTR is still recorded: the money has been sent (question #220).
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select lives_ok($$ select public.claim_academy_payment(pg_temp.id('kabir_tiny'), '712345678901') $$,
  'a payment given after the hold, the batch since filled, is still recorded (#220)');

-- The cage turns down a UTR it cannot find: the claim is undone and keeps no seat.
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.reject_academy_payment(pg_temp.id('kabir_tiny'), '799999999999') $$, 'RVUTM', null,
  'only the UTR the cashier searched for is turned down');
select lives_ok($$ select public.reject_academy_payment(pg_temp.id('kabir_tiny'), '712345678901') $$,
  'a cashier turns down a UTR that is not in the bank');
reset role;
select results_eq($$ select status, utr, private.academy_seats_taken(batch_id) from public.academy_booking where id = pg_temp.id('kabir_tiny') $$,
  $$ values ('awaiting_payment'::text, null::text, 1) $$, 'the booking is unpaid again, and its lapsed hold keeps no seat');
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select lives_ok($$ select public.claim_academy_payment(pg_temp.id('kabir'), '712345678901') $$,
  'a UTR turned down can be given again, for the booking it paid');

-- Staff cancel a booking with no payment given; never a claimed or paid one.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.cancel_academy_booking(pg_temp.id('kabir_tiny')) $$, 'staff cancel an unpaid booking');
select throws_ok($$ select public.cancel_academy_booking(pg_temp.id('sana')) $$, 'RVPAY', null,
  'never one with a UTR given: the cage confirms or turns it down first');
select throws_ok($$ select public.cancel_academy_booking(pg_temp.id('arjun')) $$, 'RVPAY', null, 'never a paid one: that is a refund at the cage');

-- The practice venue keeps its own ledger.
select pg_temp.as_user('00000000-0000-4000-8000-000000000301');
insert into ids select 'asha', public.book_academy(b.id) from public.academy_batch b
where b.venue_id = '00000000-0000-4000-8000-000000000002' order by b.starts_on limit 1;
select public.claim_academy_payment(pg_temp.id('asha'), '812345678901');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
insert into ids values ('asha_paid', public.confirm_academy_payment(pg_temp.id('asha'), '812345678901'));
reset role;
select ok((select bool_and(a.venue_id = '00000000-0000-4000-8000-000000000002') from public.ledger_entry e
           join public.ledger_account a on a.id = e.account_id where e.transaction_id = pg_temp.id('asha_paid')),
  'a practice-venue fee goes to the practice venue''s own accounts');
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
select lives_ok($$ select public.claim_academy_payment(pg_temp.id('arjun_tiny'), '812345678901') $$,
  'a trainee''s UTR in the practice venue never blocks a real one');
reset role;

-- A batch that has started, a member without the feature, and frozen members.
with started as (
  insert into public.academy_batch (venue_id, name, starts_on, ends_on, seats)
  values ('00000000-0000-4000-8000-000000000001', 'Started', current_date - 1, current_date + 1, 10) returning id
)
insert into ids select 'started', id from started;
select pg_temp.as_user('00000000-0000-4000-8000-000000000204');
insert into ids values ('rohan', public.book_academy(pg_temp.id('large')));
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'academy.booking', false, 'Test');
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select throws_ok($$ select public.book_academy(pg_temp.id('started')) $$, 'RVBAT', null, 'a batch that has started takes no bookings');
select pg_temp.as_user('00000000-0000-4000-8000-000000000204');
select throws_ok($$ select public.book_academy(pg_temp.id('large')) $$, '42501', null, 'a member whose tier lacks Academy booking cannot book');
select is((select count(*)::int from public.academy_batch), 0, 'nor sees the batches');
select is_empty($$ select * from public.academy_payment_details(pg_temp.id('rohan')) $$, 'nor what to pay');
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('rohan'), '912345678901') $$, '42501', null, 'nor gives a UTR');
select is((select count(*)::int from public.academy_booking), 1, 'but still sees their own booking, a record of their money');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.record_academy_payment(pg_temp.id('rohan'), '912345678901') $$,
  'and staff record the UTR for them, so money already sent still reaches the cage');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('rohan'), '912345678901') $$, '42501', null,
  'where someone other than the staff who recorded it confirms it');
reset role;
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', m.id, 'Dispute', s.id
from public.member m, public.staff s
where m.id in ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203')
  and s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select throws_ok($$ select public.book_academy(pg_temp.id('large')) $$, 'RVMBR', null, 'a frozen member cannot book');
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('kabir'), '912345678902') $$, 'RVMBR', null, 'nor give a UTR');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('acme'), '512345678901') $$, 'RVMBR', null,
  'nor is a frozen contact''s payment confirmed (#219)');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000202', 'Beta Ltd', 2,
  '00000000-0000-4000-8000-0000000000c4') $$, 'RVMBR', null, 'nor is a frozen member a company''s contact');

-- Who sees what.
select pg_temp.as_user('00000000-0000-4000-8000-000000000203');
select is((select count(*)::int from public.academy_booking), 1, 'a member sees their own bookings: the company''s, in their name');
reset role;
update public.academy_batch set is_open = false where id = pg_temp.id('large');
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
select ok(not exists (select 1 from public.academy_batch where not is_open), 'a member sees only open batches');
select pg_temp.as_user('00000000-0000-4000-8000-000000000106');
select is((select count(*)::int from public.academy_booking), 0, 'a dealer sees no bookings');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select ok((select count(*) from public.academy_booking) >= 5, 'the cashier sees the venue''s bookings');

-- A venue freeze stops a cancellation and a turned-down payment too.
reset role;
insert into public.control_state (venue_id, level, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Audit', s.id from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.cancel_academy_booking(pg_temp.id('aditya')) $$, 'RVFRZ', null, 'a venue freeze stops a cancellation');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.reject_academy_payment(pg_temp.id('arjun_tiny'), '812345678901') $$, 'RVFRZ', null,
  'and a turned-down payment');
reset role;

select * from finish();
rollback;
