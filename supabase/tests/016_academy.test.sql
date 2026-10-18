-- Academy (#8): batches with dates and seats; a member books at the individual fee and claims a UPI
-- payment with its UTR; a cashier confirms it, the ledger takes the money and academy.booked goes
-- out; staff book a company at the corporate fee per head. 103 Aditya (admin, members.manage),
-- 104 Sana (cashier, cage.transact), 106 Pema (dealer), 201 Arjun, 202 Kabir, 203 Naina, 204 Rohan.
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

-- Staff open batches; a member cannot.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
insert into ids values
  ('small', public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Level 1, small', current_date + 10, current_date + 12, 2)),
  ('large', public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Level 1, large', current_date + 20, current_date + 22, 10));
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
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('arjun')) $$, '42501', null, 'a member cannot confirm their own payment');

-- Another member cannot touch it, and one UTR pays one booking.
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select is((select count(*)::int from public.academy_booking), 0, 'another member sees none of it');
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('arjun'), '999999999999') $$, '42501', null, 'nor claims a payment on it');
insert into ids values ('kabir', public.book_academy(pg_temp.id('small')));
select throws_ok($$ select public.claim_academy_payment(pg_temp.id('kabir'), '412345678901') $$, '23505', null,
  'a UTR already given for another booking is refused');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('arjun')) $$, '42501', null, 'only a cashier confirms');

-- The batch of two is full.
select pg_temp.as_user('00000000-0000-4000-8000-000000000203');
select throws_ok($$ select public.book_academy(pg_temp.id('small')) $$, 'RVFUL', null, 'a full batch takes no more bookings');

-- The cashier confirms: paid, in the ledger, and academy.booked; confirming again changes nothing.
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('kabir')) $$, 'RVPAY', null, 'a booking with no UTR given has nothing to confirm');
insert into ids values ('arjun_paid', public.confirm_academy_payment(pg_temp.id('arjun')));
select is(public.confirm_academy_payment(pg_temp.id('arjun')), pg_temp.id('arjun_paid'), 'confirming again changes nothing');
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select a.code, e.amount from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
     where e.transaction_id = pg_temp.id('arjun_paid') order by e.amount desc $$,
  $$ values ('venue.bank'::text, 200000::bigint), ('venue.academy'::text, -200000::bigint) $$,
  'the ledger takes the fee: bank in, Academy fees');
select results_eq($$ select status, confirmed_by_staff_id is not null from public.academy_booking where id = pg_temp.id('arjun') $$,
  $$ values ('paid'::text, true) $$, 'the booking is paid, by the cashier who confirmed it');
select results_eq($$ select payload ->> 'amount_paise', payload ->> 'kind' from public.outbox_event where event_type = 'academy.booked' $$,
  $$ values ('200000'::text, 'individual'::text) $$, 'academy.booked goes out, once');

-- A company books its heads at the corporate fee; a member cannot give themselves that fee.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
insert into ids values ('acme', public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000203', 'Acme Pvt Ltd', 3, '512345678901'));
select results_eq($$ select amount, status from public.academy_booking where id = pg_temp.id('acme') $$,
  $$ values (450000::bigint, 'payment_claimed'::text) $$, 'three heads at ₹1,500 each, the company''s UTR given');
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.book_academy_corporate(pg_temp.id('large'), '00000000-0000-4000-8000-000000000201', 'Me Ltd', 5) $$,
  '42501', null, 'a member cannot give themselves the corporate fee');

-- A batch that has started, a member without the feature, a frozen member.
reset role;
select set_config('request.jwt.claims', '', true);
with started as (
  insert into public.academy_batch (venue_id, name, starts_on, ends_on, seats)
  values ('00000000-0000-4000-8000-000000000001', 'Started', current_date - 1, current_date + 1, 10) returning id
)
insert into ids select 'started', id from started;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'academy.booking', false, 'Test');
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000203', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select throws_ok($$ select public.book_academy(pg_temp.id('started')) $$, 'RVBAT', null, 'a batch that has started takes no bookings');
select pg_temp.as_user('00000000-0000-4000-8000-000000000204');
select throws_ok($$ select public.book_academy(pg_temp.id('large')) $$, '42501', null, 'a member whose tier lacks Academy booking cannot book');
select pg_temp.as_user('00000000-0000-4000-8000-000000000203');
select throws_ok($$ select public.book_academy(pg_temp.id('large')) $$, 'RVMBR', null, 'a frozen member cannot book');

-- Who sees what.
select is((select count(*)::int from public.academy_booking), 1, 'a member sees their own bookings: the company''s, in their name');
reset role;
select set_config('request.jwt.claims', '', true);
update public.academy_batch set is_open = false where id = pg_temp.id('large');
select pg_temp.as_user('00000000-0000-4000-8000-000000000203');
select ok(not exists (select 1 from public.academy_batch where not is_open), 'a member sees only open batches');
select pg_temp.as_user('00000000-0000-4000-8000-000000000106');
select is((select count(*)::int from public.academy_booking), 0, 'a dealer sees no bookings');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select ok((select count(*) from public.academy_booking) >= 3, 'the cashier sees the venue''s bookings');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
