-- The SQL twins of money rules, proved against the golden files @rivr/domain is proved against
-- (#221, decision 0037). `pnpm supabase test db` loads every case of packages/testing/golden/*.json
-- into golden.golden_case first, so a case added to a file is tested here and in the domain alike.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A golden amount such as "₹1,00,000" or "₹1,999.99", in paise.
create function pg_temp.paise(p_amount text) returns bigint language sql immutable as $$
  select (replace(replace(p_amount, '₹', ''), ',', '')::numeric * 100)::bigint;
$$;

-- The Academy fee: private.academy_fee and @rivr/domain academyFee (packages/testing/golden/academy.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'academy.json'), 'the Academy fee cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'academy.json' and operation <> 'fee' $$,
  'every operation in academy.json is proved here');
select results_eq(
  $$ select description,
            private.academy_fee(inputs ->> 'kind', (inputs ->> 'seats')::integer,
                                jsonb_build_object('individual_paise', pg_temp.paise(inputs ->> 'individual'),
                                                   'corporate_per_head_paise', pg_temp.paise(inputs ->> 'corporatePerHead')))
     from golden.golden_case where file = 'academy.json' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'result') from golden.golden_case where file = 'academy.json' order by position $$,
  'private.academy_fee gives every Academy fee in the golden file');

-- Waitlist priority: private.priority_weight and @rivr/domain priorityOn (packages/testing/golden/waitlist.json).
create function pg_temp.blind(p_stake text, p_part integer) returns bigint language sql immutable as $$
  select case when coalesce(p_stake, '') = '' then null else split_part(p_stake, '/', p_part)::bigint * 100 end;
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'waitlist.json'), 'the waitlist priority cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'waitlist.json' and operation <> 'priority' $$,
  'every operation in waitlist.json is proved here');
select results_eq(
  $$ select description, w.weight, case when w.weight > 0 then inputs ->> 'tier' end
     from golden.golden_case
     cross join lateral (
       select private.priority_weight(nullif(inputs ->> 'weight', '')::integer, (inputs ->> 'onlyAtQualifyingStake') = 'yes',
                                      pg_temp.blind(inputs ->> 'qualifyingStake', 1), pg_temp.blind(inputs ->> 'qualifyingStake', 2),
                                      pg_temp.blind(inputs ->> 'list', 1), pg_temp.blind(inputs ->> 'list', 2)) as weight) w
     where file = 'waitlist.json' order by position $$,
  $$ select description, (expected ->> 'weight')::integer, nullif(expected ->> 'reason', '')
     from golden.golden_case where file = 'waitlist.json' order by position $$,
  'private.priority_weight gives every weight in the golden file, and the tier is the reason only with a weight');

-- Rake, drop and pull: private.pot_take and @rivr/domain potTake (packages/testing/golden/rake.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'rake.json'), 'the rake cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'rake.json' and operation <> 'rake' $$,
  'every operation in rake.json is proved here');
select results_eq(
  $$ select description, t.rake, t.drop_paise, t.pull, t.is_cap_applied
     from golden.golden_case
     cross join lateral private.pot_take(pg_temp.paise(inputs ->> 'pot'), replace(inputs ->> 'rate', '%', '')::integer * 100,
                                         pg_temp.paise(inputs ->> 'cap'), (inputs ->> 'jackpotLive') = 'yes',
                                         pg_temp.paise(inputs ->> 'drop'), pg_temp.paise(inputs ->> 'dropAbove')) t
     where file = 'rake.json' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'rake'), pg_temp.paise(expected ->> 'drop'), pg_temp.paise(expected ->> 'pull'),
            (expected ->> 'capApplied') = 'yes'
     from golden.golden_case where file = 'rake.json' order by position $$,
  'private.pot_take gives every rake, drop, pull and cap applied in the golden file');

-- The jackpot's pools: private.split_drop and private.bad_beat_payout, and @rivr/domain splitDrop and
-- badBeatPayout (packages/testing/golden/jackpot.json).
create function pg_temp.basis_points(p_share text) returns integer language sql immutable as $$
  select (replace(p_share, '%', '')::numeric * 100)::integer;
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'jackpot.json'), 'the jackpot cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'jackpot.json' and operation not in ('split', 'payout') $$,
  'every operation in jackpot.json is proved here');
select results_eq(
  $$ select description, s.main, s.season, s.freeroll
     from golden.golden_case
     cross join lateral private.split_drop(pg_temp.paise(inputs ->> 'drop'), pg_temp.basis_points(inputs ->> 'seasonShare'),
                                           pg_temp.basis_points(inputs ->> 'freerollShare')) s
     where file = 'jackpot.json' and operation = 'split' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'main'), pg_temp.paise(expected ->> 'season'), pg_temp.paise(expected ->> 'freeroll')
     from golden.golden_case where file = 'jackpot.json' and operation = 'split' order by position $$,
  'private.split_drop gives every split in the golden file');
select results_eq(
  $$ select description, p.loser, p.winner, p.each_at_table, p.total
     from golden.golden_case
     cross join lateral private.bad_beat_payout(pg_temp.paise(inputs ->> 'pool'), pg_temp.basis_points(inputs ->> 'poolShare'),
                                                pg_temp.basis_points(inputs ->> 'loserShare'), pg_temp.basis_points(inputs ->> 'winnerShare'),
                                                pg_temp.basis_points(inputs ->> 'tableShare'), (inputs ->> 'others')::integer) p
     where file = 'jackpot.json' and operation = 'payout' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'loser'), pg_temp.paise(expected ->> 'winner'),
            pg_temp.paise(expected ->> 'eachAtTable'), pg_temp.paise(expected ->> 'total')
     from golden.golden_case where file = 'jackpot.json' and operation = 'payout' order by position $$,
  'private.bad_beat_payout gives every payout in the golden file');

-- Effective-dated rules: private.setting_at and @rivr/domain ruleAt (packages/testing/golden/settings.json).
-- Each case's history becomes rake.config rows under its own subject, written as a migration writes
-- them, with nobody signed in.
create function pg_temp.ist(p_text text) returns timestamptz language sql immutable as $$
  select replace(p_text, ' IST', '+05:30')::timestamptz;
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'settings.json'), 'the effective-dated rule cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'settings.json' and operation <> 'lookup' $$,
  'every operation in settings.json is proved here');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select '00000000-0000-4000-8000-000000000001', 'rake.config', 'golden_' || c.position,
       jsonb_build_object('rate_basis_points', 500, 'cap_paise', pg_temp.paise(split_part(e.entry, ' = ', 2))),
       case when split_part(e.entry, ' = ', 1) = 'since opening' then '-infinity'::timestamptz else pg_temp.ist(split_part(e.entry, ' = ', 1)) end,
       'Golden case'
from golden.golden_case c
cross join lateral unnest(string_to_array(c.inputs ->> 'history', ' | ')) as e (entry)
where c.file = 'settings.json';
select results_eq(
  $$ select description,
            (private.setting_at('00000000-0000-4000-8000-000000000001', 'rake.config', 'golden_' || position, pg_temp.ist(inputs ->> 'at'))
               ->> 'cap_paise')::bigint
     from golden.golden_case where file = 'settings.json' order by position $$,
  $$ select description, case when expected ->> 'cap' = 'none' then null else pg_temp.paise(expected ->> 'cap') end
     from golden.golden_case where file = 'settings.json' order by position $$,
  'private.setting_at gives the rule in force at every moment in the golden file');

-- A down's variance: private.down_variance and @rivr/domain downVariance (packages/testing/golden/variance.json).
create function pg_temp.signed_paise(p_amount text) returns bigint language sql immutable as $$
  select case when left(p_amount, 1) = '-' then -pg_temp.paise(substr(p_amount, 2)) else pg_temp.paise(p_amount) end;
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'variance.json'), 'the down variance cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'variance.json' and operation <> 'variance' $$,
  'every operation in variance.json is proved here');
select results_eq(
  $$ select description, v.variance_paise, v.is_alert
     from golden.golden_case
     cross join lateral private.down_variance(pg_temp.paise(inputs ->> 'dropBox'), pg_temp.paise(inputs ->> 'logged'),
                                              case when inputs ->> 'threshold' = '' then null else pg_temp.paise(inputs ->> 'threshold') end) v
     where file = 'variance.json' order by position $$,
  $$ select description, pg_temp.signed_paise(expected ->> 'variance'), expected ->> 'alert' = 'yes'
     from golden.golden_case where file = 'variance.json' order by position $$,
  'private.down_variance gives every variance and alert in the golden file');

-- A shift's close: private.shift_close and @rivr/domain shiftClose (packages/testing/golden/eod.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'eod.json'), 'the shift close cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'eod.json' and operation <> 'close' $$,
  'every operation in eod.json is proved here');
select results_eq(
  $$ select description, v.cash_paise, v.chips_paise, v.receipts_paise, v.markers_paise, v.is_anomaly
     from golden.golden_case
     cross join lateral private.shift_close(pg_temp.paise(inputs ->> 'countedCash'), pg_temp.paise(inputs ->> 'expectedCash'),
       pg_temp.paise(inputs ->> 'countedChips'), pg_temp.paise(inputs ->> 'expectedChips'),
       pg_temp.paise(inputs ->> 'countedReceipts'), pg_temp.paise(inputs ->> 'expectedReceipts'),
       pg_temp.paise(inputs ->> 'countedMarkers'), pg_temp.paise(inputs ->> 'expectedMarkers')) v
     where file = 'eod.json' order by position $$,
  $$ select description, pg_temp.signed_paise(expected ->> 'cash'), pg_temp.signed_paise(expected ->> 'chips'),
            pg_temp.signed_paise(expected ->> 'receipts'), pg_temp.signed_paise(expected ->> 'markers'), expected ->> 'anomaly' = 'yes'
     from golden.golden_case where file = 'eod.json' order by position $$,
  'private.shift_close gives every variance and anomaly in the golden file');

-- TDS on a cash-out: private.tds_amount and @rivr/domain tdsOnCashOut (packages/testing/golden/tds.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'tds.json'), 'the TDS cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'tds.json' and operation <> 'tds' $$,
  'every operation in tds.json is proved here');
select results_eq(
  $$ select description, t.rate_basis_points, t.due_paise, t.amount_paise
     from golden.golden_case
     cross join lateral private.tds_amount(pg_temp.signed_paise(inputs ->> 'winnings'), pg_temp.paise(inputs ->> 'already'), pg_temp.paise(inputs ->> 'payout'),
       inputs ->> 'hasPan' = 'yes', (inputs ->> 'rate')::integer, pg_temp.paise(inputs ->> 'threshold'), inputs ->> 'panRequired' = 'yes',
       (inputs ->> 'noPanRate')::integer) t
     where file = 'tds.json' order by position $$,
  $$ select description, (expected ->> 'rate')::integer, pg_temp.paise(expected ->> 'due'), pg_temp.paise(expected ->> 'amount')
     from golden.golden_case where file = 'tds.json' order by position $$,
  'private.tds_amount gives every rate, amount due and amount withheld in the golden file');

-- GST included in an amount: private.gst_included and @rivr/domain gstIncluded, and for a buyer from another
-- state private.igst_included and igstIncluded (packages/testing/golden/gst.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'gst.json' and operation = 'gst_included'), 'the GST cases are loaded');
select ok((select count(*) > 0 from golden.golden_case where file = 'gst.json' and operation = 'igst_included'), 'and the IGST cases');
select is_empty($$ select operation from golden.golden_case where file = 'gst.json' and operation not in ('gst_included', 'igst_included') $$,
  'every operation in gst.json is proved here');
select results_eq(
  $$ select description, g.taxable_paise, g.cgst_paise, g.sgst_paise
     from golden.golden_case
     cross join lateral private.gst_included(pg_temp.paise(inputs ->> 'inclusive'), (inputs ->> 'rate')::integer) g
     where file = 'gst.json' and operation = 'gst_included' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'taxable'), pg_temp.paise(expected ->> 'cgst'), pg_temp.paise(expected ->> 'sgst')
     from golden.golden_case where file = 'gst.json' and operation = 'gst_included' order by position $$,
  'private.gst_included gives every taxable value and CGST and SGST half in the golden file');
select results_eq(
  $$ select description, g.taxable_paise, g.igst_paise
     from golden.golden_case
     cross join lateral private.igst_included(pg_temp.paise(inputs ->> 'inclusive'), (inputs ->> 'rate')::integer) g
     where file = 'gst.json' and operation = 'igst_included' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'taxable'), pg_temp.paise(expected ->> 'igst')
     from golden.golden_case where file = 'gst.json' and operation = 'igst_included' order by position $$,
  'private.igst_included gives every taxable value and IGST in the golden file');

-- A buy-in at the cage: private.buy_in_check and @rivr/domain buyIn (packages/testing/golden/cage.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'cage.json'), 'the cage buy-in cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'cage.json' and operation <> 'buy_in' $$,
  'every operation in cage.json is proved here');
select results_eq(
  $$ select description, c.result, c.debit
     from golden.golden_case
     cross join lateral private.buy_in_check(inputs ->> 'method', pg_temp.paise(inputs ->> 'amount'), pg_temp.paise(inputs ->> 'minimum'),
                                             pg_temp.paise(inputs ->> 'wallet'), pg_temp.paise(inputs ->> 'bonus')) c
     where file = 'cage.json' order by position $$,
  $$ select description, expected ->> 'result', expected ->> 'debit' from golden.golden_case where file = 'cage.json' order by position $$,
  'private.buy_in_check gives every buy-in in the golden file');

-- Call time: private.call_time_left and @rivr/domain callTime (packages/testing/golden/callTime.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'callTime.json'), 'the call time cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'callTime.json' and operation <> 'call_time' $$,
  'every operation in callTime.json is proved here');
select results_eq(
  $$ select description, private.call_time_left((inputs ->> 'minutes')::integer, (inputs ->> 'seated')::timestamptz,
                                                 (inputs ->> 'awaySeconds')::integer, nullif(inputs ->> 'awaySince', '')::timestamptz,
                                                 nullif(inputs ->> 'left', '')::timestamptz, (inputs ->> 'at')::timestamptz)
     from golden.golden_case where file = 'callTime.json' order by position $$,
  $$ select description, (expected ->> 'secondsLeft')::integer from golden.golden_case where file = 'callTime.json' order by position $$,
  'private.call_time_left gives every time left in the golden file');

-- A credit limit: private.credit_limit_check and @rivr/domain creditLimit (packages/testing/golden/credit.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'credit.json'), 'the credit limit cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'credit.json' and operation <> 'limit' $$,
  'every operation in credit.json is proved here');
select results_eq(
  $$ select description, private.credit_limit_check(pg_temp.paise(inputs ->> 'limit'), pg_temp.paise(inputs ->> 'threshold'),
                                                     pg_temp.paise(inputs ->> 'current'))
     from golden.golden_case where file = 'credit.json' order by position $$,
  $$ select description, expected ->> 'result' from golden.golden_case where file = 'credit.json' order by position $$,
  'private.credit_limit_check gives every limit in the golden file');

-- A marker: private.marker_check and @rivr/domain markerCheck (packages/testing/golden/markers.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'markers.json'), 'the marker cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'markers.json' and operation <> 'issue' $$,
  'every operation in markers.json is proved here');
select results_eq(
  $$ select description, private.marker_check(pg_temp.paise(inputs ->> 'amount'), pg_temp.paise(inputs ->> 'outstanding'),
                                             pg_temp.paise(inputs ->> 'limit'), pg_temp.paise(inputs ->> 'exposure'),
                                             pg_temp.paise(inputs ->> 'cap'), inputs ->> 'pastDue' = 'yes')
     from golden.golden_case where file = 'markers.json' order by position $$,
  $$ select description, expected ->> 'result' from golden.golden_case where file = 'markers.json' order by position $$,
  'private.marker_check gives every marker in the golden file');

-- A cash-out: private.cash_out_split and @rivr/domain cashOut (packages/testing/golden/cashOut.json).
create function pg_temp.paise_list(p_text text) returns bigint[] language sql immutable as $$
  select coalesce(array_agg(pg_temp.paise(trim(part)) order by n), '{}') from unnest(string_to_array(nullif(p_text, ''), '|')) with ordinality as u (part, n);
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'cashOut.json'), 'the cash-out cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'cashOut.json' and operation <> 'cash_out' $$,
  'every operation in cashOut.json is proved here');
select results_eq(
  $$ select description, coalesce(s.settled_paise::text, 'not_chips'), coalesce(s.to_member_paise::text, 'not_chips')
     from golden.golden_case
     cross join lateral private.cash_out_split(pg_temp.paise(inputs ->> 'chips'), pg_temp.paise_list(inputs ->> 'markers')) s
     where file = 'cashOut.json' order by position $$,
  $$ select description,
            case when expected ->> 'settled' = 'not_chips' then 'not_chips' else pg_temp.paise_list(expected ->> 'settled')::text end,
            case when expected ->> 'toMember' = 'not_chips' then 'not_chips' when expected ->> 'toMember' = '₹0' then '0'
                 else pg_temp.paise(expected ->> 'toMember')::text end
     from golden.golden_case where file = 'cashOut.json' order by position $$,
  'private.cash_out_split gives every cash-out in the golden file');

-- A bonus: private.bonus_draws and private.bonus_expiring, and @rivr/domain bonusSpend and bonusExpired
-- (packages/testing/golden/bonus.json). Grants are written "amount @ end | ...".
create function pg_temp.grant_amounts(p_text text) returns bigint[] language sql immutable as $$
  select pg_temp.paise_list(regexp_replace(coalesce(p_text, ''), '\s*@[^|]*', '', 'g'));
$$;
create function pg_temp.grant_ends(p_text text) returns timestamptz[] language sql immutable as $$
  select coalesce(array_agg(trim(split_part(part, '@', 2))::timestamptz order by n), '{}')
  from unnest(string_to_array(nullif(p_text, ''), '|')) with ordinality as u (part, n);
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'bonus.json'), 'the bonus cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'bonus.json' and operation not in ('spend', 'expire') $$,
  'every operation in bonus.json is proved here');
select results_eq(
  $$ select description, case when d.result = 'ok' then d.taken::text else d.result end
     from golden.golden_case
     cross join lateral private.bonus_draws(pg_temp.paise(inputs ->> 'amount'), pg_temp.grant_amounts(inputs ->> 'grants'),
                                            pg_temp.grant_ends(inputs ->> 'grants'), (inputs ->> 'at')::timestamptz) d
     where file = 'bonus.json' and operation = 'spend' order by position $$,
  $$ select description, case when expected ->> 'taken' in ('not_chips', 'bonus_short') then expected ->> 'taken'
                              else pg_temp.paise_list(expected ->> 'taken')::text end
     from golden.golden_case where file = 'bonus.json' and operation = 'spend' order by position $$,
  'private.bonus_draws gives every spend of bonus in the golden file');
select results_eq(
  $$ select description, private.bonus_expiring(pg_temp.grant_amounts(inputs ->> 'grants'), pg_temp.grant_ends(inputs ->> 'grants'),
                                                (inputs ->> 'at')::timestamptz)
     from golden.golden_case where file = 'bonus.json' and operation = 'expire' order by position $$,
  $$ select description, pg_temp.paise_list(expected ->> 'expired')
     from golden.golden_case where file = 'bonus.json' and operation = 'expire' order by position $$,
  'private.bonus_expiring gives every expiry in the golden file');

-- A withdrawal: private.withdrawal_check and @rivr/domain withdrawalCheck (packages/testing/golden/wallet.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'wallet.json'), 'the withdrawal cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'wallet.json' and operation <> 'withdraw' $$,
  'every operation in wallet.json is proved here');
select results_eq(
  $$ select description, private.withdrawal_check(pg_temp.paise(inputs ->> 'amount'), pg_temp.paise(inputs ->> 'cash'))
     from golden.golden_case where file = 'wallet.json' order by position $$,
  $$ select description, expected ->> 'result' from golden.golden_case where file = 'wallet.json' order by position $$,
  'private.withdrawal_check gives every withdrawal in the golden file');

-- Promotions: private.promotion_applies, private.promotion_reward and private.promotions_to_give, and
-- @rivr/domain promotionApplies, promotionReward and promotionsToGive (packages/testing/golden/promotions.json).
-- Conditions, facts, effects and candidates are the JSON the database holds.
select ok((select count(*) > 0 from golden.golden_case where file = 'promotions.json'), 'the promotion cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'promotions.json' and operation not in ('applies', 'reward', 'select') $$,
  'every operation in promotions.json is proved here');
select results_eq(
  $$ select description, case when private.promotion_applies((inputs ->> 'conditions')::jsonb, (inputs ->> 'facts')::jsonb) then 'yes' else 'no' end
     from golden.golden_case where file = 'promotions.json' and operation = 'applies' order by position $$,
  $$ select description, expected ->> 'applies' from golden.golden_case where file = 'promotions.json' and operation = 'applies' order by position $$,
  'private.promotion_applies decides every rule in the golden file');
select results_eq(
  $$ select description, coalesce((select case when r.points > 0 then r.points || ' points' else r.cost_paise::text end
                                   from private.promotion_reward((inputs ->> 'effect')::jsonb, pg_temp.paise(inputs ->> 'amount'), (inputs ->> 'points')::bigint) r),
                                  'nothing')
     from golden.golden_case where file = 'promotions.json' and operation = 'reward' order by position $$,
  $$ select description, case when expected ->> 'reward' = 'nothing' or expected ->> 'reward' like '% points' then expected ->> 'reward'
                              else pg_temp.paise(expected ->> 'reward')::text end
     from golden.golden_case where file = 'promotions.json' and operation = 'reward' order by position $$,
  'private.promotion_reward gives every reward in the golden file');
select results_eq(
  $$ select description, coalesce(nullif(array_to_string(private.promotions_to_give((inputs ->> 'candidates')::jsonb), ' | '), ''), 'none')
     from golden.golden_case where file = 'promotions.json' and operation = 'select' order by position $$,
  $$ select description, expected ->> 'given' from golden.golden_case where file = 'promotions.json' and operation = 'select' order by position $$,
  'private.promotions_to_give gives every selection in the golden file');

-- Points: private.points_for_time, table_played_seconds, rake_share and rake_points, and @rivr/domain's
-- (packages/testing/golden/points.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'points.json'), 'the points cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'points.json'
                   and operation not in ('time', 'table_time', 'rake_share', 'rake_points') $$,
  'every operation in points.json is proved here');
select results_eq(
  $$ select description, case operation
       when 'time' then private.points_for_time((inputs ->> 'seconds')::bigint, (inputs ->> 'perHour')::bigint)
       when 'table_time' then private.table_played_seconds((inputs ->> 'tableSeconds')::bigint, (inputs ->> 'sessionSeconds')::bigint,
                                                           (inputs ->> 'playedSeconds')::bigint)
       when 'rake_share' then private.rake_share(pg_temp.paise(inputs ->> 'rake'), (inputs ->> 'seated')::integer)
       else private.rake_points(pg_temp.paise(inputs ->> 'share'), (inputs ->> 'rate')::integer) end
     from golden.golden_case where file = 'points.json' order by position $$,
  $$ select description, case operation
       when 'time' then (expected ->> 'points')::bigint
       when 'table_time' then (expected ->> 'seconds')::bigint
       when 'rake_share' then pg_temp.paise(expected ->> 'share')
       else (expected ->> 'points')::bigint end
     from golden.golden_case where file = 'points.json' order by position $$,
  'the points rules give every case in the golden file');

-- The League: private.league_finish_points and league_month, and @rivr/domain's (packages/testing/golden/league.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'league.json'), 'the League cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'league.json' and operation not in ('finish', 'month') $$,
  'every operation in league.json is proved here');
select results_eq(
  $$ select description, case operation
       when 'finish' then private.league_finish_points((inputs ->> 'place')::integer,
                            jsonb_build_object('first', (inputs ->> 'first')::bigint, 'second', (inputs ->> 'second')::bigint,
                                               'third', (inputs ->> 'third')::bigint, 'final_table', (inputs ->> 'finalTable')::bigint,
                                               'entry', (inputs ->> 'entry')::bigint))::text
       else private.league_month((inputs ->> 'at')::timestamptz)::text end
     from golden.golden_case where file = 'league.json' order by position $$,
  $$ select description, case operation when 'finish' then expected ->> 'points' else expected ->> 'month' end
     from golden.golden_case where file = 'league.json' order by position $$,
  'the League rules give every case in the golden file');
-- Credit: private.credit_age_bucket and private.repayment_split, and @rivr/domain ageingBucket and repayment
-- (packages/testing/golden/creditAgeing.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'creditAgeing.json'), 'the credit ageing cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'creditAgeing.json' and operation not in ('bucket', 'repay') $$,
  'every operation in creditAgeing.json is proved here');
select results_eq(
  $$ select description, private.credit_age_bucket((inputs ->> 'issued')::timestamptz, (inputs ->> 'at')::timestamptz)
     from golden.golden_case where file = 'creditAgeing.json' and operation = 'bucket' order by position $$,
  $$ select description, expected ->> 'bucket' from golden.golden_case where file = 'creditAgeing.json' and operation = 'bucket' order by position $$,
  'private.credit_age_bucket puts every marker in the golden file in its bucket');
select results_eq(
  $$ select description, coalesce(r.refusal, r.settled_paise::text)
     from golden.golden_case
     cross join lateral private.repayment_split(pg_temp.paise(inputs ->> 'amount'), pg_temp.paise_list(inputs ->> 'markers')) r
     where file = 'creditAgeing.json' and operation = 'repay' order by position $$,
  $$ select description, case when expected ->> 'settled' in ('not_chips', 'nothing_owed', 'more_than_owed') then expected ->> 'settled'
                              else pg_temp.paise_list(expected ->> 'settled')::text end
     from golden.golden_case where file = 'creditAgeing.json' and operation = 'repay' order by position $$,
  'private.repayment_split settles or refuses every repayment in the golden file');

-- The return's taxed winnings: private.tds_taxed_winnings and @rivr/domain tdsTaxedWinnings (packages/testing/golden/tdsReturn.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'tdsReturn.json'), 'the TDS return cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'tdsReturn.json' and operation <> 'taxed' $$,
  'every operation in tdsReturn.json is proved here');
select results_eq(
  $$ select description, private.tds_taxed_winnings(pg_temp.paise(inputs ->> 'winnings'), pg_temp.paise(inputs ->> 'taxedBefore'))
     from golden.golden_case where file = 'tdsReturn.json' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'taxed') from golden.golden_case where file = 'tdsReturn.json' order by position $$,
  'private.tds_taxed_winnings gives every case in the golden file');

-- Hours played inside a promotion's window: private.seconds_in_window, and private.table_played_seconds as
-- private.visit_window_time applies it, and @rivr/domain secondsInWindow and playedSecondsInWindow
-- (packages/testing/golden/promotionWindow.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'promotionWindow.json'), 'the promotion window cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'promotionWindow.json' and operation not in ('window', 'played') $$,
  'every operation in promotionWindow.json is proved here');
select results_eq(
  $$ select description, private.seconds_in_window((inputs ->> 'from')::timestamptz, (inputs ->> 'to')::timestamptz, (inputs ->> 'conditions')::jsonb)
     from golden.golden_case where file = 'promotionWindow.json' and operation = 'window' order by position $$,
  $$ select description, (expected ->> 'seconds')::bigint from golden.golden_case where file = 'promotionWindow.json' and operation = 'window' order by position $$,
  'private.seconds_in_window counts every stint in the golden file');
select results_eq(
  $$ select description, private.table_played_seconds(
       (select sum(private.seconds_in_window(split_part(s, '/', 1)::timestamptz, split_part(s, '/', 2)::timestamptz, (inputs ->> 'conditions')::jsonb))
        from unnest(string_to_array(inputs ->> 'stints', ' | ')) s)::bigint,
       (inputs ->> 'session')::bigint, (inputs ->> 'played')::bigint)
     from golden.golden_case where file = 'promotionWindow.json' and operation = 'played' order by position $$,
  $$ select description, (expected ->> 'seconds')::bigint from golden.golden_case where file = 'promotionWindow.json' and operation = 'played' order by position $$,
  'a table''s time inside the window bears its share of the time away, as in the golden file');

-- A golden blind structure, 'small/big ante A for M; break M', as the levels a tournament keeps.
create function pg_temp.stages(p_notation text) returns jsonb language sql immutable as $$
  select jsonb_agg(case when x.pause is not null then jsonb_build_object('kind', 'break', 'minutes', x.pause[1]::integer)
                        else jsonb_build_object('kind', 'level', 'small_blind', x.play[1]::integer, 'big_blind', x.play[2]::integer,
                                                'ante', coalesce(x.play[3], '0')::integer, 'minutes', x.play[4]::integer) end order by p.n)
  from regexp_split_to_table(p_notation, ';') with ordinality as p (part, n)
  cross join lateral (select regexp_match(btrim(p.part), '^break (\d+)$') as pause,
                             regexp_match(btrim(p.part), '^(\d+)/(\d+)(?: ante (\d+))? for (\d+)$') as play) x;
$$;
-- A golden '138:20' as seconds, and seconds back as minutes:seconds.
create function pg_temp.seconds(p_text text) returns integer language sql immutable as $$
  select split_part(p_text, ':', 1)::integer * 60 + split_part(p_text, ':', 2)::integer;
$$;
create function pg_temp.minutes_seconds(p_seconds integer) returns text language sql immutable as $$
  select (p_seconds / 60)::text || ':' || lpad((p_seconds % 60)::text, 2, '0');
$$;

-- The tournament clock: private.tournament_clock_at and @rivr/domain clockAt (packages/testing/golden/tournamentClock.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'tournamentClock.json'), 'the tournament clock cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'tournamentClock.json' and operation <> 'position' $$,
  'every operation in tournamentClock.json is proved here');
select results_eq(
  $$ select description, c.stage::text, c.level::text, case when c.is_break then 'yes' else 'no' end, pg_temp.minutes_seconds(c.seconds_left)
     from golden.golden_case
     cross join lateral private.tournament_clock_at(pg_temp.stages(inputs ->> 'levels'), pg_temp.seconds(inputs ->> 'elapsed')) c
     where file = 'tournamentClock.json' order by position $$,
  $$ select description, expected ->> 'stage', expected ->> 'level', expected ->> 'break', expected ->> 'left'
     from golden.golden_case where file = 'tournamentClock.json' order by position $$,
  'private.tournament_clock_at puts the clock where the golden file does');
select is_empty($$ select description from golden.golden_case where file = 'tournamentClock.json'
                   and private.blind_levels_problem(pg_temp.stages(inputs ->> 'levels')) is not null $$,
  'and every golden structure is one the clock can run');

-- Tournament entry rules: private.tournament_purchase_refusal and @rivr/domain checkPurchase
-- (packages/testing/golden/tournamentEntry.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'tournamentEntry.json'), 'the tournament entry cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'tournamentEntry.json' and operation <> 'purchase' $$,
  'every operation in tournamentEntry.json is proved here');
select results_eq(
  $$ select description, coalesce(private.tournament_purchase_refusal(
       inputs ->> 'purchase', inputs ->> 'format', (inputs ->> 'lastRegistrationLevel')::integer, nullif(inputs ->> 'maxBuys', '')::integer,
       inputs ->> 'addOn' = 'yes', (inputs ->> 'level')::integer, (inputs ->> 'buys')::integer, inputs ->> 'alive' = 'yes',
       inputs ->> 'addOnTaken' = 'yes'), 'allowed')
     from golden.golden_case where file = 'tournamentEntry.json' order by position $$,
  $$ select description, expected ->> 'result' from golden.golden_case where file = 'tournamentEntry.json' order by position $$,
  'private.tournament_purchase_refusal allows or refuses every purchase in the golden file');

-- Tournament money: private.tournament_pool_share and @rivr/domain poolShare (packages/testing/golden/tournamentMoney.json).
create function pg_temp.pool_share_or_refused(p_price bigint, p_fee bigint) returns text language plpgsql as $$
begin
  return private.tournament_pool_share(p_price, p_fee)::text;
exception when invalid_parameter_value then
  return 'refused';
end;
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'tournamentMoney.json'), 'the tournament money cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'tournamentMoney.json' and operation <> 'share' $$,
  'every operation in tournamentMoney.json is proved here');
select results_eq(
  $$ select description, pg_temp.pool_share_or_refused(pg_temp.paise(replace(inputs ->> 'price', '-', '')) * case when inputs ->> 'price' like '-%' then -1 else 1 end,
                                                        pg_temp.paise(replace(inputs ->> 'fee', '-', '')) * case when inputs ->> 'fee' like '-%' then -1 else 1 end)
     from golden.golden_case where file = 'tournamentMoney.json' order by position $$,
  $$ select description, case when expected ->> 'pool' = 'refused' then 'refused' else pg_temp.paise(expected ->> 'pool')::text end
     from golden.golden_case where file = 'tournamentMoney.json' order by position $$,
  'private.tournament_pool_share splits or refuses every buy in the golden file');

-- Tournament seating: private.tournament_eligible_seats and tournament_balancing_moves, and @rivr/domain
-- eligibleSeats and balancingMoves (packages/testing/golden/tournamentSeating.json).
create function pg_temp.seats(p_text text) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_array(split_part(s, '/', 1)::integer, split_part(s, '/', 2)::integer)), '[]')
  from unnest(string_to_array(nullif(p_text, ''), ' ')) s;
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'tournamentSeating.json'), 'the tournament seating cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'tournamentSeating.json' and operation not in ('eligible', 'balance', 'place') $$,
  'every operation in tournamentSeating.json is proved here');
select results_eq(
  $$ select description, coalesce((select string_agg(e.table_number || '/' || e.seat_number, ' ' order by e.table_number, e.seat_number)
                                   from private.tournament_eligible_seats(pg_temp.seats(inputs ->> 'occupied'), (inputs ->> 'tables')::integer,
                                                                          (inputs ->> 'seatsPerTable')::integer) e), '')
     from golden.golden_case where file = 'tournamentSeating.json' and operation = 'eligible' order by position $$,
  $$ select description, expected ->> 'seats' from golden.golden_case where file = 'tournamentSeating.json' and operation = 'eligible' order by position $$,
  'private.tournament_eligible_seats offers every seat the golden file does');
select results_eq(
  $$ select description, coalesce((select string_agg(m.from_table || '>' || m.to_table, ' ' order by m.move)
                                   from private.tournament_balancing_moves(string_to_array(inputs ->> 'counts', ' ')::integer[]) m), '')
     from golden.golden_case where file = 'tournamentSeating.json' and operation = 'balance' order by position $$,
  $$ select description, expected ->> 'moves' from golden.golden_case where file = 'tournamentSeating.json' and operation = 'balance' order by position $$,
  'private.tournament_balancing_moves balances every room in the golden file');
create function pg_temp.finish_place_or_refused(p_runs integer, p_rank integer) returns text language plpgsql as $$
begin
  return private.tournament_finish_place(p_runs, p_rank)::text;
exception when invalid_parameter_value then
  return 'refused';
end;
$$;
select results_eq(
  $$ select description, pg_temp.finish_place_or_refused((inputs ->> 'runs')::integer, (inputs ->> 'bustRank')::integer)
     from golden.golden_case where file = 'tournamentSeating.json' and operation = 'place' order by position $$,
  $$ select description, expected ->> 'place' from golden.golden_case where file = 'tournamentSeating.json' and operation = 'place' order by position $$,
  'private.tournament_finish_place places every bust in the golden file');

-- Tournament payouts, deals and bounties: private.tournament_prize_pool, tournament_payout_table,
-- tournament_chip_chop, tournament_icm and tournament_bounty_split, and @rivr/domain prizePool, payoutTable,
-- chipChop, icmDeal and bountyOnBust (packages/testing/golden/tournamentPayouts.json).
create function pg_temp.amounts(p_text text) returns bigint[] language sql immutable as $$
  select array(select pg_temp.paise(a) from unnest(string_to_array(p_text, ' ')) with ordinality u (a, n) order by n);
$$;
create function pg_temp.paid_or_refused(p_operation text, p_inputs jsonb) returns text language plpgsql as $$
begin
  return array_to_string(case p_operation
    -- Percent to two places, as basis points: "62.5" is 6,250.
    when 'payouts' then private.tournament_payout_table(pg_temp.paise(p_inputs ->> 'pool'),
                          array(select (s::numeric * 100)::integer from unnest(string_to_array(p_inputs ->> 'shares', ' ')) with ordinality u (s, n) order by n),
                          (p_inputs ->> 'runs')::integer)
    when 'chop' then private.tournament_chip_chop(string_to_array(p_inputs ->> 'stacks', ' ')::bigint[], pg_temp.amounts(p_inputs ->> 'prizes'))
    else private.tournament_icm(string_to_array(p_inputs ->> 'stacks', ' ')::bigint[], pg_temp.amounts(p_inputs ->> 'prizes')) end, ' ');
exception when invalid_parameter_value then
  return 'refused';
end;
$$;
create function pg_temp.bounty_or_refused(p_bounty bigint, p_kind text) returns text language plpgsql as $$
begin
  return (select b.paid_paise || ' ' || b.head_paise from private.tournament_bounty_split(p_bounty, p_kind) b);
exception when invalid_parameter_value then
  return 'refused';
end;
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'tournamentPayouts.json'), 'the tournament payout cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'tournamentPayouts.json'
                   and operation not in ('pool', 'payouts', 'chop', 'icm', 'bounty', 'satellite') $$,
  'every operation in tournamentPayouts.json is proved here');
select results_eq(
  $$ select description, p.pool_paise, p.overlay_paise from golden.golden_case
     cross join lateral private.tournament_prize_pool(pg_temp.paise(inputs ->> 'collected'), pg_temp.paise(nullif(inputs ->> 'guarantee', ''))) p
     where file = 'tournamentPayouts.json' and operation = 'pool' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'pool'), pg_temp.paise(expected ->> 'overlay') from golden.golden_case
     where file = 'tournamentPayouts.json' and operation = 'pool' order by position $$,
  'private.tournament_prize_pool tops up every pool in the golden file');
select results_eq(
  $$ select description, pg_temp.paid_or_refused(operation, inputs) from golden.golden_case
     where file = 'tournamentPayouts.json' and operation in ('payouts', 'chop', 'icm') order by position $$,
  $$ select description, case when coalesce(expected ->> 'prizes', expected ->> 'amounts') = 'refused' then 'refused'
                              else array_to_string(pg_temp.amounts(coalesce(expected ->> 'prizes', expected ->> 'amounts')), ' ') end
     from golden.golden_case where file = 'tournamentPayouts.json' and operation in ('payouts', 'chop', 'icm') order by position $$,
  'private.tournament_payout_table, tournament_chip_chop and tournament_icm pay every case in the golden file');
select results_eq(
  $$ select description, pg_temp.bounty_or_refused(pg_temp.paise(inputs ->> 'bounty'), inputs ->> 'kind') from golden.golden_case
     where file = 'tournamentPayouts.json' and operation = 'bounty' order by position $$,
  $$ select description, case when expected ->> 'paid' = 'refused' then 'refused'
                              else pg_temp.paise(expected ->> 'paid') || ' ' || pg_temp.paise(expected ->> 'head') end
     from golden.golden_case where file = 'tournamentPayouts.json' and operation = 'bounty' order by position $$,
  'private.tournament_bounty_split splits every bounty in the golden file');

-- Satellite seats: private.tournament_satellite_seats and @rivr/domain satelliteSeats (tournamentPayouts.json).
create function pg_temp.seats_or_refused(p_pool bigint, p_buy_in bigint, p_runs integer) returns text language plpgsql as $$
begin
  return (select s.seats || ' ' || s.leftover_paise || ' ' || s.leftover_place from private.tournament_satellite_seats(p_pool, p_buy_in, p_runs) s);
exception when invalid_parameter_value then
  return 'refused';
end;
$$;
select results_eq(
  $$ select description, pg_temp.seats_or_refused(pg_temp.paise(inputs ->> 'pool'), pg_temp.paise(inputs ->> 'buyIn'), (inputs ->> 'runs')::integer)
     from golden.golden_case where file = 'tournamentPayouts.json' and operation = 'satellite' order by position $$,
  $$ select description, case when expected ->> 'seats' = 'refused' then 'refused'
                              else (expected ->> 'seats') || ' ' || pg_temp.paise(expected ->> 'leftover') || ' ' || (expected ->> 'leftoverPlace') end
     from golden.golden_case where file = 'tournamentPayouts.json' and operation = 'satellite' order by position $$,
  'private.tournament_satellite_seats seats every satellite in the golden file');

-- AML cash limits and structuring: private.cash_limit_hit and private.is_near_limit, and @rivr/domain cashLimitHit and
-- isNearLimit (packages/testing/golden/aml.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'aml.json'), 'the AML cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'aml.json' and operation not in ('cash_limit', 'near_limit') $$,
  'every operation in aml.json is proved here');
select results_eq(
  $$ select description, coalesce(private.cash_limit_hit(pg_temp.paise(inputs ->> 'perVisit'), pg_temp.paise(inputs ->> 'perDay'),
                                                        pg_temp.paise(inputs ->> 'visitSoFar'), pg_temp.paise(inputs ->> 'daySoFar'),
                                                        pg_temp.paise(inputs ->> 'amount')), 'none')
     from golden.golden_case where file = 'aml.json' and operation = 'cash_limit' order by position $$,
  $$ select description, expected ->> 'hit' from golden.golden_case where file = 'aml.json' and operation = 'cash_limit' order by position $$,
  'private.cash_limit_hit gives every limit in the golden file');
select results_eq(
  $$ select description, private.is_near_limit(pg_temp.paise(inputs ->> 'total'), pg_temp.paise(inputs ->> 'limit'),
                                               (inputs ->> 'marginBasisPoints')::integer)::text
     from golden.golden_case where file = 'aml.json' and operation = 'near_limit' order by position $$,
  $$ select description, expected ->> 'near' from golden.golden_case where file = 'aml.json' and operation = 'near_limit' order by position $$,
  'private.is_near_limit gives every total in the golden file');

-- Hourly rakeback: private.rake_share summed over the week and private.rakeback_bonus, and
-- @rivr/domain weekRakeShares and rakebackBonus (packages/testing/golden/rakeback.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'rakeback.json'), 'the rakeback cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'rakeback.json' and operation not in ('week_share', 'rakeback') $$,
  'every operation in rakeback.json is proved here');
select results_eq(
  $$ select description,
            (select coalesce(sum(private.rake_share(pg_temp.paise(split_part(btrim(h), ' among ', 1)), split_part(btrim(h), ' among ', 2)::integer)), 0)::bigint
             from regexp_split_to_table(inputs ->> 'hands', ';') h)
     from golden.golden_case where file = 'rakeback.json' and operation = 'week_share' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'share') from golden.golden_case where file = 'rakeback.json' and operation = 'week_share' order by position $$,
  'private.rake_share, summed over the week, gives every share in the golden file');
select results_eq(
  $$ select description,
            private.rakeback_bonus(pg_temp.paise(inputs ->> 'share'), (inputs ->> 'rate')::integer,
                                   case when inputs ->> 'cap' = '' then null else pg_temp.paise(inputs ->> 'cap') end)
     from golden.golden_case where file = 'rakeback.json' and operation = 'rakeback' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'bonus') from golden.golden_case where file = 'rakeback.json' and operation = 'rakeback' order by position $$,
  'private.rakeback_bonus gives every rakeback in the golden file');

select * from finish();
rollback;
