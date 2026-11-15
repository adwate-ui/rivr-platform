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

-- The jackpot's pools: private.split_drop and @rivr/domain splitDrop (packages/testing/golden/jackpot.json).
create function pg_temp.basis_points(p_share text) returns integer language sql immutable as $$
  select (replace(p_share, '%', '')::numeric * 100)::integer;
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'jackpot.json'), 'the jackpot cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'jackpot.json' and operation <> 'split' $$,
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

-- More call time for a seat: private.extended_call_time and @rivr/domain extendedCallTime
-- (packages/testing/golden/callTimeExtension.json, decisions 0320 and 0305). The SQL refuses with null, whatever the reason.
select ok((select count(*) > 0 from golden.golden_case where file = 'callTimeExtension.json'), 'the call time extension cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'callTimeExtension.json' and operation <> 'extend' $$,
  'every operation in callTimeExtension.json is proved here');
select results_eq(
  $$ select description, private.extended_call_time((inputs ->> 'current')::integer, (inputs ->> 'played')::integer, (inputs ->> 'add')::integer)
     from golden.golden_case where file = 'callTimeExtension.json' order by position $$,
  $$ select description, nullif(expected ->> 'minutes', '')::integer from golden.golden_case where file = 'callTimeExtension.json' order by position $$,
  'private.extended_call_time gives every call time in the golden file, and refuses every refusal');

-- A bonus: private.bonus_draws and private.bonus_expiring, and @rivr/domain bonusSpend and bonusExpired
-- (packages/testing/golden/bonus.json). Grants are written "amount @ end | ...", the end "never" for one with none.
-- A golden list of amounts, '₹500 | ₹1,000', in paise.
create function pg_temp.paise_list(p_text text) returns bigint[] language sql immutable as $$
  select coalesce(array_agg(pg_temp.paise(trim(part)) order by n), '{}') from unnest(string_to_array(nullif(p_text, ''), '|')) with ordinality as u (part, n);
$$;
create function pg_temp.grant_amounts(p_text text) returns bigint[] language sql immutable as $$
  select pg_temp.paise_list(regexp_replace(coalesce(p_text, ''), '\s*@[^|]*', '', 'g'));
$$;
create function pg_temp.grant_ends(p_text text) returns timestamptz[] language sql immutable as $$
  select coalesce(array_agg(nullif(trim(split_part(part, '@', 2)), 'never')::timestamptz order by n), '{}')
  from unnest(string_to_array(nullif(p_text, ''), '|')) with ordinality as u (part, n);
$$;
select ok((select count(*) > 0 from golden.golden_case where file = 'bonus.json'), 'the bonus cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'bonus.json'
                   and operation not in ('spend', 'expire', 'end', 'visitCap', 'visitLeft') $$,
  'every operation in bonus.json is proved here');
-- Decision 0579: when a grant ends, and a visit's cap and what is left of it (bonusEnd, visitBonusCap, visitBonusLeft).
select results_eq(
  $$ select description, private.bonus_end((inputs ->> 'given')::timestamptz, (inputs ->> 'days')::integer, (inputs ->> 'since')::timestamptz)
     from golden.golden_case where file = 'bonus.json' and operation = 'end' order by position $$,
  $$ select description, nullif(expected ->> 'ends', 'never')::timestamptz
     from golden.golden_case where file = 'bonus.json' and operation = 'end' order by position $$,
  'private.bonus_end gives every end in the golden file');
select results_eq(
  $$ select description, private.visit_bonus_cap(pg_temp.paise(inputs ->> 'held'), (inputs ->> 'basisPoints')::integer)
     from golden.golden_case where file = 'bonus.json' and operation = 'visitCap' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'cap')
     from golden.golden_case where file = 'bonus.json' and operation = 'visitCap' order by position $$,
  'private.visit_bonus_cap gives every visit cap in the golden file');
select results_eq(
  $$ select description, private.visit_bonus_left(pg_temp.paise(inputs ->> 'cap'), pg_temp.paise(inputs ->> 'redeemed'))
     from golden.golden_case where file = 'bonus.json' and operation = 'visitLeft' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'left')
     from golden.golden_case where file = 'bonus.json' and operation = 'visitLeft' order by position $$,
  'private.visit_bonus_left gives what every visit has left in the golden file');
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
  $$ select description, coalesce((select r.cost_paise::text from private.promotion_reward((inputs ->> 'effect')::jsonb, pg_temp.paise(inputs ->> 'amount')) r),
                                  'nothing')
     from golden.golden_case where file = 'promotions.json' and operation = 'reward' order by position $$,
  $$ select description, case when expected ->> 'reward' = 'nothing' then 'nothing' else pg_temp.paise(expected ->> 'reward')::text end
     from golden.golden_case where file = 'promotions.json' and operation = 'reward' order by position $$,
  'private.promotion_reward gives every reward in the golden file');
select results_eq(
  $$ select description, coalesce(nullif(array_to_string(private.promotions_to_give((inputs ->> 'candidates')::jsonb), ' | '), ''), 'none')
     from golden.golden_case where file = 'promotions.json' and operation = 'select' order by position $$,
  $$ select description, expected ->> 'given' from golden.golden_case where file = 'promotions.json' and operation = 'select' order by position $$,
  'private.promotions_to_give gives every selection in the golden file');

-- Shares: private.table_played_seconds and rake_share, and @rivr/domain's (packages/testing/golden/shares.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'shares.json'), 'the shares cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'shares.json' and operation not in ('table_time', 'rake_share') $$,
  'every operation in shares.json is proved here');
select results_eq(
  $$ select description, case operation
       when 'table_time' then private.table_played_seconds((inputs ->> 'tableSeconds')::bigint, (inputs ->> 'sessionSeconds')::bigint,
                                                           (inputs ->> 'playedSeconds')::bigint)
       else private.rake_share(pg_temp.paise(inputs ->> 'rake'), (inputs ->> 'seated')::integer) end
     from golden.golden_case where file = 'shares.json' order by position $$,
  $$ select description, case operation
       when 'table_time' then (expected ->> 'seconds')::bigint
       else pg_temp.paise(expected ->> 'share') end
     from golden.golden_case where file = 'shares.json' order by position $$,
  'the share rules give every case in the golden file');

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


-- The Glaza statement: private.glaza_payable and @rivr/domain glazaPayable (packages/testing/golden/glaza.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'glaza.json'), 'the Glaza statement cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'glaza.json' and operation not in ('payable', 'statement') $$,
  'every operation in glaza.json is proved here');
select results_eq(
  $$ select description, p.rivr_share_paise, p.payable_paise
     from golden.golden_case
     cross join lateral private.glaza_payable(pg_temp.paise(inputs ->> 'comps'), pg_temp.paise(inputs ->> 'alcoholMargin')) p
     where file = 'glaza.json' and operation = 'payable' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'rivrShare'), pg_temp.paise(expected ->> 'payable')
     from golden.golden_case where file = 'glaza.json' and operation = 'payable' order by position $$,
  'private.glaza_payable gives every Glaza payable in the golden file');
-- A month's lines such as "2 × soft_drink ₹20 cost ₹60 price comp; 3 × alcohol ₹150 cost ₹400 price".
create function pg_temp.glaza_lines(p_text text) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', m[2], 'quantity', m[1]::integer, 'unit_cost_paise', pg_temp.paise(m[3]),
                                               'unit_price_paise', pg_temp.paise(m[4]), 'is_comp', m[5] is not null) order by u.n), '[]'::jsonb)
  from unnest(string_to_array(p_text, ';')) with ordinality as u (raw, n)
  cross join lateral regexp_match(btrim(u.raw), '^(\d+) × (food|soft_drink|alcohol) (₹[\d,.]+) cost (₹[\d,.]+) price( comp)?$') m
  where btrim(u.raw) <> '';
$$;
select results_eq(
  $$ select description, s.food_comps_paise, s.soft_drink_comps_paise, s.alcohol_comps_paise, s.comps_paise, s.alcohol_sales_paise,
            s.alcohol_cost_paise, s.alcohol_margin_paise, s.rivr_share_paise, s.payable_paise
     from golden.golden_case cross join lateral private.glaza_statement_of(pg_temp.glaza_lines(inputs ->> 'lines')) s
     where file = 'glaza.json' and operation = 'statement' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'foodComps'), pg_temp.paise(expected ->> 'softDrinkComps'), pg_temp.paise(expected ->> 'alcoholComps'),
            pg_temp.paise(expected ->> 'comps'), pg_temp.paise(expected ->> 'alcoholSales'), pg_temp.paise(expected ->> 'alcoholCost'),
            pg_temp.paise(expected ->> 'alcoholMargin'), pg_temp.paise(expected ->> 'rivrShare'), pg_temp.paise(expected ->> 'payable')
     from golden.golden_case where file = 'glaza.json' and operation = 'statement' order by position $$,
  'private.glaza_statement_of gives every Glaza statement in the golden file');

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


-- Promotion schedules (console v3, decision 0472): private.is_in_schedule and private.seconds_in_schedule, and @rivr/domain
-- isInSchedule and secondsInSchedule (packages/testing/golden/promotionSchedule.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'promotionSchedule.json'), 'the promotion schedule cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'promotionSchedule.json' and operation not in ('in', 'seconds') $$,
  'every operation in promotionSchedule.json is proved here');
select results_eq(
  $$ select description, case when private.is_in_schedule((inputs ->> 'schedule')::jsonb, (inputs ->> 'at')::timestamptz) then 'yes' else 'no' end
     from golden.golden_case where file = 'promotionSchedule.json' and operation = 'in' order by position $$,
  $$ select description, expected ->> 'inSchedule' from golden.golden_case where file = 'promotionSchedule.json' and operation = 'in' order by position $$,
  'private.is_in_schedule decides every moment in the golden file');
select results_eq(
  $$ select description, private.seconds_in_schedule((inputs ->> 'schedule')::jsonb, (inputs ->> 'from')::timestamptz, (inputs ->> 'to')::timestamptz)
     from golden.golden_case where file = 'promotionSchedule.json' and operation = 'seconds' order by position $$,
  $$ select description, (expected ->> 'seconds')::bigint from golden.golden_case where file = 'promotionSchedule.json' and operation = 'seconds' order by position $$,
  'private.seconds_in_schedule counts every span in the golden file');

-- Promotion rewards (console v3, decisions 0470 and 0472): private.promo_is_eligible, private.promo_grant,
-- private.promo_check_limits and private.promo_stack, and @rivr/domain isEligible, computeGrant, checkLimits and stackGrants
-- (packages/testing/golden/promotionRewards.json). The high hand bonus's cases (redesign RD-22) are grants and limits like
-- any other, with the hand a hit is paid as and what is left of a budget.
select ok((select count(*) > 0 from golden.golden_case where file = 'promotionRewards.json'), 'the promotion reward cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'promotionRewards.json'
                   and operation not in ('eligible', 'grant', 'limits', 'stack', 'tally', 'periodKey', 'steps', 'tier', 'paid', 'left') $$,
  'every operation in promotionRewards.json is proved here');
-- Redesign RD-22: the listed hand a high hand hit is paid as, with its rank (@rivr/domain highHandPayout).
select results_eq(
  $$ select description, coalesce(h.o_refusal, h.o_hand || ' ' || coalesce(h.o_rank, ''))
     from golden.golden_case cross join lateral private.high_hand_payout((inputs ->> 'reward')::jsonb, (inputs ->> 'hit')::jsonb) h
     where file = 'promotionRewards.json' and operation = 'paid' order by position $$,
  $$ select description, coalesce(expected ->> 'refusal', (expected ->> 'hand') || ' ' || (expected ->> 'rank'))
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'paid' order by position $$,
  'private.high_hand_payout pays every hit in the golden file as its listed hand');
-- And what is left of a budget, which a refusal for the budget says (@rivr/domain budgetLeft).
select results_eq(
  $$ select description, coalesce(private.promo_budget_left((inputs ->> 'limits')::jsonb, (inputs ->> 'tally')::jsonb)::text, 'none')
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'left' order by position $$,
  $$ select description, expected ->> 'left' from golden.golden_case where file = 'promotionRewards.json' and operation = 'left' order by position $$,
  'private.promo_budget_left leaves every budget in the golden file what it should');
-- Decision 0580: a seat bonus's tier for the next claim (@rivr/domain tierChips).
select results_eq(
  $$ select description, coalesce(private.promo_tier_chips(jsonb_build_object('kind', 'seat_bonus', 'tiers', (inputs ->> 'tiers')::jsonb),
                                                          (inputs ->> 'claimed')::integer)::text, 'used_up')
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'tier' order by position $$,
  $$ select description, expected ->> 'chips' from golden.golden_case where file = 'promotionRewards.json' and operation = 'tier' order by position $$,
  'private.promo_tier_chips gives every tier in the golden file');
select results_eq(
  $$ select description, case when private.promo_is_eligible((inputs ->> 'terms')::jsonb, (inputs ->> 'member')::jsonb, (inputs ->> 'context')::jsonb)
                              then 'yes' else 'no' end
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'eligible' order by position $$,
  $$ select description, expected ->> 'eligible' from golden.golden_case where file = 'promotionRewards.json' and operation = 'eligible' order by position $$,
  'private.promo_is_eligible decides every member in the golden file');
select results_eq(
  $$ select description, coalesce(g.o_refusal, g.o_chips || ' | ' || coalesce(g.o_perk, ''))
     from golden.golden_case cross join lateral private.promo_grant((inputs ->> 'reward')::jsonb, (inputs ->> 'event')::jsonb) g
     where file = 'promotionRewards.json' and operation = 'grant' order by position $$,
  $$ select description, coalesce(expected ->> 'refusal',
                                   (expected ->> 'chips') || ' | ' || (expected ->> 'perk'))
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'grant' order by position $$,
  'private.promo_grant gives every grant in the golden file');
select results_eq(
  $$ select description, coalesce(private.promo_check_limits((inputs ->> 'reward')::jsonb, (inputs ->> 'limits')::jsonb, (inputs ->> 'grant')::jsonb,
                                                             (inputs ->> 'tally')::jsonb), '')
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'limits' order by position $$,
  $$ select description, expected ->> 'refusal' from golden.golden_case where file = 'promotionRewards.json' and operation = 'limits' order by position $$,
  'private.promo_check_limits lets through or stops every grant in the golden file');
select results_eq(
  $$ select description, coalesce(nullif(array_to_string(private.promo_stack((inputs ->> 'candidates')::jsonb), ' | '), ''), 'none')
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'stack' order by position $$,
  $$ select description, expected ->> 'given' from golden.golden_case where file = 'promotionRewards.json' and operation = 'stack' order by position $$,
  'private.promo_stack stacks every event in the golden file');

-- @rivr/domain periodKey and slotKey: private.promo_period_key and private.promo_slot_key (decision 0499).
select results_eq(
  $$ select description, private.promo_slot_key(private.promo_period_key((inputs ->> 'limits')::jsonb, (inputs ->> 'event')::jsonb ->> 'key',
                                                                         ((inputs ->> 'event')::jsonb ->> 'at')::timestamptz,
                                                                         ((inputs ->> 'event')::jsonb ->> 'visitId')::uuid,
                                                                         private.promo_step_key((inputs ->> 'reward')::jsonb,
                                                                                                ((inputs ->> 'event')::jsonb ->> 'stepMinutes')::integer)),
                                                (inputs ->> 'given')::integer)
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'periodKey' order by position $$,
  $$ select description, expected ->> 'key' from golden.golden_case where file = 'promotionRewards.json' and operation = 'periodKey' order by position $$,
  'private.promo_period_key and promo_slot_key key every grant in the golden file');

-- @rivr/domain stepsReached: private.promo_hours_steps, the steps a play-time bonus reaches in the minutes played (owner, 8 Nov).
select results_eq(
  $$ select description, coalesce((select string_agg(s.o_after_minutes::text, ',' order by s.o_after_minutes)
                                   from private.promo_hours_steps((inputs ->> 'reward')::jsonb) s
                                   where s.o_after_minutes <= (inputs ->> 'minutes')::integer), '')
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'steps' order by position $$,
  $$ select description, expected ->> 'steps' from golden.golden_case where file = 'promotionRewards.json' and operation = 'steps' order by position $$,
  'private.promo_hours_steps reaches every step in the golden file');

-- @rivr/domain tallyFor: private.promotion_tally over a promotion holding the fixture's ledger as grants (decision 0499).
-- The fixture's two tables are Gurugram's Table 1 and Table 2.
create function pg_temp.golden_table(p_id text) returns uuid language sql as $$
  select g.id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001'
    and g.name = case p_id when '00000000-0000-4000-8000-0000000071a1' then 'Table 1' when '00000000-0000-4000-8000-0000000071a2' then 'Table 2' end;
$$;
create function pg_temp.golden_tally(p_inputs jsonb) returns text language plpgsql as $$
declare
  v_promotion uuid;
  v_version uuid;
  v_limits jsonb := (p_inputs ->> 'limits')::jsonb;
  v_event jsonb := (p_inputs ->> 'event')::jsonb;
  v_tally jsonb;
begin
  insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Golden tally') returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 1, 'ended', 'Golden tally', '{"kind": "bonus_chips", "chips": 500, "on": "visit"}',
          '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          '{"days": [1, 2, 3, 4, 5, 6, 7], "from": "06:00", "to": "06:00", "startsOn": "2026-10-01", "timezone": "Asia/Kolkata"}', v_limits,
          '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}')
  returning id into v_version;
  insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, table_id, trigger, effect, cost_paise, chips,
                                      perk, source_key, period_key, club_day)
  select '00000000-0000-4000-8000-000000000001', v_promotion, v_version, (e ->> 'memberId')::uuid, pg_temp.golden_table(e ->> 'tableId'), 'seated', '{}',
         (e ->> 'chips')::bigint * 100, (e ->> 'chips')::bigint, e ->> 'perk', 'golden:' || n,
         e ->> 'periodKey', (e ->> 'clubDay')::date
  from jsonb_array_elements((p_inputs ->> 'ledger')::jsonb) with ordinality as l (e, n);
  v_tally := private.promotion_tally(v_promotion, (v_event ->> 'memberId')::uuid,
    private.promo_period_key(v_limits, v_event ->> 'key', (v_event ->> 'at')::timestamptz, (v_event ->> 'visitId')::uuid),
    pg_temp.golden_table(v_event ->> 'tableId'), private.club_day_of((v_event ->> 'at')::timestamptz), v_limits);
  return concat_ws(' | ', v_tally ->> 'chipsGiven', v_tally ->> 'grantsGiven', v_tally ->> 'membersToday', v_tally ->> 'isMemberGrantedToday',
                   v_tally ->> 'periodGiven', coalesce(v_tally ->> 'grantsAtTableToday', ''));
end;
$$;
select results_eq(
  $$ select description, pg_temp.golden_tally(inputs)
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'tally' order by position $$,
  $$ select description, concat_ws(' | ', expected ->> 'chipsGiven', expected ->> 'grantsGiven', expected ->> 'membersToday', expected ->> 'isMemberGrantedToday',
                                   expected ->> 'periodGiven', expected ->> 'grantsAtTableToday')
     from golden.golden_case where file = 'promotionRewards.json' and operation = 'tally' order by position $$,
  'private.promotion_tally counts every ledger in the golden file');

select * from finish();
rollback;
