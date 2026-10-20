-- Cage shifts guard the cage's money (#376, decision 0107). While no shift is open the cage takes and pays
-- nothing; an opening that differs from the last close is an anomaly a manager reviews. 104 Sana and 140
-- Rohit are cashiers; 102 Meera (a super admin) and 103 Aditya are managers (eod.review); 106 Pema is a
-- dealer. 211 Ishaan sits at Table 3 with wallet cash; 213 Mihir checks in; 201 Arjun has credit.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
-- A count of the venue's six chips, ₹50 to ₹25,000, in that order.
create function pg_temp.counts(p_quantities integer[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('value_paise', x.value_paise, 'quantity', x.quantity) order by x.value_paise)
  from unnest(array[5000, 10000, 50000, 100000, 500000, 2500000]::bigint[], p_quantities) as x(value_paise, quantity);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.counts(integer[]) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- The seed's shift closed, so the club's cage has none open.
update public.cage_shift set closed_at = now(), closed_by_staff_id = opened_by_staff_id where closed_at is null;
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-083:deposit', jsonb_build_array(
  jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.bank'), 'amount', '5000000'),
  jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'member.cash'
                                    and member_id = '00000000-0000-4000-8000-000000000211'), 'amount', '-5000000')), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'Ishaan sits at Table 3');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 2, '9000000201'),
  null, 'and Arjun beside him');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000213'), null, 'and Mihir checks in');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()) $$,
  'RVNSH', 'The cage has no shift open: open one on Treasury first', 'with no shift open, the cage issues no chips for cash');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'wallet', gen_random_uuid()) $$,
  'RVNSH', null, 'nor from a wallet, which moves no cash');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 400000, 'cash', gen_random_uuid(), false) $$,
  'RVNSH', null, 'takes no chips back');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 1000000,
  'M10 40 C 30 10, 50 70, 70 40', gen_random_uuid()) $$, 'RVNSH', null, 'and gives no marker');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'upi', gen_random_uuid(),
  '512345670083') $$, 'RVNSH', null, 'no chips for UPI');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 400000, 'wallet', gen_random_uuid(), false) $$,
  'RVNSH', null, 'and none taken back into a wallet');

-- Every posting a signed-in request makes is checked, so the cage's other moves are refused the same way:
-- a deposit, a withdrawal paid and an Academy fee each move the bank. A hand's rake and a member's own
-- withdrawal request move neither the drawer nor the bank, nor issue chips, and go through.
reset role;
create function pg_temp.post_as_sana(p_kind text, p_debit text, p_credit text) returns uuid language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000104', 'role', 'authenticated')::text, true);
  select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', p_kind, 'test-083:' || gen_random_uuid(), jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = p_debit
                                      and member_id is not distinct from case when p_debit like 'member.%' then '00000000-0000-4000-8000-000000000211'::uuid end), 'amount', '100'),
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = p_credit
                                      and member_id is not distinct from case when p_credit like 'member.%' then '00000000-0000-4000-8000-000000000211'::uuid end), 'amount', '-100')), null);
$$;
select throws_ok($$ select pg_temp.post_as_sana('deposit', 'venue.bank', 'member.cash') $$, 'RVNSH', null, 'a deposit confirmed is refused');
select throws_ok($$ select pg_temp.post_as_sana('withdrawal_paid', 'venue.withdrawals_pending', 'venue.bank') $$, 'RVNSH', null, 'and a withdrawal paid');
select throws_ok($$ select pg_temp.post_as_sana('academy_fee', 'venue.bank', 'venue.opening_balance') $$, 'RVNSH', null, 'and an Academy fee');
select lives_ok($$ select pg_temp.post_as_sana('hand_rake', 'venue.chips_outstanding', 'venue.rake') $$, 'a hand''s rake goes through');
select lives_ok($$ select pg_temp.post_as_sana('withdrawal', 'member.cash', 'venue.withdrawals_pending') $$, 'and a member''s withdrawal request');
select set_config('request.jwt.claims', '', true);
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');

-- Sana opens the shift; there is no close before it to set it against.
insert into ids select 'first', public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120000000,
  pg_temp.counts(array[400, 300, 200, 100, 40, 8]), gen_random_uuid());
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()),
  null, 'with a shift open, the buy-in goes through');
reset role;
select results_eq($$ select last_close_id, opening_is_anomaly from public.cage_shift where id = (select id from ids where name = 'first') $$,
  $$ values (null::uuid, false) $$, 'the first shift has no close before it');

-- Sana closes it on ₹12,10,000 and the chips less ₹10,000; Rohit opens the next with exactly those.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.close_cage_shift('00000000-0000-4000-8000-000000000001', 121000000, pg_temp.counts(array[400, 300, 200, 100, 38, 8]), 0, 0, gen_random_uuid()),
  null, 'Sana closes the shift');
select pg_temp.as_person('00000000-0000-4000-8000-000000000140');
insert into ids select 'second', public.open_cage_shift('00000000-0000-4000-8000-000000000001', 121000000,
  pg_temp.counts(array[400, 300, 200, 100, 38, 8]), gen_random_uuid());
reset role;
select results_eq($$ select s.last_close_id is not null, s.opening_is_anomaly, s.opening_cash_variance_paise, s.opening_chips_variance_paise
                     from public.cage_shift s where s.id = (select id from ids where name = 'second') $$,
  $$ values (true, false, 0::bigint, 0::bigint) $$, 'an opening that matches the last close is no anomaly');

-- Rohit closes; Meera, a super admin, opens the next ₹500 short in the drawer and a ₹5,000 chip more in the cage.
select pg_temp.as_person('00000000-0000-4000-8000-000000000140');
select isnt(public.close_cage_shift('00000000-0000-4000-8000-000000000001', 121000000, pg_temp.counts(array[400, 300, 200, 100, 38, 8]), 0, 0, gen_random_uuid()),
  null, 'Rohit closes it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
insert into ids select 'third', public.open_cage_shift('00000000-0000-4000-8000-000000000001', 120950000,
  pg_temp.counts(array[400, 300, 200, 100, 39, 8]), gen_random_uuid());
reset role;
select results_eq($$ select opening_is_anomaly, opening_cash_variance_paise, opening_chips_variance_paise from public.cage_shift
                     where id = (select id from ids where name = 'third') $$,
  $$ values (true, -50000::bigint, 500000::bigint) $$, 'an opening that differs from the last close is an anomaly');
select is((select count(*)::integer from public.alert where kind = 'eod.opening_variance' and detail ->> 'shift_id' = (select id::text from ids where name = 'third')), 1,
  'and raises an alert');

-- Who reviews it: a manager who neither opened it nor closed the last.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select results_eq($$ select may_review, cash_variance_paise from public.shift_openings('00000000-0000-4000-8000-000000000001') $$,
  $$ values (false, -50000::bigint) $$, 'Meera opened it: though a manager, she may not give the reason');
select throws_ok($$ select public.review_shift_opening((select id from ids where name = 'third'), 'Counted wrong') $$, '42501', null,
  'nor can she');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.review_shift_opening((select id from ids where name = 'third'), 'Counted wrong') $$, '42501', null,
  'nor can a cashier');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.shift_openings('00000000-0000-4000-8000-000000000001') $$, 'a dealer sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select may_review from public.shift_openings('00000000-0000-4000-8000-000000000001') $$, $$ values (true) $$,
  'Aditya, a manager, may');
select throws_ok($$ select public.review_shift_opening((select id from ids where name = 'third'), 'No') $$, '22023', null,
  'with a reason of three characters or more');
select lives_ok($$ select public.review_shift_opening((select id from ids where name = 'third'), 'A ₹500 note was in the float bag; a ₹5,000 chip came back late') $$,
  'Aditya gives the reason');
select results_eq($$ select may_review, reason, reviewed_by from public.shift_openings('00000000-0000-4000-8000-000000000001') $$,
  $$ values (false, 'A ₹500 note was in the float bag; a ₹5,000 chip came back late'::text, 'Aditya Malhotra'::text) $$, 'and the opening shows it');
select throws_ok($$ select public.review_shift_opening((select id from ids where name = 'second'), 'Nothing to say') $$, 'RVREV', null,
  'an opening with no difference has nothing to review');

-- Migrations, the seed and jobs, with nobody signed in, still post with no shift open.
reset role;
select set_config('request.jwt.claims', '', true);
update public.cage_shift set closed_at = now(), closed_by_staff_id = opened_by_staff_id where closed_at is null;
select lives_ok($$ select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-083:seed', jsonb_build_array(
  jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.bank'), 'amount', '100'),
  jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'member.cash'
                                    and member_id = '00000000-0000-4000-8000-000000000211'), 'amount', '-100')), null) $$,
  'the seed posts to the bank with no shift open');

select * from finish();
rollback;
