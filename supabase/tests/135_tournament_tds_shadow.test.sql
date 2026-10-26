-- Tournament bounty TDS while TDS is switched off (#477; decision 0233), as every venue has it today: 214 Yash
-- knocks out 213 Mihir in a knockout and is paid a ₹2,000 bounty. Nothing is withheld; the ₹600 that would have
-- been (30% above ₹1,000) is recorded as shadow, which the ledger shows and the return and certificates leave out.
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
create function pg_temp.run(p_member uuid) returns uuid language sql security definer as $$
  select id from public.tournament_entry where tournament_id = pg_temp.named('Shadow Knockout') and member_id = p_member;
$$;
grant execute on function pg_temp.named(text), pg_temp.run(uuid) to authenticated;
create temp table quarter as select private.tds_quarter_start(now()) as starts;
grant select on quarter to authenticated;

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 100000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
        now() - interval '1 minute', 'Tournament TDS shadow test');
select pg_temp.fund('00000000-0000-4000-8000-000000000213', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000214', 5000000);

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'Shadow Knockout', now(), true) $$, 'a knockout');
select public.set_tournament_room(pg_temp.named('Shadow Knockout'), 2, 9);
select public.start_tournament_clock(pg_temp.named('Shadow Knockout'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Shadow Knockout'), 'entry', '00000000-0000-4000-8000-00000000f311');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select public.register_tournament_entry(pg_temp.named('Shadow Knockout'), 'entry', '00000000-0000-4000-8000-00000000f312');
reset role;

-- Yash is paid a ₹2,000 bounty for Mihir's head, as lane B pays every bounty.
select private.pay_tournament_run(pg_temp.run('00000000-0000-4000-8000-000000000214'), null, 0, 200000, 0, pg_temp.run('00000000-0000-4000-8000-000000000213'));
select results_eq($$ select kind, tds_paise, is_tds_shadow from public.tournament_payout where entry_id = pg_temp.run('00000000-0000-4000-8000-000000000214') $$,
  $$ values ('bounty'::text, 60000::bigint, true) $$, 'switched off: ₹600 would have been withheld, and nothing is');
select results_eq(
  $$ select w.basis, w.winnings_paise, w.amount_paise, w.is_shadow from public.tds_withholding w
     join public.tournament_payout p on p.id = w.tournament_payout_id where p.entry_id = pg_temp.run('00000000-0000-4000-8000-000000000214') $$,
  $$ values ('payment'::text, 200000::bigint, 60000::bigint, true) $$, 'the withholding ledger records it as shadow');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select payments, paid_paise, withheld_paise, shadow_paise
     from public.tds_ledger('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date)
     where member_id = '00000000-0000-4000-8000-000000000214' $$,
  $$ values (1, 200000::bigint, 0::bigint, 60000::bigint) $$, 'the ledger: one payment of ₹2,000, ₹600 shadow, nothing withheld');
select is_empty($$ select * from public.tds_return_extract('00000000-0000-4000-8000-000000000001', (select starts from quarter)) where full_name = 'Yash Gupta' $$,
  'the quarterly return leaves it out: nothing was deducted');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is_empty($$ select * from public.my_tds_certificates() $$, 'and Yash''s certificates show none');

select * from finish();
rollback;
