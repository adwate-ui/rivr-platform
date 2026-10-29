-- A member's own session history (#127). Ishaan (211) checks in, sits at Table 3 for three hours, buys in ₹10,000 and
-- cashes out ₹50,000 with TDS on per session: ₹40,000 won owes ₹12,000, so he is paid ₹38,000 and is up ₹28,000.
-- Kunal (216) plays on a ₹50,000 marker and ₹10,000 of bonus chips and cashes out ₹80,000: ₹30,000 won owes ₹9,000,
-- the marker settles first, so he is paid ₹21,000 and is up ₹21,000, his bonus chips shown apart.
-- 103 Aditya is the floor manager; 104 Sana a cashier; 201 Arjun another member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000211'), null, 'Ishaan checks in');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'and sits at Table 3');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'Sessions test'), null,
  'he may leave before his call time');
reset role;
-- Three hours ago, since everything in one transaction happens at one moment.
update public.visit set opened_at = now() - interval '3 hours' where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null;
update public.seat_session set started_at = now() - interval '3 hours', seated_here_at = now() - interval '3 hours'
where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": true, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "session", "pan_required": true, "no_pan_rate_basis_points": 3000}',
        now() - interval '3 seconds', 'Sessions test');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', gen_random_uuid()),
  null, 'Sana issues him ₹10,000 of chips');
select is((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
  5000000, 'cash', '00000000-0000-4000-8000-0000000c5701', true)), 3800000::bigint, 'and cashes him out: ₹38,000 after ₹12,000 of TDS');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq(
  $$ select table_name, other_tables, played_seconds, buy_in_paise, bonus_paise, cash_out_paise, tds_paise, paid_paise, net_paise
     from public.my_sessions() $$,
  $$ values ('Table 3'::text, 0, 10800::bigint, 1000000::bigint, 0::bigint, 5000000::bigint, 1200000::bigint, 3800000::bigint, 2800000::bigint) $$,
  'his session: Table 3 for three hours, ₹10,000 in, ₹50,000 out, ₹12,000 TDS, ₹38,000 paid, up ₹28,000');
select is((select receipt from public.my_sessions()),
  (select upper(left(id::text, 8)) from public.cage_transaction where idempotency_key = '00000000-0000-4000-8000-0000000c5701'),
  'with the cash-out''s receipt, as the cage printed it');
select is((select tds_basis from public.my_sessions()), 'session', 'and the basis its TDS was withheld on (#563)');
select results_eq(
  $$ select month, month_sessions, month_played_seconds, month_net_paise from public.my_sessions() $$,
  $$ select date_trunc('month', (now() - interval '3 hours') at time zone 'Asia/Kolkata' - interval '6 hours')::date, 1, 10800::bigint, 2800000::bigint $$,
  'and the club month''s totals');
select results_eq($$ select small_blind_paise, big_blind_paise from public.my_sessions() $$,
  $$ select tt.small_blind_paise, tt.big_blind_paise from public.game_table g join public.table_type tt on tt.id = g.table_type_id
     where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3' $$, 'at Table 3''s stakes');
reset role;

-- A visit still open is not history yet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000211'), null, 'he comes back');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'and sits again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.my_sessions()), 1, 'his open visit is not listed');

-- Markers count as money in, bonus chips apart; the marker settles from the cash-out first.
reset role;
select set_config('request.jwt.claims', '', true);
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, 'Sessions test',
  now() + interval '2 days', 'test:sessions:bonus') is not null as credited;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000000, 'A regular'), 'active', 'Kunal has ₹50,000 of credit');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 4, '9000000216'),
  null, 'and sits at Table 3');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'Sessions test'), null,
  'he may leave before his call time');
reset role;
update public.visit set opened_at = now() - interval '2 hours' where member_id = '00000000-0000-4000-8000-000000000216' and closed_at is null;
update public.seat_session set started_at = now() - interval '2 hours', seated_here_at = now() - interval '2 hours'
where member_id = '00000000-0000-4000-8000-000000000216' and ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 5000000,
  'M10 40 C 30 10, 50 70, 70 40', gen_random_uuid()), null, 'Sana issues him ₹50,000 on a marker');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, 'bonus', gen_random_uuid()),
  null, 'and ₹10,000 of chips from his bonus');
select is((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
  8000000, 'cash', '00000000-0000-4000-8000-0000000c5702', true)), 2100000::bigint, 'he cashes out ₹80,000: ₹21,000 after the marker and ₹9,000 of TDS');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select results_eq(
  $$ select buy_in_paise, bonus_paise, cash_out_paise, tds_paise, paid_paise, net_paise from public.my_sessions() $$,
  $$ values (5000000::bigint, 1000000::bigint, 8000000::bigint, 900000::bigint, 2100000::bigint, 2100000::bigint) $$,
  'his session: the marker is money in, the bonus chips apart; paid ₹21,000, up ₹21,000');
select is((select count(*)::integer from public.my_sessions()), 1, 'his earlier visits, at which he never sat, are not sessions');
reset role;

-- No one reads another member's sessions: Ishaan's visits, kept before reading as Arjun, whose own policy hides them.
create temp table ishaan_visits as select id from public.visit where member_id = '00000000-0000-4000-8000-000000000211';
grant select on ishaan_visits to authenticated;
select ok((select count(*) from ishaan_visits) >= 1, 'Ishaan has visits to hide');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.my_sessions() where visit_id in (select id from ishaan_visits)), 0, 'Arjun does not see Ishaan''s');
reset role;

-- A tournament is a session of its own (#549): Mihir plays a knockout, places first of one and wins ₹3,000 (under the
-- ₹10,000 TDS threshold); once it finishes, his history has it with what he paid in and won.
create function pg_temp.named(p_name text) returns uuid language sql security definer as $$ select id from public.tournament where name = p_name; $$;
grant execute on function pg_temp.named(text) to authenticated;
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-fund:sessions', jsonb_build_array(
  jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                    and a.code = 'venue.bank' and a.member_id is null), 'amount', '5000000'),
  jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = '00000000-0000-4000-8000-000000000213'
                                    and a.code = 'member.cash'), 'amount', '-5000000')), null, 'Test deposit') is not null as funded;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'Sessions Knockout', now(), true) $$, 'a knockout');
select public.set_tournament_room(pg_temp.named('Sessions Knockout'), 2, 9);
select public.start_tournament_clock(pg_temp.named('Sessions Knockout'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Sessions Knockout'), 'entry', '00000000-0000-4000-8000-00000000f157');
select is((select count(*)::integer from public.my_sessions() where kind = 'tournament'), 0, 'a tournament not yet finished is not a session');
reset role;
select private.pay_tournament_run((select id from public.tournament_entry where tournament_id = pg_temp.named('Sessions Knockout')
                                   and member_id = '00000000-0000-4000-8000-000000000213'), 1, 300000, 0, 0, null);
update public.tournament set finished_at = now(), overlay_paise = 0 where id = pg_temp.named('Sessions Knockout');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq(
  $$ select table_name, kind, place, entrants, buy_in_paise, cash_out_paise, tds_paise, paid_paise, net_paise
     from public.my_sessions() where kind = 'tournament' $$,
  $$ select 'Sessions Knockout'::text, 'tournament'::text, 1, 1, sum(p.price_paise)::bigint, 300000::bigint, 0::bigint, 300000::bigint,
            (300000 - sum(p.price_paise))::bigint
     from public.tournament_purchase p where p.tournament_id = pg_temp.named('Sessions Knockout') $$,
  'his tournament: first of one, what he paid in, ₹3,000 won and paid');
reset role;

-- A member hides a session from their own list (#627): Kunal hides his, and the club still has the visit. Arjun hiding
-- Ishaan's changes only Arjun's list.
create temp table kunal_session as select id from public.visit
where member_id = '00000000-0000-4000-8000-000000000216' and opened_at = now() - interval '2 hours';
grant select on kunal_session to authenticated;
create temp table ishaan_session as select id from public.visit
where member_id = '00000000-0000-4000-8000-000000000211' and opened_at = now() - interval '3 hours';
grant select on ishaan_session to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select lives_ok($$ select public.hide_my_session((select id from kunal_session)) $$, 'Kunal hides his session');
select lives_ok($$ select public.hide_my_session((select id from kunal_session)) $$, 'and hiding it again changes nothing');
select is((select count(*)::integer from public.my_sessions()), 0, 'his list leaves it out');
select throws_ok($$ select public.hide_my_session(null) $$, '22023', null, 'hiding nothing is refused');
reset role;
select is((select hidden_sessions from public.member_preference where member_id = '00000000-0000-4000-8000-000000000216'),
  array[(select id from kunal_session)], 'it is on his list once');
select is((select count(*)::integer from public.visit where id in (select id from kunal_session)), 1, 'and the club keeps the visit');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.hide_my_session((select id from ishaan_session)) $$, '22023', null,
  'Arjun cannot hide Ishaan''s session: only one of his own');
select throws_ok($$ select public.hide_my_session(gen_random_uuid()) $$, '22023', null, 'nor any id that is no session of his');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.my_sessions()), 1, 'and Ishaan still sees his session');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.hide_my_session((select id from kunal_session)) $$, '42501', null, 'staff have no sessions to hide');
reset role;
select is(has_function_privilege('anon', 'public.hide_my_session(uuid)', 'execute'), false, 'nobody signed out hides one');

-- A tier without session history reads none.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select m.venue_id, m.tier_id, 'sessions.history', false, 'locked' from public.member m where m.id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.my_sessions()), 0, 'without sessions.history in his tier, he reads none');
select throws_ok($$ select public.hide_my_session((select id from ishaan_session)) $$, '42501', null, 'and hides none (rule 8)');
reset role;

select is(has_function_privilege('anon', 'public.my_sessions()', 'execute'), false, 'nobody signed out reads sessions');

select * from finish();
rollback;
