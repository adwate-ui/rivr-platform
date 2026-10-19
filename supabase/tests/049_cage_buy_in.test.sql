-- Buy-ins at the cage (#57). 211 Ishaan (identity check finished) sits at Table 3 (NLH 100/200, buy-in
-- ₹10,000) with ₹2,00,000 of wallet cash; 212 Vihaan is not seated; 204 Rohan has no finished check;
-- 213 Mihir takes a break. 103 Aditya is the floor; 104 a cashier (cage.transact); 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.venue_account(p_code text) returns uuid language sql as $$
  select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = p_code and member_id is null;
$$;
create function pg_temp.balance(p_account uuid) returns bigint language sql as $$
  select coalesce(sum(amount), 0)::bigint from public.ledger_entry where account_id = p_account;
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- Ishaan's wallet holds ₹2,00,000, and he sits at Table 3.
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-deposit',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.venue_account('venue.bank'), 'amount', '20000000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000211' and code = 'member.cash'),
                                       'amount', '-20000000')), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'session', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211');
reset role;
create temp table drawer_before as select pg_temp.balance(pg_temp.venue_account('venue.cash_drawer')) as cash, pg_temp.balance(pg_temp.venue_account('venue.chips_outstanding')) as chips;

-- Cash, UPI and wallet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'cash', public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', '00000000-0000-4000-8000-0000000c0001');
select isnt((select id from ids where name = 'cash'), null, 'a cashier issues ₹10,000 of chips for cash');
select is(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', '00000000-0000-4000-8000-0000000c0001'),
  (select id from ids where name = 'cash'), 'a retried tap issues them once');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 2000000, 'cash', '00000000-0000-4000-8000-0000000c0001') $$,
  '22023', null, 'a request id is for one buy-in');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 2000000, 'upi', '00000000-0000-4000-8000-0000000c0002', '123456789012'),
  null, '₹20,000 by UPI with its UTR');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi', '00000000-0000-4000-8000-0000000c0003', '123456789012') $$,
  'RVUTR', null, 'a UTR pays for one buy-in');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi', '00000000-0000-4000-8000-0000000c0004') $$,
  '22023', null, 'UPI needs its UTR');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi', '00000000-0000-4000-8000-0000000c0005', '12345678901') $$,
  '22023', null, 'of 12 digits');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet', '00000000-0000-4000-8000-0000000c0006'),
  null, '₹10,000 from the wallet');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 19100000, 'wallet', '00000000-0000-4000-8000-0000000c0007') $$,
  'RVSHT', null, 'never more than the wallet holds');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 995000, 'cash', '00000000-0000-4000-8000-0000000c0008') $$,
  'RVMIN', null, 'never below the table''s minimum');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1002000, 'cash', '00000000-0000-4000-8000-0000000c0009') $$,
  'RVCHP', null, 'only whole ₹50 chips');
reset role;
select is(pg_temp.balance(pg_temp.venue_account('venue.cash_drawer')) - (select cash from drawer_before), 1000000::bigint, 'the cash drawer holds ₹10,000 more');
select is((select chips from drawer_before) - pg_temp.balance(pg_temp.venue_account('venue.chips_outstanding')), 4000000::bigint,
  'and ₹40,000 of chips are out');
select is((select -sum(e.amount) from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
           where a.member_id = '00000000-0000-4000-8000-000000000211' and a.code = 'member.cash')::bigint, 19000000::bigint,
  'Ishaan''s wallet holds ₹1,90,000');

-- The cage refuses members it cannot serve.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select isnt(public.take_break(1), null, 'Mihir takes a break');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'cash', gen_random_uuid()) $$,
  'RVNST', null, 'chips are issued to a seat');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 1000000, 'cash', gen_random_uuid()) $$,
  'RVKYC', null, 'never without a finished identity check');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 1000000, 'cash', gen_random_uuid()) $$,
  'RVBRK', null, 'nor during a break');

-- Flow 3: the table asks, the cage approves from the wallet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'request', public.request_buy_in((select id from ids where name = 'session'), 1000000, '00000000-0000-4000-8000-0000000c0010');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select full_name, table_name, seat, amount_paise, photo_path from public.cage_queue('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Ishaan Verma'::text, 'Table 3'::text, 1, 1000000::bigint, '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000211/selfie.jpg'::text) $$,
  'the request waits in the cage''s queue, with his KYC photo');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet',
  '00000000-0000-4000-8000-0000000c0011', null, (select id from ids where name = 'request')), null, 'Approve from wallet');
select is_empty($$ select * from public.cage_queue('00000000-0000-4000-8000-000000000001') $$, 'and the queue is empty');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'declined', public.request_buy_in((select id from ids where name = 'session'), 2000000, '00000000-0000-4000-8000-0000000c0012');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select public.decline_buy_in_request((select id from ids where name = 'declined')) $$, 'a cashier declines another');
select results_eq($$ select full_name, wallet_paise, table_name, seat, minimum_paise from public.cage_members('00000000-0000-4000-8000-000000000001', 'Ishaan') $$,
  $$ values ('Ishaan Verma'::text, 18000000::bigint, 'Table 3'::text, 1, 1000000::bigint) $$, 'the cashier finds Ishaan, his wallet and seat');

-- Who may.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()) $$,
  '42501', null, 'a dealer issues no chips');
select is_empty($$ select * from public.cage_members('00000000-0000-4000-8000-000000000001', 'Ishaan') $$, 'nor finds members at the cage');
select is_empty($$ select * from public.cage_transaction $$, 'nor sees cage transactions');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', '00000000-0000-4000-8000-0000000c0001') $$,
  '42501', null, 'nor learns of a buy-in by replaying its request id');
select is_empty($$ select * from public.buy_in_request $$, 'nor sees buy-in requests');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.cage_transaction), 4, 'Ishaan sees his own four buy-ins');
select throws_ok($$ select public.request_buy_in((select s.id from public.seat_session s where s.ended_at is null limit 1), 1000000, gen_random_uuid()) $$,
  '42501', null, 'and asks the cage for nothing himself');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'cage.buy_in'), 4, 'cage.buy_in for each buy-in');
select is((select count(*)::integer from public.buy_in_request where status = 'declined'), 1, 'the declined request is kept');

-- Who sees what: cashiers the requests, staff who read the ledger the transactions; a cashier of
-- the practice venue alone nothing of the club's.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.buy_in_request), 2, 'a cashier sees the venue''s buy-in requests');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.buy_in_request $$, 'a member does not, even his own');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select count(*)::integer from public.cage_transaction), 4, 'staff who read the ledger see the cage transactions');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.cage_queue('00000000-0000-4000-8000-000000000001') $$, 'the practice venue''s cashier sees no club queue');
select is_empty($$ select * from public.cage_members('00000000-0000-4000-8000-000000000001', 'Ishaan') $$, 'finds no club member');
select is_empty($$ select * from public.cage_transaction where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'sees no club transaction');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()) $$, '42501', null,
  'and issues no club chips');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';

-- One request waits per seat; a request from a seat the player has left is not paid.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'pending', public.request_buy_in((select id from ids where name = 'session'), 1000000, '00000000-0000-4000-8000-0000000c0013');
select is(public.request_buy_in((select id from ids where name = 'session'), 1000000, '00000000-0000-4000-8000-0000000c0013'),
  (select id from ids where name = 'pending'), 'a retried request is the same request');
select throws_ok($$ select public.request_buy_in((select id from ids where name = 'session'), 2000000, '00000000-0000-4000-8000-0000000c0014') $$,
  'RVPND', null, 'another waits until the cage decides the first');
select lives_ok($$ select public.end_seat((select id from ids where name = 'session'), 'left') $$, 'Ishaan leaves Table 3');
insert into ids select 'again', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 2, '9000000211');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.cage_queue('00000000-0000-4000-8000-000000000001') $$, 'his request from seat 1 leaves the queue');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet', gen_random_uuid(), null, (select id from ids where name = 'pending')) $$,
  'RVSTL', null, 'and is not paid to the seat he sits in now');

-- Frozen: the member is served nothing; while the venue is frozen the cage neither issues nor declines.
reset role;
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000211', 'Dispute', s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()) $$, 'RVMBR', null,
  'a frozen member gets no chips');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'cash', gen_random_uuid()) $$, 'RVFRZ', null,
  'while the venue is frozen nobody does');
select throws_ok($$ select public.decline_buy_in_request((select id from ids where name = 'pending')) $$, 'RVFRZ', null,
  'and no request is declined');
reset role;

select * from finish();
rollback;
