-- Bad-beat payouts (#48 part 2): an admin pays a bad beat at Table 3, Arjun the loser, Kabir the
-- winner and four others dealt in, under the seeded rule (the whole main pool; 50% loser, 25%
-- winner, 25% shared). On the seed's ₹3,42,600 pool: ₹1,71,300, ₹85,650 and ₹21,400 each, in whole
-- chips, ₹3,42,550 in all; ₹50 stays. The main pool pays it into chips in play, once however often
-- it is sent; jackpot.paid goes out. A reversal posts it back, once. Refused for a dealer, for
-- someone not a member, for the same member twice, with promotions switched off, and while frozen.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Pays as the console does, sending the rule it showed: the one in force (#309).
create function pg_temp.pay(p_venue uuid, p_table uuid, p_loser text, p_winner text, p_others text[], p_total bigint, p_key text)
returns uuid language sql as $$
  select public.pay_bad_beat(p_venue, p_table, p_loser, p_winner, p_others, p_total, private.setting_at(p_venue, 'jackpot.payout', '', now()), p_key);
$$;
grant execute on function pg_temp.pay(uuid, uuid, text, text, text[], bigint, text) to authenticated;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.natural(p_code text) returns bigint language sql as $$
  select natural_balance from public.ledger_balance where venue_id = '00000000-0000-4000-8000-000000000001' and code = p_code;
$$;
create function pg_temp.table3() returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
$$;
grant execute on function pg_temp.as_person(text), pg_temp.table3() to authenticated;
-- Read by staff as themselves below.
create temporary table before_balances on commit drop as
select pg_temp.natural('venue.jackpot.main') as main, pg_temp.natural('venue.chips_outstanding') as chips;
grant select on before_balances to authenticated;

-- An admin pays the bad beat.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temporary table payout on commit drop as
select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                           array['+919000000203', '+919000000204', '+919000000209', '+919000000210'], 34255000, 'bad-beat-request-1') as event_id;
grant select on payout to authenticated;
select is((select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                                       array['+919000000203', '+919000000204', '+919000000209', '+919000000210'], 34255000, 'bad-beat-request-1')),
          (select event_id from payout), 'the same request again is the same payout');
select results_eq(
  $$ select loser_name, winner_name, others, loser_paise, winner_paise, each_at_table_paise, total_paise, is_reversed
     from public.jackpot_history('00000000-0000-4000-8000-000000000001') h join payout p on p.event_id = h.event_id $$,
  $$ values ('Arjun Mehta', 'Kabir Sethi', 4, 17130000::bigint, 8565000::bigint, 2140000::bigint, 34255000::bigint, false) $$,
  'loser ₹1,71,300, winner ₹85,650, ₹21,400 to each of four others: ₹3,42,550 in whole chips');
select results_eq($$ select main_paise from public.jackpot_pools('00000000-0000-4000-8000-000000000001') $$, $$ values (5000::bigint) $$,
  'the ₹50 that rounds away stays in the main pool');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000211', '+919000000212',
                     '{}', 0, 'bad-beat-request-2') $$, '22023', 'The pool pays nothing yet', 'a pool too small for a chip each pays nothing');
reset role;
select is((select chips from before_balances) - pg_temp.natural('venue.chips_outstanding'), -34255000::bigint,
  'the payout goes into play as chips');
select is((select count(*)::integer from public.ledger_transaction t join payout p on t.idempotency_key = 'jackpot:' || p.event_id), 1,
  'in one balanced transaction, however often the payout is sent');
select is((select count(*)::integer from public.outbox_event e join payout p on e.payload ->> 'event_id' = p.event_id::text
           where e.event_type = 'jackpot.paid'), 1, 'jackpot.paid goes out once');
select throws_ok($$ update public.jackpot_event set total_paise = 0 $$, '42501', null, 'a payout is never changed');

-- A reversal puts it right, once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temporary table reversal on commit drop as
select public.reverse_jackpot_event((select event_id from payout), 'Paid at the wrong table', 'reverse-request-1') as event_id;
select is((select public.reverse_jackpot_event((select event_id from payout), 'Paid at the wrong table', 'reverse-request-1')),
          (select event_id from reversal), 'the same reversal again is the same reversal');
select throws_ok($$ select public.reverse_jackpot_event((select event_id from payout), 'Again', 'reverse-request-2') $$, 'RVDUP', null,
  'a payout is reversed once');
select results_eq($$ select main_paise from public.jackpot_pools('00000000-0000-4000-8000-000000000001') $$,
  $$ select main from before_balances $$, 'the main pool is back to ₹3,42,600');
select results_eq($$ select kind::text, is_reversed from public.jackpot_history('00000000-0000-4000-8000-000000000001') order by created_at, kind $$,
  $$ values ('payout', true), ('reversal', false) $$, 'the history shows the payout, reversed, and the reversal');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     '{}', 34255000, 'bad-beat-request-1') $$, '23505', null, 'a payout''s key with other players is refused, not replayed');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     '{}', 0, 'reverse-request-1') $$, '23505', null, 'and so is a reversal''s key used for a payout');
reset role;
select ok(exists (select 1 from public.outbox_event e join reversal r on e.payload ->> 'event_id' = r.event_id::text where e.event_type = 'jackpot.reversed'),
  'jackpot.reversed goes out, so a winner card can come down');
select is(pg_temp.natural('venue.chips_outstanding'), (select chips from before_balances), 'the chips come back out of play');
select ok((select t.reverses_transaction_id = (select o.id from public.ledger_transaction o join payout p on o.idempotency_key = 'jackpot:' || p.event_id)
           from public.ledger_transaction t join reversal r on t.idempotency_key = 'jackpot:' || r.event_id),
  'as the ledger''s own reversal of the payout''s transaction');

-- Staff who read the ledger see the jackpot; names only for those who may read members.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select loser_name from public.jackpot_history('00000000-0000-4000-8000-000000000001') where kind = 'payout' $$,
  $$ values ('Arjun Mehta') $$, 'a cashier reads the payouts, with the players'' names');
select throws_ok($$ select public.reverse_jackpot_event((select event_id from payout), 'Not mine', 'reverse-cashier') $$, '42501', null,
  'but reverses none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select results_eq($$ select main_paise, loser_name from public.jackpot_pools('00000000-0000-4000-8000-000000000001'),
                    public.jackpot_history('00000000-0000-4000-8000-000000000001') where kind = 'payout' $$,
  $$ select main, null::text from before_balances $$, 'the investor reads the pools and payouts, without the players'' names');
reset role;

-- Who may, and what is refused.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     '{}', 0, 'bad-beat-dealer') $$, '42501', null, 'a dealer pays no jackpot');
select throws_ok($$ select * from public.jackpot_pools('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor sees the pools');
select is_empty($$ select * from public.jackpot_event $$, 'nor the payouts');
select throws_ok($$ select public.reverse_jackpot_event((select event_id from payout), 'Dealer', 'reverse-dealer') $$, '42501', null,
  'nor reverses one');
reset role;
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000110' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     '{}', 0, 'bad-beat-other-admin') $$, '42501', null, 'an admin of the practice venue only pays none at the club');
select is_empty($$ select * from public.jackpot_history('00000000-0000-4000-8000-000000000001') $$, 'nor reads its payouts');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919999999999',
                     '{}', 0, 'bad-beat-stranger') $$, 'RVNMB', null, 'every player is a member');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     array['+919000000201'], 0, 'bad-beat-twice') $$, '22023', 'The loser, the winner and each other player are different members',
  'and a different one');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001',
                     (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000002' limit 1),
                     '+919000000201', '+919000000202', '{}', 0, 'bad-beat-other-venue') $$, '22023', 'That table is not at this venue',
  'at a table of this venue');
reset role;
-- A rule saved after the console showed one, with the same total but the loser's and winner's shares swapped,
-- pays nothing (#309): the floor would hand out one split and the history record another.
reset role;
create temp table shown_rule as select private.setting_at('00000000-0000-4000-8000-000000000001', 'jackpot.payout', '', now()) as rule;
-- The total the console showed under it, which the swapped rule also comes to, so only the rule check can refuse.
create temp table shown_total as
select (private.bad_beat_payout(private.main_pool('00000000-0000-4000-8000-000000000001'), (rule ->> 'pool_basis_points')::integer,
          (rule ->> 'loser_basis_points')::integer, (rule ->> 'winner_basis_points')::integer, (rule ->> 'table_basis_points')::integer, 0)).total
from shown_rule;
grant select on shown_rule, shown_total to authenticated;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select '00000000-0000-4000-8000-000000000001', 'jackpot.payout', '',
       rule || jsonb_build_object('loser_basis_points', rule -> 'winner_basis_points', 'winner_basis_points', rule -> 'loser_basis_points'),
       now() - interval '1 second', 'Loser and winner swapped'
from shown_rule;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.pay_bad_beat('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     '{}', (select total from shown_total), (select rule from shown_rule), 'bad-beat-swapped-rule') $$,
  'RVSTL', 'The payout rule has changed since the amounts were shown',
  'a payout shown under one rule is refused under another, even at the same total');
reset role;

insert into public.control_state (venue_id, level, member_id, reason)
select venue_id, 'member_freeze', id, 'Test' from public.member
where venue_id = '00000000-0000-4000-8000-000000000001' and phone = '+919000000202';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     '{}', 0, 'bad-beat-frozen-member') $$, 'RVMBR', null, 'no payout names a frozen member');
-- A payout is made only for the total the console showed: the pool is back at ₹3,42,600, so a
-- loser and a winner alone come to ₹2,56,950, and an older ₹2,57,000 is refused.
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000203', '+919000000204',
                     '{}', 25700000, 'bad-beat-stale') $$, 'RVSTL', null, 'a payout for a total the pool no longer gives is refused');
-- A second payout, then promotions switched off: no new payout, but a correction still goes through.
create temporary table payout2 on commit drop as
select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000203', '+919000000204', '{}',
                           25695000, 'bad-beat-request-3') as event_id;
grant select on payout2 to authenticated;
reset role;
insert into public.control_state (venue_id, level, feature, reason)
values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000209', '+919000000210',
                     '{}', 0, 'bad-beat-killed') $$, 'RVKIL', null, 'no payout while promotions are switched off');
select lives_ok($$ select public.reverse_jackpot_event((select event_id from payout2), 'Wrong players', 'reverse-request-3') $$,
  'but a payout is still reversed');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.pay('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000209', '+919000000210',
                     '{}', 0, 'bad-beat-frozen') $$, 'RVFRZ', null, 'no payout while the venue is frozen');
select throws_ok($$ select public.reverse_jackpot_event((select event_id from payout), 'Frozen', 'reverse-frozen') $$, 'RVFRZ', null,
  'nor a reversal');
reset role;
set local role anon;
select throws_ok($$ select * from public.jackpot_history('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a visitor reads no payouts');
reset role;

select * from finish();
rollback;
