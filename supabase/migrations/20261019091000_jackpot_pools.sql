-- The bad-beat jackpot's pools (#48, scope-v1 module 8; additions, "Jackpot sub-pools"). Every drop
-- splits between the main, season and freeroll pools by the venue's jackpot.shares in force when the
-- hand was played: season and freeroll take their shares rounded down to the paisa, the main pool
-- the rest; with no shares set the whole drop goes to the main pool (so flow 4's jackpot still
-- reads ₹3,42,700). Each pool is its own ledger account, players' money. public_jackpot gives the
-- pools to the TVs and the player app: the ledger's balances, so a pool is always its drops less
-- its payouts. Payouts, reversals and the console's Jackpots screen follow (#48 part 2).

insert into public.setting_key (key, description, scope, value_schema) values
  ('jackpot.shares',
   'The season and freeroll pools'' shares of every jackpot drop, in basis points (2000 is 20%), up to 50% each; the main pool takes the rest (additions, "Jackpot sub-pools").',
   'venue',
   '{"type":"object","properties":{"season_basis_points":{"type":"integer","minimum":0,"maximum":5000},"freeroll_basis_points":{"type":"integer","minimum":0,"maximum":5000}},"required":["season_basis_points","freeroll_basis_points"],"additionalProperties":false}');

-- @rivr/domain splitDrop in SQL, proved on packages/testing/golden/jackpot.json (024_golden_twins).
create function private.split_drop(p_drop bigint, p_season_basis_points integer, p_freeroll_basis_points integer)
returns table (main bigint, season bigint, freeroll bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_season bigint;
  v_freeroll bigint;
begin
  if p_drop is null or p_drop < 0 then
    raise exception 'A drop is never negative or missing' using errcode = '22023';
  end if;
  if p_season_basis_points is null or p_freeroll_basis_points is null or p_season_basis_points < 0 or p_freeroll_basis_points < 0
     or p_season_basis_points + p_freeroll_basis_points > 10000 then
    raise exception 'The season and freeroll shares are 0%% to 100%% together' using errcode = '22023';
  end if;
  v_season := (p_drop * p_season_basis_points) / 10000;
  v_freeroll := (p_drop * p_freeroll_basis_points) / 10000;
  return query select p_drop - v_season - v_freeroll, v_season, v_freeroll;
end;
$$;

-- @rivr/domain badBeatPayout in SQL, proved on the same file: the rule's share of the main pool,
-- the loser's and winner's parts in whole ₹50 chips, the table's part shared equally among the
-- others dealt in, each share in whole chips. What rounds away stays in the pool.
create function private.bad_beat_payout(p_pool bigint, p_pool_basis_points integer, p_loser_basis_points integer,
                                        p_winner_basis_points integer, p_table_basis_points integer, p_others integer)
returns table (loser bigint, winner bigint, each_at_table bigint, total bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_paid bigint;
  v_loser bigint;
  v_winner bigint;
  v_each bigint := 0;
begin
  if p_pool is null or p_pool < 0 or p_others is null or p_others < 0 then
    raise exception 'A pool and a count of players are never negative or missing' using errcode = '22023';
  end if;
  if p_pool_basis_points is null or p_pool_basis_points not between 0 and 10000
     or p_loser_basis_points is null or p_winner_basis_points is null or p_table_basis_points is null
     or p_loser_basis_points < 0 or p_winner_basis_points < 0 or p_table_basis_points < 0
     or p_loser_basis_points + p_winner_basis_points + p_table_basis_points <> 10000 then
    raise exception 'A payout pays 0%% to 100%% of the pool, split 100%% between loser, winner and table' using errcode = '22023';
  end if;
  v_paid := (p_pool * p_pool_basis_points) / 10000;
  v_loser := (v_paid * p_loser_basis_points) / 10000;
  v_loser := v_loser - v_loser % 5000;
  v_winner := (v_paid * p_winner_basis_points) / 10000;
  v_winner := v_winner - v_winner % 5000;
  if p_others > 0 then
    v_each := ((v_paid * p_table_basis_points) / 10000) / p_others;
    v_each := v_each - v_each % 5000;
  end if;
  return query select v_loser, v_winner, v_each, v_loser + v_winner + v_each * p_others;
end;
$$;

-- Posts a hand's rake and drop, as #42 did, with the drop now split between the pools by the shares
-- in force when the hand was played: one balanced transaction, chips in play debited and each pool
-- with a part credited. Nothing posts for a nought.
create or replace function private.post_hand(p_venue_id uuid, p_hand_id uuid, p_rake bigint, p_drop bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shares jsonb := private.setting_at(p_venue_id, 'jackpot.shares', '', (select h.played_at from public.hand h where h.id = p_hand_id));
  v_split record;
  v_legs jsonb;
begin
  if p_rake > 0 then
    perform private.post_ledger_transaction(p_venue_id, 'hand_rake', 'hand:' || p_hand_id || ':rake',
      jsonb_build_array(
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.chips_outstanding'),
                           'amount', p_rake::text),
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.rake'),
                           'amount', (-p_rake)::text)),
      null, 'Rake from a hand');
  end if;
  if p_drop > 0 then
    select * into v_split from private.split_drop(p_drop, coalesce((v_shares ->> 'season_basis_points')::integer, 0),
                                                   coalesce((v_shares ->> 'freeroll_basis_points')::integer, 0));
    select jsonb_agg(jsonb_build_object('account_id', a.id, 'amount', l.amount::text)) into v_legs
    from (values ('venue.chips_outstanding', p_drop), ('venue.jackpot.main', -v_split.main),
                 ('venue.jackpot.season', -v_split.season), ('venue.jackpot.freeroll', -v_split.freeroll)) as l (code, amount)
    join public.ledger_account a on a.venue_id = p_venue_id and a.code = l.code
    where l.amount <> 0;
    perform private.post_ledger_transaction(p_venue_id, 'jackpot_drop', 'hand:' || p_hand_id || ':drop', v_legs,
      null, 'Jackpot drop from a hand');
  end if;
end;
$$;

-- The club's jackpot pools, as the TVs and the player app show them: the ledger's balances of the
-- main, season and freeroll accounts. Never the practice venue; no personal data.
create function private.public_jackpot_rows()
returns table (venue_slug text, main_paise bigint, season_paise bigint, freeroll_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug,
         coalesce(sum(b.natural_balance) filter (where b.code = 'venue.jackpot.main'), 0)::bigint,
         coalesce(sum(b.natural_balance) filter (where b.code = 'venue.jackpot.season'), 0)::bigint,
         coalesce(sum(b.natural_balance) filter (where b.code = 'venue.jackpot.freeroll'), 0)::bigint
  from public.venue v
  left join public.ledger_balance b on b.venue_id = v.id and b.code like 'venue.jackpot.%'
  where not v.is_practice
  group by v.slug;
$$;

revoke execute on function private.split_drop(bigint, integer, integer),
  private.bad_beat_payout(bigint, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function private.public_jackpot_rows() to anon, authenticated;

create view public.public_jackpot
with (security_invoker = true)
as
select venue_slug, main_paise, season_paise, freeroll_paise from private.public_jackpot_rows();

grant select on public.public_jackpot to anon, authenticated;
