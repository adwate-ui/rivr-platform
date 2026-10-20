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

select * from finish();
rollback;
