-- The TDS engine (#22, decision 0068, question #369). The seed switches TDS off: 194B, 30% of a
-- financial year's net winnings above ₹10,000. 104 Sana is a cashier; 103 Aditya the floor manager;
-- 106 Pema a dealer; 139 Farah a cashier at the practice venue too. 211 Ishaan and 201 Arjun (an open
-- ₹50,000 marker) sit at Table 3 and are let go before their call time.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.balance(p_code text) returns bigint language sql as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is null;
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
create temp table held (name text primary key, paise bigint);
grant select, insert on ids, held to authenticated;

-- Ishaan and Arjun sit at Table 3, and Aditya lets them leave before their call time.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000211'), null, 'Ishaan checks in');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000201'), null, 'and Arjun');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'Ishaan sits at Table 3');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 2, '9000000201'),
  null, 'and Arjun beside him');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'TDS test'), null, 'Ishaan may leave early');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'TDS test'), null, 'and Arjun');

-- Switched off: Ishaan buys in ₹10,000 and cashes out ₹50,000. ₹40,000 won owes ₹12,000, recorded as shadow; he gets it all.
reset role;
insert into held select 'payable', pg_temp.balance('venue.tds_payable');
insert into held select 'drawer', pg_temp.balance('venue.cash_drawer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()),
  null, 'Sana issues Ishaan ₹10,000 of chips for cash');
select is((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
  5000000, 'cash', '00000000-0000-4000-8000-0000000c2201', false)), 5000000::bigint, 'switched off, Ishaan gets all ₹50,000');
select results_eq($$ select section, basis, winnings_paise, already_paise, rate_basis_points, due_paise, amount_paise, is_shadow, has_pan
                     from public.tds_withholding where member_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values ('194B'::text, 'financial_year'::text, 4000000::bigint, 0::bigint, 3000, 1200000::bigint, 1200000::bigint, true, true) $$,
  'and ₹12,000 of shadow TDS is recorded on ₹40,000 won');
select is((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
  5000000, 'cash', '00000000-0000-4000-8000-0000000c2201', false)), 5000000::bigint, 'a retried tap pays the same, once');
reset role;
select is(pg_temp.balance('venue.tds_payable') - (select paise from held where name = 'payable'), 0::bigint, 'and nothing is withheld');
select is(pg_temp.balance('venue.cash_drawer') - (select paise from held where name = 'drawer'), 1000000::bigint - 5000000, 'the drawer pays out the lot');

-- Switched on, per session: a ₹20,000 cash-out makes ₹60,000 won this visit, owing ₹18,000. The ₹12,000
-- of shadow already counts, so ₹6,000 is withheld: Ishaan gets ₹14,000 and the ledger holds ₹6,000 for the government.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": true, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "session", "pan_required": true, "no_pan_rate_basis_points": 3000}',
        now() - interval '3 seconds', 'TDS test');
update held set paise = pg_temp.balance('venue.tds_payable') where name = 'payable';
update held set paise = pg_temp.balance('venue.cash_drawer') where name = 'drawer';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select to_member_paise, tds_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
  2000000, 'cash', '00000000-0000-4000-8000-0000000c2202', false) $$, $$ values (1400000::bigint, 600000::bigint) $$, 'switched on, Ishaan gets ₹14,000 of ₹20,000, ₹6,000 withheld');
select results_eq($$ select basis, winnings_paise, already_paise, due_paise, amount_paise, is_shadow from public.tds_withholding
                     where cage_transaction_id = (select id from public.cage_transaction where idempotency_key = '00000000-0000-4000-8000-0000000c2202') $$,
  $$ values ('session'::text, 6000000::bigint, 1200000::bigint, 1800000::bigint, 600000::bigint, false) $$,
  '₹6,000 withheld: ₹18,000 owed on ₹60,000 won this visit, less the ₹12,000 already recorded');
select is((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
  2000000, 'cash', '00000000-0000-4000-8000-0000000c2202', false)), 1400000::bigint, 'a retried tap gives the same net, once');
reset role;
select is(pg_temp.balance('venue.tds_payable') - (select paise from held where name = 'payable'), -600000::bigint, 'the ledger holds ₹6,000 for the government');
select is(pg_temp.balance('venue.cash_drawer') - (select paise from held where name = 'drawer'), -1400000::bigint, 'and the drawer pays ₹14,000');
select is((select (payload ->> 'tds_paise')::bigint from public.outbox_event where event_type = 'cage.cash_out'
           and payload ->> 'cage_transaction_id' = (select id::text from public.cage_transaction where idempotency_key = '00000000-0000-4000-8000-0000000c2202')),
  600000::bigint, 'cage.cash_out says what was withheld');

-- Never more than the cash-out pays: Arjun's ₹20,000 goes to his marker, so nothing is withheld now; it stays owed.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select markers_settled_paise, to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
                       '00000000-0000-4000-8000-000000000201', 2000000, 'wallet', gen_random_uuid(), false) $$,
  $$ values (2000000::bigint, 0::bigint) $$, 'Arjun''s ₹20,000 settles his marker');
select results_eq($$ select winnings_paise, due_paise, amount_paise, is_shadow from public.tds_withholding
                     where member_id = '00000000-0000-4000-8000-000000000201' $$,
  $$ values (2000000::bigint, 600000::bigint, 0::bigint, false) $$, 'so ₹6,000 is owed and nothing withheld');
reset role;

-- A tournament prize (lane B): the parameters in force on the prize alone.
select results_eq($$ select amount_paise, is_shadow from private.tds_for('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
                     4000000, now()) $$, $$ values (1200000::bigint, false) $$, 'a ₹40,000 prize owes ₹12,000 while TDS is on');
select results_eq($$ select amount_paise from private.tds_for('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
                     1000000, now()) $$, $$ values (0::bigint) $$, 'and a ₹10,000 one nothing');
select results_eq($$ select amount_paise, is_shadow from private.tds_for('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
                     4000000, now() - interval '1 day') $$, $$ values (1200000::bigint, true) $$, 'yesterday it was shadow');

-- Where a period starts, on the venue's clock: its calendar day, and the financial year from 1 April.
select is(private.tds_period_start('00000000-0000-4000-8000-000000000001', null, 'day', '2026-10-20 01:30+05:30'), '2026-10-20 00:00+05:30'::timestamptz,
  'a day starts at midnight in Gurugram');
select is(private.tds_period_start('00000000-0000-4000-8000-000000000001', null, 'financial_year', '2026-10-20 12:00+05:30'), '2026-04-01 00:00+05:30'::timestamptz,
  'a financial year on 1 April');
select is(private.tds_period_start('00000000-0000-4000-8000-000000000001', null, 'financial_year', '2027-02-10 12:00+05:30'), '2026-04-01 00:00+05:30'::timestamptz,
  'the same one in February');
select is(private.tds_period_start('00000000-0000-4000-8000-000000000001', null, 'financial_year', '2027-04-01 00:00+05:30'), '2027-04-01 00:00+05:30'::timestamptz,
  'and the next from 1 April');
select is(private.tds_period_start('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'session', now()),
  (select opened_at from public.visit where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null), 'a session is the visit');

-- Where a PAN is required and the member has none, the no-PAN rate: 40% of Arjun's ₹70,000 won this visit is ₹28,000,
-- of which his ₹50,000 cash-out can bear the ₹20,000 left after his ₹30,000 of markers. The cashier is told so.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": true, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "session", "pan_required": true, "no_pan_rate_basis_points": 4000}',
        now() - interval '2 seconds', 'TDS test');
update public.kyc_record set pan = null where member_id = '00000000-0000-4000-8000-000000000201';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select markers_settled_paise, to_member_paise, tds_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
                       '00000000-0000-4000-8000-000000000201', 5000000, 'wallet', '00000000-0000-4000-8000-0000000c2203', false) $$,
  $$ values (3000000::bigint, 0::bigint, 2000000::bigint) $$, 'Arjun''s ₹50,000 settles ₹30,000 of markers, and TDS takes the rest');
select results_eq($$ select has_pan, rate_basis_points, winnings_paise, due_paise, amount_paise from public.tds_withholding
                     where cage_transaction_id = (select id from public.cage_transaction where idempotency_key = '00000000-0000-4000-8000-0000000c2203') $$,
  $$ values (false, 4000, 7000000::bigint, 2800000::bigint, 2000000::bigint) $$, 'at the no-PAN rate, with no PAN on record');

-- On the day basis, a visit that began before midnight counts whole: Ishaan's ₹10,000 bought at 23:30 is money in,
-- so ₹70,000 won owes ₹21,000, and with ₹18,000 recorded this visit his ₹10,000 cash-out bears ₹3,000.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": true, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "day", "pan_required": true, "no_pan_rate_basis_points": 3000}',
        now() - interval '1 second', 'TDS test');
insert into held select 'midnight', extract(epoch from date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')::bigint;
update public.visit set opened_at = to_timestamp((select paise from held where name = 'midnight')) - interval '3 hours'
where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null;
alter table public.cage_transaction disable trigger cage_transaction_never_changed;
update public.cage_transaction set created_at = to_timestamp((select paise from held where name = 'midnight')) - interval '30 minutes'
where member_id = '00000000-0000-4000-8000-000000000211' and kind = 'buy_in';
alter table public.cage_transaction enable trigger cage_transaction_never_changed;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select to_member_paise, tds_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
                       1000000, 'cash', gen_random_uuid(), false) $$,
  $$ values (700000::bigint, 300000::bigint) $$, 'Ishaan gets ₹7,000 of ₹10,000');
reset role;
select is((select period_start from public.tds_withholding w join public.cage_transaction t on t.id = w.cage_transaction_id
           where w.member_id = '00000000-0000-4000-8000-000000000211' and w.basis = 'day'),
  to_timestamp((select paise from held where name = 'midnight')) - interval '3 hours', 'his period runs from when the visit began');

-- Who sees it: the member their own, ledger readers the venue's; nobody else, nor another venue; nobody writes it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.tds_withholding), 3, 'Ishaan sees his own three');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.tds_withholding), 5, 'the cashier sees the venue''s five');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.tds_withholding $$, 'a dealer sees none');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000139' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000139');
select is_empty($$ select * from public.tds_withholding where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'nor the practice venue''s cashier');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000139' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ update public.tds_withholding set amount_paise = 0 $$, '42501', null, 'nobody changes it');
reset role;
select throws_ok($$ update public.tds_withholding set amount_paise = 0 $$, null, null, 'not even the database owner');

select * from finish();
rollback;
