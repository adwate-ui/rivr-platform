-- Bad-beat payouts (#48 part 2): an admin pays a bad beat at Table 3, Arjun the loser, Kabir the
-- winner and four others dealt in, under the seeded rule (the whole main pool; 50% loser, 25%
-- winner, 25% shared). On the seed's ₹3,42,600 pool: ₹1,71,300, ₹85,650 and ₹21,400 each, in whole
-- chips, ₹3,42,550 in all; ₹50 stays. The main pool pays it into chips in play, once however often
-- it is sent; jackpot.paid goes out. A reversal posts it back, once. Refused for a dealer, for
-- someone not a member, for the same member twice, with promotions switched off, and while frozen.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

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
create temporary table before_balances on commit drop as
select pg_temp.natural('venue.jackpot.main') as main, pg_temp.natural('venue.chips_outstanding') as chips;
grant select on before_balances to authenticated;

-- An admin pays the bad beat.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temporary table payout on commit drop as
select public.pay_bad_beat('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                           array['+919000000203', '+919000000204', '+919000000209', '+919000000210'], 'bad-beat-request-1') as event_id;
grant select on payout to authenticated;
select is((select public.pay_bad_beat('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                                       array['+919000000203', '+919000000204', '+919000000209', '+919000000210'], 'bad-beat-request-1')),
          (select event_id from payout), 'the same request again is the same payout');
select results_eq(
  $$ select loser_name, winner_name, others, loser_paise, winner_paise, each_at_table_paise, total_paise, is_reversed
     from public.jackpot_history('00000000-0000-4000-8000-000000000001') h join payout p on p.event_id = h.event_id $$,
  $$ values ('Arjun Mehta', 'Kabir Sethi', 4, 17130000::bigint, 8565000::bigint, 2140000::bigint, 34255000::bigint, false) $$,
  'loser ₹1,71,300, winner ₹85,650, ₹21,400 to each of four others: ₹3,42,550 in whole chips');
select results_eq($$ select main_paise from public.jackpot_pools('00000000-0000-4000-8000-000000000001') $$, $$ values (5000::bigint) $$,
  'the ₹50 that rounds away stays in the main pool');
select throws_ok($$ select public.pay_bad_beat('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000211', '+919000000212',
                     '{}', 'bad-beat-request-2') $$, '22023', null, 'a pool too small for a chip each pays nothing');
reset role;
select is((select chips from before_balances) - pg_temp.natural('venue.chips_outstanding'), -34255000::bigint,
  'the payout goes into play as chips');
select is((select count(*)::integer from public.ledger_transaction t join payout p on t.idempotency_key = 'jackpot:' || p.event_id), 1,
  'in one balanced transaction, however often the payout is sent');
select ok(exists (select 1 from public.outbox_event e join payout p on e.payload ->> 'event_id' = p.event_id::text where e.event_type = 'jackpot.paid'),
  'jackpot.paid goes out');
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
reset role;

-- Who may, and what is refused.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.pay_bad_beat('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     '{}', 'bad-beat-dealer') $$, '42501', null, 'a dealer pays no jackpot');
select throws_ok($$ select * from public.jackpot_pools('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor sees the pools');
select is_empty($$ select * from public.jackpot_event $$, 'nor the payouts');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.pay_bad_beat('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919999999999',
                     '{}', 'bad-beat-stranger') $$, 'RVNMB', null, 'every player is a member');
select throws_ok($$ select public.pay_bad_beat('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     array['+919000000201'], 'bad-beat-twice') $$, '22023', null, 'and a different one');
select throws_ok($$ select public.pay_bad_beat('00000000-0000-4000-8000-000000000001',
                     (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000002' limit 1),
                     '+919000000201', '+919000000202', '{}', 'bad-beat-other-venue') $$, '22023', null, 'at a table of this venue');
reset role;
insert into public.control_state (venue_id, level, feature, reason)
values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.pay_bad_beat('00000000-0000-4000-8000-000000000001', pg_temp.table3(), '+919000000201', '+919000000202',
                     '{}', 'bad-beat-killed') $$, 'RVKIL', null, 'no payout while promotions are switched off');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.reverse_jackpot_event((select event_id from payout), 'Frozen', 'reverse-frozen') $$, 'RVFRZ', null,
  'nor a reversal while the venue is frozen');
reset role;
set local role anon;
select throws_ok($$ select * from public.jackpot_history('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a visitor reads no payouts');
reset role;

select * from finish();
rollback;
