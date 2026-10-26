-- Tournament payouts, deals and bounties (#117, #121; decisions 0205, 0206): the SQL twins of
-- @rivr/domain prizePool, areSharesWhole, payoutTable, chipChop, icmDeal and bountyOnBust, proved equal on
-- packages/testing/golden/tournamentPayouts.json. Amounts are paise; every one is whole ₹50 chips.

-- The prize pool: what the buys put in for prizes, or the guarantee when that is more; the overlay is the
-- difference the club pays. 22023 below nothing.
create function private.tournament_prize_pool(p_collected_paise bigint, p_guarantee_paise bigint)
returns table (pool_paise bigint, overlay_paise bigint)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_collected_paise is null or p_collected_paise < 0 or p_guarantee_paise < 0 then
    raise exception 'A pool and a guarantee are nothing or more' using errcode = '22023';
  end if;
  pool_paise := greatest(p_collected_paise, coalesce(p_guarantee_paise, 0));
  overlay_paise := pool_paise - p_collected_paise;
  return next;
end;
$$;

-- The paid places' shares of the pool, as the floor sets them (question #470): one to a hundred, each above
-- nothing and no more than the place above's, in basis points adding up to 100%.
create function private.tournament_shares_whole(p_shares integer[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_shares), 0) between 1 and 100 and not exists (select 1 from unnest(p_shares) s where s is null or s <= 0)
     and not exists (select 1 from unnest(p_shares) with ordinality u (s, n) where n > 1 and s > p_shares[n - 1])
     and (select sum(s) from unnest(p_shares) s) = 10000;
$$;

-- The prizes, first place first: each paid place's share of the pool, the places that exist when there are
-- fewer runs than paid places sharing it in the same proportions, rounded down to ₹50 chips; the chips left
-- over go to first. 22023 for shares not adding up to 100%, no runs, or a pool not in ₹50 chips.
create function private.tournament_payout_table(p_pool_paise bigint, p_shares integer[], p_runs integer)
returns bigint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_chips numeric;
  v_weights numeric[];
  v_total numeric;
  v_prizes numeric[];
begin
  if not coalesce(private.tournament_shares_whole(p_shares), false) or coalesce(p_runs, 0) < 1 or p_pool_paise is null or p_pool_paise < 0
     or p_pool_paise % 5000 <> 0 then
    raise exception 'Shares adding up to 100%%, a run, and a pool in ₹50 chips' using errcode = '22023';
  end if;
  v_chips := p_pool_paise / 5000;
  v_weights := p_shares[1:least(cardinality(p_shares), p_runs)];
  v_total := (select sum(w) from unnest(v_weights) w);
  v_prizes := array(select div(v_chips * w, v_total) from unnest(v_weights) with ordinality u (w, n) order by n);
  v_prizes[1] := v_prizes[1] + v_chips - (select sum(p) from unnest(v_prizes) p);
  return array(select (p * 5000)::bigint from unnest(v_prizes) with ordinality u (p, n) order by n);
end;
$$;

-- A deal is two to nine players, each with chips, and one prize for each in ₹50 chips; 22023 otherwise.
create function private.tournament_deal_check(p_stacks bigint[], p_prizes bigint[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_stacks), 0) not between 2 and 9 or cardinality(p_stacks) <> coalesce(cardinality(p_prizes), 0)
     or exists (select 1 from unnest(p_stacks) s where s is null or s <= 0)
     or exists (select 1 from unnest(p_prizes) p where p is null or p < 0 or p % 5000 <> 0) then
    raise exception 'Two to nine players with chips, and a prize for each in ₹50 chips' using errcode = '22023';
  end if;
end;
$$;

-- Whole chips to each player, as paise in the stacks' order, the chips left over from the prizes to the
-- biggest stack (the first on a tie).
create function private.tournament_deal_settle(p_shares numeric[], p_stacks bigint[], p_prizes bigint[])
returns bigint[]
language sql
immutable
set search_path = ''
as $$
  select array(
    select ((s.share + case when s.n = array_position(p_stacks, (select max(x) from unnest(p_stacks) x))
                            then (select sum(p) / 5000 from unnest(p_prizes) p) - (select sum(x) from unnest(p_shares) x) else 0 end) * 5000)::bigint
    from unnest(p_shares) with ordinality s (share, n) order by s.n);
$$;

-- A chip-chop deal: each player is sure of the smallest prize left, and the rest is shared in proportion to
-- their chips, rounded down to ₹50 chips; the chips left over go to the biggest stack.
create function private.tournament_chip_chop(p_stacks bigint[], p_prizes bigint[])
returns bigint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_floor numeric;
  v_rest numeric;
  v_chips numeric;
begin
  perform private.tournament_deal_check(p_stacks, p_prizes);
  v_floor := (select min(p) from unnest(p_prizes) p) / 5000;
  v_rest := (select sum(p) from unnest(p_prizes) p) / 5000 - v_floor * cardinality(p_prizes);
  v_chips := (select sum(s) from unnest(p_stacks) s);
  return private.tournament_deal_settle(array(select v_floor + div(v_rest * s, v_chips) from unnest(p_stacks) with ordinality u (s, n) order by n),
                                        p_stacks, p_prizes);
end;
$$;

-- An ICM deal: each player gets the smallest prize left and what their chips are worth over the rest of each
-- prize by Malmuth-Harville (going down the places, each player not yet placed takes the next with the
-- chance of their share of the chips not yet placed), the chances worked to thirty decimal places and
-- rounded down, each value to the nearest paisa and then down to ₹50 chips; the chips left over go to the
-- biggest stack. The set
-- of players placed is a bit mask; v_reach[set + 1] is the chance they took the top places.
create function private.tournament_icm(p_stacks bigint[], p_prizes bigint[])
returns bigint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_scale constant numeric := 1000000000000000000000000000000;
  v_n integer := coalesce(cardinality(p_stacks), 0);
  v_floor bigint;
  v_chips numeric;
  v_reach numeric[];
  v_equity numeric[];
  v_placed integer;
  v_left numeric;
  v_chance numeric;
  v_next integer;
begin
  perform private.tournament_deal_check(p_stacks, p_prizes);
  v_floor := (select min(p) from unnest(p_prizes) p) / 5000;
  v_chips := (select sum(s) from unnest(p_stacks) s);
  v_reach := array_fill(0::numeric, array[1 << v_n]);
  v_reach[1] := v_scale;
  v_equity := array_fill(0::numeric, array[v_n]);
  for v_set in 0 .. (1 << v_n) - 1 loop
    v_placed := (select count(*) from generate_series(0, v_n - 1) j where (v_set >> j) & 1 = 1);
    v_left := v_chips - (select coalesce(sum(p_stacks[j + 1]), 0) from generate_series(0, v_n - 1) j where (v_set >> j) & 1 = 1);
    for v_player in 0 .. v_n - 1 loop
      continue when (v_set >> v_player) & 1 = 1;
      v_chance := div(v_reach[v_set + 1] * p_stacks[v_player + 1], v_left);
      v_next := v_set + (1 << v_player);
      v_reach[v_next + 1] := v_reach[v_next + 1] + v_chance;
      v_equity[v_player + 1] := v_equity[v_player + 1] + v_chance * (p_prizes[v_placed + 1] - v_floor * 5000);
    end loop;
  end loop;
  -- Each value to the nearest paisa (the chances' rounding never moves a whole paisa), then down to chips.
  return private.tournament_deal_settle(array(select v_floor + div(div(e + v_scale / 2, v_scale), 5000) from unnest(v_equity) with ordinality u (e, n) order by n),
                                        p_stacks, p_prizes);
end;
$$;

-- A busted player's bounty: all of it paid (standard), or half rounded down to ₹50 chips paid and the rest
-- on the eliminator's own head (progressive). 22023 for a bounty not in ₹50 chips or another kind.
create function private.tournament_bounty_split(p_bounty_paise bigint, p_kind text)
returns table (paid_paise bigint, head_paise bigint)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_bounty_paise is null or p_bounty_paise < 0 or p_bounty_paise % 5000 <> 0 or p_kind is null or p_kind not in ('standard', 'progressive') then
    raise exception 'A bounty in ₹50 chips, standard or progressive' using errcode = '22023';
  end if;
  paid_paise := case when p_kind = 'standard' then p_bounty_paise else p_bounty_paise / 2 - (p_bounty_paise / 2) % 5000 end;
  head_paise := p_bounty_paise - paid_paise;
  return next;
end;
$$;

revoke execute on function private.tournament_prize_pool(bigint, bigint), private.tournament_shares_whole(integer[]),
  private.tournament_payout_table(bigint, integer[], integer),
  private.tournament_deal_check(bigint[], bigint[]), private.tournament_deal_settle(numeric[], bigint[], bigint[]),
  private.tournament_chip_chop(bigint[], bigint[]), private.tournament_icm(bigint[], bigint[]), private.tournament_bounty_split(bigint, text)
  from public, anon, authenticated;
