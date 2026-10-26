-- Tournament payouts (#117, #121, #149; decisions 0205, 0206): a guaranteed RIVR Sunday played out, a
-- progressive knockout finished with an ICM deal, and a turbo whose last player was busted too. 213 Mihir,
-- 214 Yash and 215 Ritika are members with their identity checks done; 103 Aditya an admin
-- (tournaments.manage); Elsewhere's admin runs nothing at the club.
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
create function pg_temp.balance(p_code text) returns bigint language sql security definer as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is null;
$$;
create function pg_temp.named(p_name text) returns uuid language sql security definer as $$ select id from public.tournament where name = p_name; $$;
create function pg_temp.run(p_name text, p_member uuid) returns uuid language sql security definer as $$
  select id from public.tournament_entry where tournament_id = pg_temp.named(p_name) and member_id = p_member order by entry_number desc limit 1;
$$;
grant execute on function pg_temp.named(text), pg_temp.run(text, uuid), pg_temp.balance(text) to authenticated;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');
select pg_temp.fund('00000000-0000-4000-8000-000000000213', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000214', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000215', 5000000);
create temporary table before on commit drop as
  select pg_temp.balance('venue.tournament_pool') as pool, pg_temp.balance('venue.tournament_overlay') as overlay,
         private.wallet_cash('00000000-0000-4000-8000-000000000215') as ritika;
grant select on before to authenticated;

-- private.credit_wallet, the twin of private.debit_wallet.
select throws_ok($$ select private.credit_wallet('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 0, 'test_credit',
                                                 'test-credit-0', '[]', 0) $$, '22023', null, 'credit_wallet credits something');
select throws_ok($$ select private.credit_wallet('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 5000, 'test_credit',
                                                 'test-credit-1', '[{"code": "venue.nothing", "amount": 5000}]', 0) $$, '22023', null,
  'from venue accounts that exist');
select throws_ok($$ select private.credit_wallet('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 5000, 'test_credit',
                                                 'test-credit-2', '[{"code": "venue.tournament_pool", "amount": 5000}]', 6000) $$, '22023', null,
  'with the TDS within the amount');
select ok(not has_function_privilege('authenticated', 'private.credit_wallet(uuid, uuid, bigint, text, text, jsonb, bigint)', 'execute')
          and not has_function_privilege('authenticated', 'private.pay_tournament_run(uuid, integer, bigint, bigint, bigint, uuid)', 'execute')
          and not has_function_privilege('anon', 'public.finish_tournament(uuid, text, jsonb)', 'execute'),
  'no client credits a wallet or pays a run, and no one signed out finishes a tournament');

-- A RIVR Sunday (top 8, ₹5,00,000 guaranteed) in a room of one table of two seats, its clock started.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.create_tournament('00000000-0000-4000-8000-0000000007c1', 'Payout Sunday', now(), true) $$, 'a tournament');
select public.set_tournament_room(pg_temp.named('Payout Sunday'), 1, 2);
select public.start_tournament_clock(pg_temp.named('Payout Sunday'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Payout Sunday'), 'entry', '00000000-0000-4000-8000-00000000f101');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select public.register_tournament_entry(pg_temp.named('Payout Sunday'), 'entry', '00000000-0000-4000-8000-00000000f102');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select public.register_tournament_entry(pg_temp.named('Payout Sunday'), 'entry', '00000000-0000-4000-8000-00000000f103');
select throws_ok($$ select public.finish_tournament(pg_temp.named('Payout Sunday')) $$, '42501', null, 'a member finishes nothing');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.finish_tournament(pg_temp.named('Payout Sunday')) $$, 'RVTRN', null, 'the floor sets the places'' shares first');
select throws_ok($$ select public.set_tournament_payouts(pg_temp.named('Payout Sunday'), array[3000, 2000, 1400, 1000, 800, 700, 600, 400]) $$,
  '22023', null, 'shares adding up to 99% are refused');
select throws_ok($$ select public.set_tournament_payouts(pg_temp.named('Payout Sunday'), array[2000, 3000, 5000]) $$,
  '22023', null, 'and a lower place paid more than the one above');
select lives_ok($$ select public.set_tournament_payouts(pg_temp.named('Payout Sunday'), array[3000, 2000, 1400, 1000, 800, 700, 600, 500]) $$,
  'the floor pays the top 8 at 30, 20, 14, 10, 8, 7, 6 and 5%');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.set_tournament_payouts(pg_temp.named('Payout Sunday'), array[10000]) $$, '42501', null,
  'another venue''s admin sets no payouts here');
select throws_ok($$ select public.finish_tournament(pg_temp.named('Payout Sunday')) $$, '42501', null, 'nor finishes it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.finish_tournament(pg_temp.named('Payout Sunday')) $$, 'RVTRN', null,
  'an alternate who never sat must be refunded first, or they would count as a run');
select is(public.bust_tournament_entry(pg_temp.run('Payout Sunday', '00000000-0000-4000-8000-000000000213')), 3, 'Mihir is out third; Ritika sits');
select throws_ok($$ select public.set_tournament_payouts(pg_temp.named('Payout Sunday'), array[10000]) $$, 'RVTRN', null,
  'with a player out in the money, the payouts stay as they are');
select throws_ok($$ select public.finish_tournament(pg_temp.named('Payout Sunday')) $$, 'RVTRN', null, 'played out needs one player left');
select throws_ok($$ select public.finish_tournament(pg_temp.named('Payout Sunday'), 'icm', '{}') $$, '22023', null, 'a deal needs every stack');
select throws_ok($$ select public.bust_tournament_entry(pg_temp.run('Payout Sunday', '00000000-0000-4000-8000-000000000214'),
                                                        pg_temp.run('Payout Sunday', '00000000-0000-4000-8000-000000000215')) $$, '22023', null,
  'no one knocks out a bounty where there is none');
select is(public.bust_tournament_entry(pg_temp.run('Payout Sunday', '00000000-0000-4000-8000-000000000214')), 2, 'Yash is out second');
select lives_ok($$ select public.finish_tournament(pg_temp.named('Payout Sunday')) $$, 'Ritika wins: the floor finishes and pays out');
select lives_ok($$ select public.finish_tournament(pg_temp.named('Payout Sunday')) $$, 'the same finish again changes nothing');

-- Three runs put in ₹27,000; the club adds ₹4,73,000 to the guarantee; three places are paid.
select results_eq($$ select p.place, p.prize_paise, p.bounty_paise, p.tds_paise, p.is_tds_shadow, m.full_name
                     from public.tournament_payouts(pg_temp.named('Payout Sunday')) p join public.member m on m.id = p.member_id $$,
  $$ values (1, 23440000::bigint, 0::bigint, 7032000::bigint, true, 'Ritika Das'::text), (2, 15625000::bigint, 0::bigint, 4687500::bigint, true, 'Yash Gupta'::text),
            (3, 10935000::bigint, 0::bigint, 3280500::bigint, true, 'Mihir Shah'::text) $$,
  'three runs: places 1 to 3 share ₹5,00,000 at 30 : 20 : 14, TDS shadow while switched off');
select is((select overlay_paise from public.tournament where id = pg_temp.named('Payout Sunday')), 47300000::bigint, 'the overlay is kept');
reset role;
select is(pg_temp.balance('venue.tournament_overlay') - (select overlay from before), 47300000::bigint, 'and booked to the overlay expense');
select is(pg_temp.balance('venue.tournament_pool'), (select pool from before), 'the pool pays out to nothing');
select is(private.wallet_cash('00000000-0000-4000-8000-000000000215') - (select ritika from before), 23440000::bigint - 1000000,
  'Ritika''s wallet has her ₹2,34,400, less her entry');
select results_eq($$ select m.full_name, f.place, f.points from public.league_finish f join public.member m on m.id = f.member_id
                     where f.tournament_id = pg_temp.named('Payout Sunday') order by f.place $$,
  $$ values ('Ritika Das'::text, 1, 105::bigint), ('Yash Gupta', 2, 75), ('Mihir Shah', 3, 55) $$,
  'each place earns its League points, and the entry its own');
select is((select count(*)::integer from public.outbox_event where event_type = 'tournament.finished'
           and payload ->> 'tournament_id' = pg_temp.named('Payout Sunday')::text), 1, 'tournament.finished, once');

-- Finished: no more buys or busts, and Home and the TVs let it go.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.register_tournament_entry(pg_temp.named('Payout Sunday'), 're_entry', '00000000-0000-4000-8000-00000000f104') $$,
  'RVTRN', null, 'a finished tournament takes no re-entry');
select is_empty($$ select 1 from public.my_tournament() where id = pg_temp.named('Payout Sunday') $$, 'Home no longer shows it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.bust_tournament_entry(pg_temp.run('Payout Sunday', '00000000-0000-4000-8000-000000000215')) $$, 'RVTRN', null,
  'nor a bust');
select throws_ok($$ select public.set_tournament_payouts(pg_temp.named('Payout Sunday'), array[10000]) $$, 'RVTRN', null, 'nor new shares');
select results_eq($$ select finished_at is not null, overlay_paise from public.venue_tournaments('00000000-0000-4000-8000-000000000001')
                     where id = pg_temp.named('Payout Sunday') $$, $$ values (true, 47300000::bigint) $$, 'the console reads the finish');

-- Who sees what was paid: a member their own, and another venue's staff nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select results_eq($$ select place, prize_paise from public.tournament_payout $$, $$ values (2, 15625000::bigint) $$, 'Yash sees his own prize only');
select is_empty($$ select * from public.tournament_payouts(pg_temp.named('Payout Sunday')) $$, 'and not the floor''s list');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select 1 from public.tournament_payout $$, 'another venue''s admin sees no payouts here');
select is_empty($$ select * from public.tournament_payouts(pg_temp.named('Payout Sunday')) $$, 'nor the list');
reset role;

-- TDS switched on, withheld above ₹5,000. A progressive knockout: ₹5,000 with a ₹500 fee and ₹1,000 on each head.
reset role;
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": true, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 500000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
        now() - interval '1 minute', 'Test');
create temporary table knockout_before on commit drop as
  select pg_temp.balance('venue.tournament_pool') as pool, pg_temp.balance('venue.tds_payable') as tds;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'Test Knockout', now(), true) $$, 'a knockout');
select public.set_tournament_room(pg_temp.named('Test Knockout'), 2, 9);
select public.start_tournament_clock(pg_temp.named('Test Knockout'));
-- Top 3 at 50, 30 and 20%.
select public.set_tournament_payouts(pg_temp.named('Test Knockout'), array[5000, 3000, 2000]);
reset role;
update public.tournament set bounty_kind = 'progressive' where id = pg_temp.named('Test Knockout');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Test Knockout'), 'entry', '00000000-0000-4000-8000-00000000f201');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select public.register_tournament_entry(pg_temp.named('Test Knockout'), 'entry', '00000000-0000-4000-8000-00000000f202');
create function pg_temp.table_of(p_member uuid) returns integer language sql security definer as $$
  select table_number from public.tournament_entry where id = pg_temp.run('Test Knockout', p_member);
$$;
grant execute on function pg_temp.table_of(uuid) to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.bust_tournament_entry(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000213'),
                                                        pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000214')) $$, '22023', null,
  'Yash, at the other table, knocks out no one at Mihir''s');
select public.move_tournament_entry(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000214'),
                                    pg_temp.table_of('00000000-0000-4000-8000-000000000213'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select public.register_tournament_entry(pg_temp.named('Test Knockout'), 'entry', '00000000-0000-4000-8000-00000000f203');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.move_tournament_entry(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000215'),
                                    pg_temp.table_of('00000000-0000-4000-8000-000000000213'));
select throws_ok($$ select public.bust_tournament_entry(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000213')) $$, '22023', null,
  'a bounty goes to whoever knocked them out');
select is(public.bust_tournament_entry(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000213'),
                                       pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000214')), 3, 'Yash knocks Mihir out');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Test Knockout'), 're_entry', '00000000-0000-4000-8000-00000000f204');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.move_tournament_entry(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000213'),
                                    pg_temp.table_of('00000000-0000-4000-8000-000000000215'))
where pg_temp.table_of('00000000-0000-4000-8000-000000000213') <> pg_temp.table_of('00000000-0000-4000-8000-000000000215');
select is(public.bust_tournament_entry(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000215'),
                                       pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000213')), 3, 'Mihir, re-entered, knocks Ritika out');
select results_eq($$ select m.full_name, p.bounty_paise, p.head_paise from public.tournament_payout p join public.member m on m.id = p.member_id
                     where p.tournament_id = pg_temp.named('Test Knockout') and p.kind = 'bounty' order by m.full_name $$,
  $$ values ('Mihir Shah'::text, 50000::bigint, 50000::bigint), ('Yash Gupta', 50000, 50000) $$,
  'each is paid half the ₹1,000 bounty, and half goes on their own head');
select is((select pool_paise from public.venue_tournaments('00000000-0000-4000-8000-000000000001') where id = pg_temp.named('Test Knockout')),
  1400000::bigint, 'four runs put ₹14,000 in the prize pool, the bounties apart');

-- ₹7,000, ₹4,200 and ₹2,800. An ICM deal between Yash (40,000 chips) and Mihir (20,000) for the first two:
-- Yash ₹6,100 and Mihir ₹5,100. Four runs bought 60,000 chips, so no more can be counted.
select throws_ok(format($$ select public.finish_tournament(%L, 'icm', %L) $$, pg_temp.named('Test Knockout'),
                        jsonb_build_object(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000214'), 50000,
                                           pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000213'), 20000)), '22023', null,
  'stacks above the chips bought are refused');
select throws_ok(format($$ select public.finish_tournament(%L, 'icm', %L) $$, pg_temp.named('Test Knockout'),
                        jsonb_build_object(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000214'), 40000)), '22023', null,
  'every player left gives their chips');
select lives_ok(format($$ select public.finish_tournament(%L, 'icm', %L) $$, pg_temp.named('Test Knockout'),
                       jsonb_build_object(pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000214'), 40000,
                                          pg_temp.run('Test Knockout', '00000000-0000-4000-8000-000000000213'), 20000)), 'the deal finishes it');
select results_eq($$ select p.place, p.full_name, p.entry_number, p.prize_paise, p.bounty_paise, p.tds_paise, p.is_tds_shadow
                     from public.tournament_payouts(pg_temp.named('Test Knockout')) p where p.kind = 'prize' $$,
  $$ values (1, 'Yash Gupta'::text, 1, 610000::bigint, 150000::bigint, 228000::bigint, false),
            (2, 'Mihir Shah', 2, 510000, 150000, 198000, false), (3, 'Ritika Das', 1, 280000, 0, 0, false) $$,
  'the deal, each one''s own bounty, and third''s prize; 30% withheld above ₹5,000');
reset role;
select is(pg_temp.balance('venue.tournament_pool'), (select pool from knockout_before), 'every rupee in comes out: prizes and bounties');
select is(pg_temp.balance('venue.tds_payable') - (select tds from knockout_before), -426000::bigint, 'the TDS withheld is owed');
select results_eq($$ select m.full_name, f.place from public.league_finish f join public.member m on m.id = f.member_id
                     where f.tournament_id = pg_temp.named('Test Knockout') order by f.place $$,
  $$ values ('Yash Gupta'::text, 1), ('Mihir Shah', 2), ('Ritika Das', 3) $$, 'Mihir''s best run earns his League points');
select results_eq($$ select deal_method, (select sum(s.value::text::bigint) from jsonb_each(deal_stacks) s)::bigint from public.tournament
                     where id = pg_temp.named('Test Knockout') $$, $$ values ('icm'::text, 60000::bigint) $$, 'the deal and its stacks are kept');

-- A Weeknight Turbo (₹3,000 with a ₹300 fee) whose last player was busted too: the last out wins.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Last Out', now(), true);
select public.start_tournament_clock(pg_temp.named('Last Out'));
select public.set_tournament_payouts(pg_temp.named('Last Out'), array[10000]);
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Last Out'), 'entry', '00000000-0000-4000-8000-00000000f301');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select public.register_tournament_entry(pg_temp.named('Last Out'), 'entry', '00000000-0000-4000-8000-00000000f302');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create function pg_temp.last_run(p_member uuid) returns uuid language sql security definer as $$
  select id from public.tournament_entry where tournament_id = pg_temp.named('Last Out') and member_id = p_member;
$$;
grant execute on function pg_temp.last_run(uuid) to authenticated;
select public.bust_tournament_entry(pg_temp.last_run('00000000-0000-4000-8000-000000000213'));
select public.bust_tournament_entry(pg_temp.last_run('00000000-0000-4000-8000-000000000214'));
select lives_ok($$ select public.finish_tournament(pg_temp.named('Last Out')) $$, 'with nobody left, it still finishes');
select results_eq($$ select p.place, p.full_name, p.prize_paise from public.tournament_payouts(pg_temp.named('Last Out')) p $$,
  $$ values (1, 'Yash Gupta'::text, 540000::bigint) $$, 'the last out takes first place and the whole ₹5,400');

select * from finish();
rollback;
