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

-- A buy-in at the cage: private.buy_in_check and @rivr/domain buyIn (packages/testing/golden/cage.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'cage.json'), 'the cage buy-in cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'cage.json' and operation <> 'buy_in' $$,
  'every operation in cage.json is proved here');
select results_eq(
  $$ select description, c.result, c.debit
     from golden.golden_case
     cross join lateral private.buy_in_check(inputs ->> 'method', pg_temp.paise(inputs ->> 'amount'), pg_temp.paise(inputs ->> 'minimum'),
                                             pg_temp.paise(inputs ->> 'wallet')) c
     where file = 'cage.json' order by position $$,
  $$ select description, expected ->> 'result', expected ->> 'debit' from golden.golden_case where file = 'cage.json' order by position $$,
  'private.buy_in_check gives every buy-in in the golden file');

select * from finish();
rollback;
