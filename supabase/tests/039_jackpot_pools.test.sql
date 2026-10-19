-- The jackpot's pools (#48): with the venue's shares at 20% season and 10% freeroll from an hour
-- ago, a ₹48,000 hand's ₹100 drop lands ₹70, ₹20 and ₹10 in the pools in one balanced transaction;
-- a hand played before the shares took effect sends its drop to the main pool; public_jackpot gives
-- the club's pools as the ledger holds them (seed and drops, less payouts), to anyone, and never the
-- practice venue's.
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
grant execute on function pg_temp.as_person(text) to authenticated;

-- Tablet A at Table 3, during Pema's down from two hours ago.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at)
select a.venue_id, a.table_id, s.id, a.device_id, now() - interval '2 hours'
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d001';
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'jackpot.shares', '', '{"season_basis_points": 2000, "freeroll_basis_points": 1000}',
   now() - interval '1 hour', 'Test');
create temporary table before_balances on commit drop as
select pg_temp.natural('venue.jackpot.main') as main, pg_temp.natural('venue.jackpot.season') as season,
       pg_temp.natural('venue.jackpot.freeroll') as freeroll, pg_temp.natural('venue.chips_outstanding') as chips;

select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table hands on commit drop as
select public.log_hand(4800000, 'holdem', now(), 'pools-after-shares') as hand_id, 'after' as played
union all select public.log_hand(4800000, 'holdem', now() - interval '90 minutes', 'pools-before-shares'), 'before';
reset role;

select results_eq(
  $$ select pg_temp.natural('venue.jackpot.main') - main, pg_temp.natural('venue.jackpot.season') - season,
            pg_temp.natural('venue.jackpot.freeroll') - freeroll, chips - pg_temp.natural('venue.chips_outstanding')
     from before_balances $$,
  $$ values (17000::bigint, 2000::bigint, 1000::bigint, 500000::bigint) $$,
  'the main pool takes ₹70 and ₹100, season ₹20 and freeroll ₹10; ₹5,000 of chips leave play (two ₹2,400 rakes and two drops)');
select results_eq(
  $$ select count(*)::integer, sum(e.amount)::bigint
     from public.ledger_entry e join public.ledger_transaction t on t.id = e.transaction_id
     join hands h on t.idempotency_key = 'hand:' || h.hand_id || ':drop' where h.played = 'after' $$,
  $$ values (4, 0::bigint) $$,
  'the split drop is one balanced transaction of four legs');
select results_eq(
  $$ select count(*)::integer from public.ledger_entry e join public.ledger_transaction t on t.id = e.transaction_id
     join hands h on t.idempotency_key = 'hand:' || h.hand_id || ':drop' where h.played = 'before' $$,
  $$ values (2) $$,
  'a hand played before the shares took effect drops into the main pool alone');

-- What the TVs and the player app read.
create temporary table ledger_pools on commit drop as
select (select slug from public.venue where id = '00000000-0000-4000-8000-000000000001') as venue_slug,
       pg_temp.natural('venue.jackpot.main') as main, pg_temp.natural('venue.jackpot.season') as season,
       pg_temp.natural('venue.jackpot.freeroll') as freeroll;
grant select on ledger_pools to anon;
set local role anon;
select results_eq(
  $$ select j.main_paise, j.season_paise, j.freeroll_paise from public.public_jackpot j join ledger_pools l using (venue_slug) $$,
  $$ select main, season, freeroll from ledger_pools $$,
  'a visitor reads the club''s pools as the ledger holds them');
select is((select main_paise from public.public_jackpot), 34277000::bigint,
  'the main pool: the seed''s ₹3,42,600, plus the drops'' ₹170, less no payouts');
select is((select count(*)::integer from public.public_jackpot), 1, 'and only the club''s, never the practice venue''s');
reset role;

-- Whole numbers written with a decimal point pass a setting's schema and must not stop hands: from
-- ten minutes ago the shares are 50% and 50% (the main pool takes nothing) and the rake as 500.0.
-- Written as a migration writes them, with nobody signed in.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'jackpot.shares', '', '{"season_basis_points": 5000.0, "freeroll_basis_points": 5000.0}',
   now() - interval '10 minutes', 'Test'),
  ('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_100_200', '{"rate_basis_points": 500.0, "cap_paise": 600000.0}',
   now() - interval '10 minutes', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table decimal_hand on commit drop as select public.log_hand(4800000, 'holdem', now(), 'pools-decimal') as hand_id;
reset role;
select results_eq(
  $$ select h.rake_paise, h.drop_paise from public.hand h join decimal_hand d on d.hand_id = h.id $$,
  $$ values (240000::bigint, 10000::bigint) $$,
  'a hand logs under settings written as 500.0 and 5000.0');
select results_eq(
  $$ select a.code, e.amount from public.ledger_entry e join public.ledger_transaction t on t.id = e.transaction_id
     join public.ledger_account a on a.id = e.account_id join decimal_hand d on t.idempotency_key = 'hand:' || d.hand_id || ':drop'
     order by a.code $$,
  $$ values ('venue.chips_outstanding', 10000::bigint), ('venue.jackpot.freeroll', -5000::bigint), ('venue.jackpot.season', -5000::bigint) $$,
  'at 50% and 50% the drop posts three legs: the main pool''s nought is left out');

-- Who may call what, and what the view shows.
select ok(not has_function_privilege('authenticated', 'private.post_hand(uuid, uuid, bigint, bigint)', 'execute')
          and not has_function_privilege('service_role', 'private.post_hand(uuid, uuid, bigint, bigint)', 'execute')
          and not has_function_privilege('anon', 'private.post_hand(uuid, uuid, bigint, bigint)', 'execute'),
  'no client posts a hand''s money itself');
select ok(not has_function_privilege('authenticated', 'private.split_drop(bigint, integer, integer)', 'execute')
          and not has_function_privilege('authenticated', 'private.bad_beat_payout(bigint, integer, integer, integer, integer, integer)', 'execute')
          and not has_function_privilege('authenticated', 'private.rake_rules_at(uuid, timestamptz)', 'execute'),
  'nor calls the rules underneath');
select columns_are('public', 'public_jackpot', array['venue_slug', 'main_paise', 'season_paise', 'freeroll_paise'],
  'public_jackpot shows the venue and its three pools, nothing more');

-- A drop split's shares are 0% to 100% together, and each of the setting's at most 50%.
select throws_ok($$ select * from private.split_drop(10000, 6000, 5000) $$, '22023', null, 'shares above 100% together are refused');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'jackpot.shares', '', '{"season_basis_points": 6000, "freeroll_basis_points": 0}', now() + interval '1 day') $$, '23514', null,
  'a pool''s share of the drop is at most 50%');
select throws_ok($$ select * from private.bad_beat_payout(100000, 10000, 5000, 2500, 2499, 3) $$, '22023', null,
  'a payout split that is not 100% is refused');
select throws_ok($$ select private.post_hand('00000000-0000-4000-8000-000000000002', (select hand_id from decimal_hand), 0, 10000) $$,
  '22023', null, 'a hand is posted only at its own venue');

select * from finish();
rollback;
