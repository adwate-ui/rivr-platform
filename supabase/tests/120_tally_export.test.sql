-- The Tally export (#96; decision 0187). On club day 18 October 2026 (06:00 to 06:00 IST) the club sells
-- ₹30,000 of chips for cash at 12:00 and takes ₹1,500 of rake at 05:00 the next morning; at 07:00 it
-- sells ₹10,000 more, and at 06:00 sharp takes ₹500 of rake, both on the 19th's club day; points move
-- on the 18th too. Treasury managers map account codes to Tally ledgers and take a day's postings, by
-- transaction kind and code, under the audit log. 103 Aditya is an admin at the club and the practice
-- venue (manages treasury); 197 Pooja an admin at the club only; 104 Sana a cashier (does not).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- A balanced transaction at the club, posted when it happened.
create function pg_temp.post(p_kind text, p_at timestamptz, p_debit text, p_credit text, p_paise bigint) returns void language sql as $$
  with posted as (
    insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at)
    values ('00000000-0000-4000-8000-000000000001', p_kind, 'tally-test:' || p_kind || ':' || p_at, p_at) returning id
  )
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select '00000000-0000-4000-8000-000000000001', posted.id, a.id, case when a.code = p_debit then p_paise else -p_paise end
  from posted, public.ledger_account a
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.member_id is null and a.code in (p_debit, p_credit);
$$;

select pg_temp.post('buy_in', '2026-10-18 12:00+05:30', 'venue.cash_drawer', 'venue.chips_outstanding', 3000000);
select pg_temp.post('hand_rake', '2026-10-19 05:00+05:30', 'venue.chips_outstanding', 'venue.rake', 150000);
select pg_temp.post('buy_in', '2026-10-19 07:00+05:30', 'venue.cash_drawer', 'venue.chips_outstanding', 1000000);
select pg_temp.post('hand_rake', '2026-10-19 06:00+05:30', 'venue.chips_outstanding', 'venue.rake', 50000);
select pg_temp.post('points_award', '2026-10-18 13:00+05:30', 'venue.points_issued', 'venue.points_opening_balance', 500);

-- Who may.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.tally_accounts('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a cashier maps no Tally ledgers');
select throws_ok($$ select * from public.tally_day('00000000-0000-4000-8000-000000000001', '2026-10-18') $$, '42501', null, 'nor takes the export');
select throws_ok($$ select public.set_tally_ledger('00000000-0000-4000-8000-000000000001', 'venue.rake', 'Rake') $$, '42501', null, 'nor maps one');

-- The accounts and their ledgers.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select count(*) > 0 from public.tally_accounts('00000000-0000-4000-8000-000000000001') where tally_ledger is null),
  'Aditya sees the venue''s money accounts, none mapped yet');
select is((select account_name from public.tally_accounts('00000000-0000-4000-8000-000000000001') where account_code = 'member.cash'), null,
  'members'' cash is one code, named by no member');
select is_empty($$ select t.account_code from public.tally_accounts('00000000-0000-4000-8000-000000000001') t
                   join public.ledger_account a on a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = t.account_code
                   where a.unit = 'points' $$, 'points never go to Tally');

select results_eq($$ select kind, account_code, tally_ledger, amount_paise from public.tally_day('00000000-0000-4000-8000-000000000001', '2026-10-18') $$,
  $$ values ('buy_in'::text, 'venue.cash_drawer'::text, null::text, 3000000::bigint), ('buy_in', 'venue.chips_outstanding', null, -3000000),
            ('hand_rake', 'venue.chips_outstanding', null, 150000), ('hand_rake', 'venue.rake', null, -150000) $$,
  'the 18th''s club day runs to 06:00 on the 19th: the 12:00 sale and the 05:00 rake, by kind and code, nothing mapped, no points');

select lives_ok($$ select public.set_tally_ledger('00000000-0000-4000-8000-000000000001', 'venue.cash_drawer', ' Cash ') $$, 'Aditya maps the drawer to Cash');
select lives_ok($$ select public.set_tally_ledger('00000000-0000-4000-8000-000000000001', 'venue.chips_outstanding', 'Chips outstanding') $$,
  'and the chips to Chips outstanding');
select lives_ok($$ select public.set_tally_ledger('00000000-0000-4000-8000-000000000001', 'venue.rake', 'Rake') $$, 'and the rake to Rake');
select lives_ok($$ select public.set_tally_ledger('00000000-0000-4000-8000-000000000001', 'venue.rake', 'Rake income') $$, 'then renames it');
select results_eq($$ select kind, tally_ledger, amount_paise from public.tally_day('00000000-0000-4000-8000-000000000001', '2026-10-18') $$,
  $$ values ('buy_in'::text, 'Cash'::text, 3000000::bigint), ('buy_in', 'Chips outstanding', -3000000),
            ('hand_rake', 'Chips outstanding', 150000), ('hand_rake', 'Rake income', -150000) $$,
  'the day''s postings now carry their Tally ledgers, trimmed, the latest name');
select results_eq($$ select kind, amount_paise from public.tally_day('00000000-0000-4000-8000-000000000001', '2026-10-19') $$,
  $$ values ('buy_in'::text, 1000000::bigint), ('buy_in', -1000000), ('hand_rake', 50000), ('hand_rake', -50000) $$,
  'the rake at 06:00 sharp and the 07:00 sale are the 19th''s');
select is((select count(*)::integer from public.tally_ledger_map where venue_id = '00000000-0000-4000-8000-000000000001'), 3,
  'he sees the three mappings');

select throws_ok($$ select public.set_tally_ledger('00000000-0000-4000-8000-000000000001', 'venue.no_such', 'Cash') $$, '22023', null,
  'no ledger for a code the venue does not have');
select throws_ok($$ select public.set_tally_ledger('00000000-0000-4000-8000-000000000001', 'venue.rake', '  ') $$, '22023', null,
  'nor a ledger with no name');
select throws_ok($$ select * from public.tally_day('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata' - interval '6 hours')::date) $$,
  '22023', null, 'no export of a club day still running');
select throws_ok($$ select * from public.tally_day('00000000-0000-4000-8000-000000000002', '2026-10-18') $$, '22023', null,
  'the practice venue is never exported');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select 1 from public.tally_ledger_map $$, 'a cashier sees no mappings');

-- Another venue's: the practice venue has a mapping, and Pooja manages treasury at the club only.
reset role;
insert into public.tally_ledger_map (venue_id, account_code, tally_ledger) values ('00000000-0000-4000-8000-000000000002', 'venue.rake', 'Practice rake');
select pg_temp.as_person('00000000-0000-4000-8000-000000000197');
select ok((select count(*) > 0 from public.tally_accounts('00000000-0000-4000-8000-000000000001')), 'Pooja maps the club''s ledgers');
select throws_ok($$ select * from public.tally_accounts('00000000-0000-4000-8000-000000000002') $$, '42501', null, 'but not another venue''s');
select throws_ok($$ select * from public.tally_day('00000000-0000-4000-8000-000000000002', '2026-10-18') $$, '42501', null, 'nor takes its export');
select throws_ok($$ select public.set_tally_ledger('00000000-0000-4000-8000-000000000002', 'venue.rake', 'Rake') $$, '42501', null, 'nor maps one there');
select is_empty($$ select 1 from public.tally_ledger_map where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'nor sees its mappings');

reset role;
select is((select count(*)::integer from public.audit_log where action = 'export.tally_day' and venue_id = '00000000-0000-4000-8000-000000000001'), 3,
  'each export taken is in the audit log');
select ok((select count(*) >= 4 from public.audit_log where entity = 'tally_ledger_map'), 'and each mapping, the rename too');

select * from finish();
rollback;
