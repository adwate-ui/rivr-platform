-- TDS reports (#93) and the shareholding register (#97); decisions 0169 and 0170. As in 070_tds: Ishaan
-- (211) sits at Table 3 and is let go before his call time; switched off, he buys in ₹10,000 and cashes
-- out ₹50,000 (₹12,000 of shadow TDS); switched on per session, a ₹20,000 cash-out has ₹6,000 withheld.
-- 104 Sana is a cashier (reads the ledger, exports nothing); 103 Aditya an admin (exports tables); 101
-- Vikram a super admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
-- This quarter's first day, as the return extract and the certificates name it.
create temp table quarter as select private.tds_quarter_start(now()) as starts;
grant select on quarter to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000211'), null, 'Ishaan checks in');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'and sits at Table 3');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'TDS reports test'), null,
  'Aditya lets him leave early');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()),
  null, 'Ishaan buys in ₹10,000');
select isnt((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
  5000000, 'cash', gen_random_uuid(), false)), null, 'and cashes out ₹50,000 while TDS is off');
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": true, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "session", "pan_required": true, "no_pan_rate_basis_points": 3000}',
        now() - interval '3 seconds', 'TDS reports test');
update public.venue_config set tan = 'DELR12345E' where venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
  2000000, 'cash', gen_random_uuid(), false)), 1400000::bigint, 'switched on, ₹6,000 of his ₹20,000 cash-out is withheld');

-- The withholding ledger.
select results_eq(
  $$ select full_name, pan_last4 is not null, payments, paid_paise, withheld_paise, shadow_paise
     from public.tds_ledger('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date)
     where member_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values ('Ishaan Verma'::text, true, 2, 7000000::bigint, 600000::bigint, 1200000::bigint) $$,
  'the ledger: two cash-outs, ₹6,000 withheld and ₹12,000 that would have been while off');
select ok((select length(pan_last4) = 4 from public.tds_ledger('00000000-0000-4000-8000-000000000001', current_date - 1, current_date + 1)
           where member_id = '00000000-0000-4000-8000-000000000211'), 'with only the PAN''s last four characters');
select is_empty($$ select * from public.tds_ledger('00000000-0000-4000-8000-000000000001', current_date - 10, current_date - 5) $$,
  'and nothing in a period before');

-- The quarterly return extract.
select throws_ok($$ select * from public.tds_return_extract('00000000-0000-4000-8000-000000000001', (select starts from quarter)) $$,
  '42501', null, 'a cashier takes no return extract');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select full_name, pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$', section, taxed_winnings_paise, rate_basis_points, tds_paise
     from public.tds_return_extract('00000000-0000-4000-8000-000000000001', (select starts from quarter)) $$,
  $$ values ('Ishaan Verma'::text, true, '194B'::text, 2000000::bigint, 3000, 600000::bigint) $$,
  'the extract: the one deduction with his PAN, taxed on the ₹20,000 won above the ₹40,000 already taxed; never the shadow');
select throws_ok($$ select * from public.tds_return_extract('00000000-0000-4000-8000-000000000001', (select starts from quarter) + 1) $$,
  '22023', null, 'a quarter starts on its first day');
select throws_ok($$ select * from public.tds_return_extract('00000000-0000-4000-8000-000000000002', (select starts from quarter)) $$,
  '22023', null, 'the practice venue files no return');
reset role;
select is((select count(*)::integer from public.audit_log where action = 'export.tds_return' and venue_id = '00000000-0000-4000-8000-000000000001'),
  1, 'the extract is audited');
-- A check reopened since keeps the PAN the deduction was made against.
update public.kyc_record set status = 'started', verified_at = null where member_id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select pan <> 'PANNOTAVBL' from public.tds_return_extract('00000000-0000-4000-8000-000000000001', (select starts from quarter))),
  'a reopened identity check still gives the extract his PAN');
reset role;
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000211';
select is(private.tds_quarter_start('2026-12-31T20:00:00+05:30'), '2026-10-01'::date, 'October to December is one quarter');
select is(private.tds_quarter_start('2026-12-31T19:00:00Z'), '2027-01-01'::date, 'and New Year''s first hours in India are the next');

-- Certificate data, for the member himself.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq(
  $$ select tan, quarter_start = (select starts from quarter), section, length(pan_last4), payments, paid_paise, tds_paise
     from public.my_tds_certificates() $$,
  $$ values ('DELR12345E'::text, true, '194B'::text, 4, 1, 2000000::bigint, 600000::bigint) $$,
  'Ishaan''s certificate data: the club''s TAN, the quarter, and the TDS withheld from him');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_tds_certificates() $$, 'Mihir had none withheld, so Sessions shows no TDS');
select is_empty($$ select * from public.tds_ledger('00000000-0000-4000-8000-000000000001', current_date - 1, current_date + 1) $$,
  'nor does a member read the ledger');

-- The shareholding register.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_shareholder('00000000-0000-4000-8000-000000000001', 'Someone', 'partner') $$, '42501', null,
  'an admin keeps no register');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'partner', public.add_shareholder('00000000-0000-4000-8000-000000000001', ' Vikram Rao ', 'partner');
insert into ids select 'fund', public.add_shareholder('00000000-0000-4000-8000-000000000001', 'Seed Fund', 'investor');
select throws_ok($$ select public.add_shareholder('00000000-0000-4000-8000-000000000001', 'Nobody', 'friend') $$, '22023', null,
  'a holder is a partner or an investor');
select lives_ok($$ select public.record_holding('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'partner'), 6000, '2026-01-01', null) $$,
  'Vikram holds 60% from January');
select lives_ok($$ select public.record_holding('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'fund'), 4000, '2026-01-01', 'Seed round') $$,
  'and the fund 40%');
select throws_ok($$ select public.record_holding('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'fund'), 5000, '2026-06-01', null) $$,
  'RVSHR', null, 'never more than 100% on a day');
select lives_ok($$ select public.record_holding('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'partner'), 5000, '2026-06-01', 'Sold 10%') $$,
  'Vikram sells 10% from June');
select lives_ok($$ select public.record_holding('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'fund'), 5000, '2026-06-01', 'Bought 10%') $$,
  'to the fund');
select throws_ok($$ select public.record_holding('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'partner'), 7000, '2026-03-01', null) $$,
  'RVSHR', null, 'nor does a change on an earlier day push a later one above 100%');
select results_eq(
  $$ select name, basis_points, effective_from from public.shareholding_register('00000000-0000-4000-8000-000000000001', '2026-03-01')
     where shareholder_id in (select id from ids) $$,
  $$ values ('Vikram Rao'::text, 6000, '2026-01-01'::date), ('Seed Fund'::text, 4000, '2026-01-01'::date) $$,
  'the register in March: 60 and 40');
select results_eq(
  $$ select name, basis_points from public.shareholding_register('00000000-0000-4000-8000-000000000001', '2026-07-01')
     where shareholder_id in (select id from ids) $$,
  $$ values ('Seed Fund'::text, 5000), ('Vikram Rao'::text, 5000) $$, 'and in July: 50 and 50');
select lives_ok($$ select public.record_holding('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'partner'), 5000, '2026-06-01', 'Sold 10% on 1 June') $$,
  'a second record for the same day replaces the first');
select is((select count(*)::integer from public.shareholding_history('00000000-0000-4000-8000-000000000001')
           where shareholder_id in (select id from ids)), 4, 'so the history has four holdings');
select is((select note from public.shareholding_history('00000000-0000-4000-8000-000000000001') where name = 'Vikram Rao' and effective_from = '2026-06-01'),
  'Sold 10% on 1 June', 'with the note as last recorded');
select throws_ok($$ insert into public.shareholder (venue_id, name, kind) values ('00000000-0000-4000-8000-000000000001', 'Direct', 'partner') $$,
  '42501', null, 'the register is written only through the functions');
reset role;
select ok((select count(*) >= 5 from public.audit_log where entity = 'shareholding'), 'every holding recorded is audited, the replacement too');
select throws_ok($$ insert into public.role_permission (role, permission) values ('admin', 'shareholding.manage') $$, '23514', null,
  'no role but super admin can ever be given the register');
select is(private.computer_kind_for('shareholding.manage'), 'console'::public.device_kind, 'where a venue keeps money work to its computers, the register is the admin computer''s');
select is(private.computer_kind_for('exports.table'), 'console'::public.device_kind, 'and so is an extract with every PAN');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.shareholder $$, 'an admin sees no shareholders');
select is_empty($$ select * from public.shareholding_register('00000000-0000-4000-8000-000000000001', current_date) $$, 'nor the register');

select * from finish();
rollback;
