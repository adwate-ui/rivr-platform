-- AML (#105; decision 0234). The club's cash limits are ₹50,000 a visit and ₹1,00,000 a club day; just under is within
-- 10%, from ₹45,000. 213 Mihir bought in ₹46,000 in cash on a visit five days ago and ₹48,000 on one two days ago.
-- Tonight he buys in ₹10,000 four times, then pays a ₹5,000 tournament entry in cash: ₹45,000, a third such visit in
-- seven days, so the register gets an entry with that cash in and the owner is alerted. Vikram (101, a super admin)
-- reviews it; another ₹5,000 tournament entry in the same visit opens no second entry; the next cash is refused at
-- the visit's limit; UPI is not cash. With no visit limit and ₹60,000 a day, the day's limit refuses. Only a super
-- admin changes the limits, with a reason; Mihir's own data export leaves the register out; the audit log names
-- neither him nor the note. 104 Sana is a cashier; 103 Aditya an admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- An earlier visit, its seat, and its cash buy-ins, as the cage would have written them then.
create function pg_temp.past_visit(p_opened timestamptz, p_buy_ins bigint[]) returns void language plpgsql as $$
declare
  v_visit uuid;
  v_session uuid;
  v_paise bigint;
begin
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', p_opened, p_opened + interval '4 hours', 'cash_out')
  returning id into v_visit;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', v_visit,
          (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5'), 1,
          p_opened, p_opened, p_opened + interval '4 hours', 'cash_out')
  returning id into v_session;
  foreach v_paise in array p_buy_ins loop
    insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise, session_id, ledger_transaction_id, cashier_staff_id,
                                         idempotency_key, created_at)
    select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'buy_in', 'cash', v_paise, v_session,
           private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'buy_in', 'test-aml:' || gen_random_uuid(), jsonb_build_array(
             jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                               and a.code = 'venue.cash_drawer' and a.member_id is null), 'amount', v_paise::text),
             jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                               and a.code = 'venue.chips_outstanding' and a.member_id is null), 'amount', (-v_paise)::text)),
             null, 'Test buy-in'),
           (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001'),
           gen_random_uuid(), p_opened + interval '1 hour';
  end loop;
end;
$$;
create function pg_temp.buy_in(p_paise bigint) returns uuid language sql as $$
  select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', p_paise, 'cash', gen_random_uuid());
$$;
create function pg_temp.tournament(p_name text) returns uuid language sql security definer as $$ select id from public.tournament where name = p_name; $$;
create function pg_temp.enter_in_cash(p_name text) returns uuid language sql as $$
  select public.cage_tournament_entry(pg_temp.tournament(p_name), '00000000-0000-4000-8000-000000000213', 'entry', gen_random_uuid());
$$;
create function pg_temp.entries() returns integer language sql security definer as $$
  select count(*)::integer from public.sar_entry where member_id = '00000000-0000-4000-8000-000000000213';
$$;
grant execute on function pg_temp.buy_in(bigint), pg_temp.tournament(text), pg_temp.enter_in_cash(text), pg_temp.entries() to authenticated;

-- Two knockouts (₹5,000 an entry), tonight's visit and seat, and two earlier visits.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'AML One', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'AML Two', now(), true);
select public.set_tournament_room(pg_temp.tournament('AML One'), 2, 9), public.set_tournament_room(pg_temp.tournament('AML Two'), 2, 9);
select public.start_tournament_clock(pg_temp.tournament('AML One')), public.start_tournament_clock(pg_temp.tournament('AML Two'));
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000213'), null, 'Mihir checks in');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000213'),
  null, 'and sits at Table 3');
-- The database itself, as a migration or the seed is: no one signed in.
reset role;
select set_config('request.jwt.claims', '', true);
select pg_temp.past_visit(now() - interval '5 days', array[2000000, 2600000]::bigint[]);
select pg_temp.past_visit(now() - interval '2 days', array[4800000]::bigint[]);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'cage.cash_buy_in_limit', '', '{"per_visit_paise": 5000000, "per_day_paise": 10000000}',
        now() - interval '1 minute', 'AML test');

-- Tonight.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(pg_temp.buy_in(1000000), null, '₹10,000 in cash: within both limits');
select pg_temp.buy_in(1000000), pg_temp.buy_in(1000000), pg_temp.buy_in(1000000);
select is(pg_temp.entries(), 0, '₹40,000 tonight is not yet near the visit''s ₹50,000, so nothing is flagged');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 1000000, 'upi', gen_random_uuid(),
                               '613700000001'), null, 'a UPI buy-in is not cash, and counts for nothing here');
select isnt(pg_temp.enter_in_cash('AML One'), null, 'a ₹5,000 tournament entry in cash: ₹45,000 tonight, just under the limit');
-- The database itself, as a migration or the seed is: no one signed in.
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq($$ select e.kind, e.status, count(x.cage_transaction_id)::integer, count(x.tournament_purchase_id)::integer
                     from public.sar_entry e join public.sar_entry_transaction x on x.sar_entry_id = e.id
                     where e.member_id = '00000000-0000-4000-8000-000000000213' group by e.kind, e.status $$,
  $$ values ('structuring_visit'::text, 'open'::text, 7, 1) $$,
  'three visits in seven days just under the limit: an entry with the seven cash buy-ins and the tournament entry');
select results_eq($$ select detail ->> 'kind' from public.alert where kind = 'aml.structuring' and detail ->> 'entry' =
                       (select id::text from public.sar_entry where member_id = '00000000-0000-4000-8000-000000000213') $$,
  $$ values ('structuring_visit'::text) $$, 'and the owner is alerted, with no personal data');
select results_eq($$ select after from public.audit_log where action = 'aml.flag' and entity_id =
                       (select id::text from public.sar_entry where member_id = '00000000-0000-4000-8000-000000000213') $$,
  $$ values ('{"kind": "structuring_visit"}'::jsonb) $$, 'the audit log has the entry and its kind, no member');

-- The register, for those who review AML.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.aml_register('00000000-0000-4000-8000-000000000001') $$, 'a cashier sees no register');
select throws_ok($$ select public.review_sar_entry((select id from public.sar_entry limit 1), 'monitor', 'Watching his cash buy-ins') $$,
  '42501', null, 'nor reviews it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select full_name, kind, status, cash_paise, jsonb_array_length(buy_ins),
                            (select count(*)::integer from jsonb_array_elements(buy_ins) b where b ->> 'source' = 'tournament')
                     from public.aml_register('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values ('Mihir Shah'::text, 'structuring_visit'::text, 'open'::text, 13900000::bigint, 8, 1) $$,
  'Vikram reads the entry: Mihir, the pattern, and ₹1,39,000 in eight cash ins, one a tournament entry');
create temp table entry as select entry_id as id from public.aml_register('00000000-0000-4000-8000-000000000001')
  where member_id = '00000000-0000-4000-8000-000000000213';
select throws_ok($$ select public.review_sar_entry((select id from entry), 'monitor', 'Short') $$, '22023', null, 'a note of ten characters or more');
select throws_ok($$ select public.review_sar_entry((select id from entry), 'ignored', 'Watching his cash buy-ins') $$, '22023', null,
  'an outcome that is one of no action, monitor or reported');
select lives_ok($$ select public.review_sar_entry((select id from entry), 'monitor', ' Watching his cash buy-ins for a month ') $$,
  'Vikram reviews it: monitor, with a note');
select results_eq($$ select status, outcome, note, reviewed_by from public.aml_register('00000000-0000-4000-8000-000000000001')
                     where member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values ('reviewed'::text, 'monitor'::text, 'Watching his cash buy-ins for a month'::text, 'Vikram Rao'::text) $$, 'reviewed, by him, with the note');
select throws_ok($$ select public.review_sar_entry((select id from entry), 'reported', 'Reported to the FIU after all') $$, '22023', null,
  'an entry is reviewed once');
-- The database itself, as a migration or the seed is: no one signed in.
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq($$ select after from public.audit_log where action = 'aml.review' and entity_id = (select id::text from entry) $$,
  $$ values ('{"outcome": "monitor"}'::jsonb) $$, 'the review is audited with its outcome, not the note');
select is_empty($$ select 1 from public.audit_log where entity = 'sar_entry' and (after ? 'note' or after ? 'member_id' or before is not null) $$,
  'no audit row about the register holds the note or the member');

-- The visit reviewed opens no second entry; the limit holds; tournament cash counts.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(pg_temp.enter_in_cash('AML Two'), null, 'another ₹5,000 tournament entry: ₹50,000 tonight, exactly the limit');
select is(pg_temp.entries(), 1, 'the visit was reviewed, so no second entry');
select throws_ok($$ select pg_temp.buy_in(1000000) $$, 'RVCLV', null, 'a cash buy-in past the visit''s limit is refused');

-- The day's limit: no visit limit, ₹60,000 a club day; ₹50,000 in cash tonight already.
-- The database itself, as a migration or the seed is: no one signed in.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'cage.cash_buy_in_limit', '', '{"per_visit_paise": 0, "per_day_paise": 6000000}',
        now() - interval '30 seconds', 'AML test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(pg_temp.buy_in(1000000), null, '₹10,000 reaches the club day''s ₹60,000: within');
select throws_ok($$ select pg_temp.buy_in(1000000) $$, 'RVCLD', null, 'another is past it: refused');

-- Only a super admin changes the AML settings, with a reason; the owner hears.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'cage.cash_buy_in_limit', '', '{"per_visit_paise": 0, "per_day_paise": 0}', now() + interval '1 day', 'Off') $$,
  '42501', null, 'an admin who changes settings does not change the AML limits');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from)
  values ('00000000-0000-4000-8000-000000000001', 'aml.structuring', '', '{"count": 4, "window_days": 7, "margin_basis_points": 1000}', now() + interval '1 day') $$,
  '22023', null, 'a super admin gives a reason');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'aml.structuring', '', '{"count": 4, "window_days": 7, "margin_basis_points": 1000}', now() + interval '1 day',
          'Fewer false alarms') $$, 'and changes them');
-- The database itself, as a migration or the seed is: no one signed in.
reset role;
select set_config('request.jwt.claims', '', true);
select ok(exists (select 1 from public.alert where kind = 'aml.settings_changed' and detail ->> 'key' = 'aml.structuring'), 'the owner is alerted');

-- No one is tipped off: Mihir's own data export leaves the register out; the full archive keeps it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select ok((select not p -> 'tables' @> '[{"name": "sar_entry"}]' and not p -> 'tables' @> '[{"name": "sar_entry_transaction"}]'
           from (select public.start_export_archive('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') as p) a),
  'a member''s own data export does not hold the register');
select ok((select p -> 'tables' @> '[{"name": "sar_entry"}]' from (select public.start_export_archive('00000000-0000-4000-8000-000000000001') as p) a),
  'the full archive, locked to the owner''s key, does');

-- The database itself, as a migration or the seed is: no one signed in.
reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok($$ delete from public.sar_entry_transaction $$, null, null, 'the register''s cash in is never taken away');
select ok(not has_function_privilege('authenticated', 'private.flag_structuring(uuid, uuid, uuid, text, bigint, jsonb)', 'execute'),
  'no client flags anything itself');

select * from finish();
rollback;
