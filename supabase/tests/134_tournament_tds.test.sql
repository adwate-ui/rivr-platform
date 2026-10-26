-- Tournament prize TDS in the TDS ledger (#477; decision 0233). With TDS switched on (194B, 30% above ₹1,000 over
-- the financial year), 213 Mihir plays a knockout and wins ₹3,000: ₹900 is withheld. The payout records it in the
-- withholding ledger, so the ledger, the quarterly return and his certificate hold it, taxed on the prize alone;
-- a cash-out's period does not count it. 103 Aditya is an admin (runs tournaments, exports tables).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.fund(p_member uuid, p_paise bigint) returns uuid language sql as $$
  select private.post_ledger_transaction(m.venue_id, 'deposit', 'test-fund:' || p_member, jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = m.venue_id and a.code = 'venue.bank' and a.member_id is null),
                       'amount', p_paise::text),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member and a.code = 'member.cash'),
                       'amount', (-p_paise)::text)), null, 'Test deposit')
  from public.member m where m.id = p_member;
$$;
create function pg_temp.named(p_name text) returns uuid language sql security definer as $$ select id from public.tournament where name = p_name; $$;
grant execute on function pg_temp.named(text) to authenticated;
create temp table quarter as select private.tds_quarter_start(now()) as starts;
grant select on quarter to authenticated;

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": true, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 100000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
        now() - interval '1 minute', 'Tournament TDS test');
update public.venue_config set tan = 'DELR12345E' where venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.fund('00000000-0000-4000-8000-000000000213', 5000000);

-- A knockout, and Mihir's run in it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'TDS Knockout', now(), true) $$, 'a knockout');
select public.set_tournament_room(pg_temp.named('TDS Knockout'), 2, 9);
select public.start_tournament_clock(pg_temp.named('TDS Knockout'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('TDS Knockout'), 'entry', '00000000-0000-4000-8000-00000000f301');
reset role;
create temp table run as
  select id from public.tournament_entry where tournament_id = pg_temp.named('TDS Knockout') and member_id = '00000000-0000-4000-8000-000000000213';

-- He wins ₹3,000, paid as lane B pays every prize.
select private.pay_tournament_run((select id from run), 1, 300000, 0, 0, null);
create temp table payout as select * from public.tournament_payout where entry_id = (select id from run);
select results_eq($$ select tds_paise, is_tds_shadow from payout $$, $$ values (90000::bigint, false) $$, '₹900 of his ₹3,000 is withheld');
select results_eq(
  $$ select w.section, w.basis, w.winnings_paise, w.already_paise, w.rate_basis_points, w.due_paise, w.amount_paise, w.is_shadow,
            w.cage_transaction_id is null, w.created_at = p.created_at
     from public.tds_withholding w join payout p on p.id = w.tournament_payout_id $$,
  $$ values ('194B'::text, 'payment'::text, 300000::bigint, 0::bigint, 3000, 90000::bigint, 90000::bigint, false, true, true) $$,
  'and the withholding ledger records it as the payout does: on the prize alone, when it was paid');

-- The reports hold it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select payments, paid_paise, withheld_paise, shadow_paise
     from public.tds_ledger('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date)
     where member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values (1, 300000::bigint, 90000::bigint, 0::bigint) $$, 'the ledger: one payment of ₹3,000, ₹900 withheld');
select results_eq(
  $$ select full_name, section, taxed_winnings_paise, rate_basis_points, tds_paise
     from public.tds_return_extract('00000000-0000-4000-8000-000000000001', (select starts from quarter)) where full_name = 'Mihir Shah' $$,
  $$ values ('Mihir Shah'::text, '194B'::text, 300000::bigint, 3000, 90000::bigint) $$,
  'the quarterly return: the deduction, taxed on the ₹3,000 won');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select tan, section, payments, paid_paise, tds_paise from public.my_tds_certificates() $$,
  $$ values ('DELR12345E'::text, '194B'::text, 1, 300000::bigint, 90000::bigint) $$, 'and his certificate data');

-- A cash-out's period counts cash-outs' TDS only: the prize was taxed on its own. Mihir buys in ₹10,000 at the
-- cage and cashes out ₹30,000: ₹6,000 is withheld on his ₹20,000 won, whatever the prize bore.
reset role;
select is((select already_paise from private.tds_on_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 0, 0)),
  0::bigint, 'nothing the prize bore counts against what a cash-out bears');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000213'), null, 'Mihir checks in');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000213'),
  null, 'and sits at Table 3');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'Tournament TDS test'), null,
  'Aditya lets him leave early');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 1000000, 'cash', gen_random_uuid()),
  null, 'Mihir buys in ₹10,000');
select is((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
  3000000, 'cash', gen_random_uuid(), false)), 2400000::bigint, 'and of his ₹30,000 cash-out, ₹6,000 is withheld, as without the prize');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select taxed_winnings_paise, tds_paise from public.tds_return_extract('00000000-0000-4000-8000-000000000001', (select starts from quarter))
     where full_name = 'Mihir Shah' order by tds_paise $$,
  $$ values (300000::bigint, 90000::bigint), (2000000, 600000) $$,
  'the return: the prize taxed on its ₹3,000, and the cash-out on its ₹20,000');
reset role;

-- Recorded once.
select throws_ok($$ select private.record_tournament_payout_tds((select id from payout)) $$, '23505', null, 'a payout records its TDS once');
select is((select count(*)::integer from public.tds_withholding where tournament_payout_id = (select id from payout)), 1, 'one row a payout');
select ok(not has_function_privilege('authenticated', 'private.record_tournament_payout_tds(uuid)', 'execute'), 'no client records TDS');

select * from finish();
rollback;
