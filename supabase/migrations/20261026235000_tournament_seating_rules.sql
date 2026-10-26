-- The rules registration and the floor run in the database, each the twin of its @rivr/domain rule
-- and proved on its golden file in supabase/tests/024_golden_twins.test.sql (#118, #120; decisions 0203,
-- 0204): what a buy puts in the prize pool, the seats a new player may be given, the moves that balance
-- the tables, and the place a bust finishes in.

-- @rivr/domain poolShare: a buy's price less its fee, the fee nothing or more and below the price.
create function private.tournament_pool_share(p_price_paise bigint, p_fee_paise bigint)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_price_paise is null or p_fee_paise is null or p_fee_paise < 0 or p_fee_paise >= p_price_paise then
    raise exception 'A fee is part of the price, below it' using errcode = '22023';
  end if;
  return p_price_paise - p_fee_paise;
end;
$$;

-- @rivr/domain eligibleSeats: every free seat at the tables with the fewest players among those with a
-- free seat, in table then seat order. p_occupied is [[table, seat], ...].
create function private.tournament_eligible_seats(p_occupied jsonb, p_tables integer, p_seats_per_table integer)
returns table (table_number integer, seat_number integer)
language sql
immutable
set search_path = ''
as $$
  with taken as (
    select (o.value ->> 0)::integer as table_number, (o.value ->> 1)::integer as seat_number from jsonb_array_elements(p_occupied) o
  ),
  open_table as (
    select g.n as table_number, (select count(*) from taken t where t.table_number = g.n) as players
    from generate_series(1, p_tables) g (n)
  )
  select o.table_number, s.n
  from open_table o cross join generate_series(1, p_seats_per_table) s (n)
  where o.players < p_seats_per_table
    and o.players = (select min(x.players) from open_table x where x.players < p_seats_per_table)
    and not exists (select 1 from taken t where t.table_number = o.table_number and t.seat_number = s.n)
  order by 1, 2;
$$;

-- @rivr/domain balancingMoves: while the fullest table has two or more players than the emptiest, one
-- moves from the fullest to the emptiest, the lowest-numbered of each on a tie.
create function private.tournament_balancing_moves(p_counts integer[])
returns table (move integer, from_table integer, to_table integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_seated integer[] := p_counts;
  v_most integer;
  v_fewest integer;
  v_from integer;
  v_to integer;
begin
  move := 0;
  loop
    select max(c), min(c) into v_most, v_fewest from unnest(v_seated) c;
    exit when v_most is null or v_most - v_fewest <= 1;
    v_from := array_position(v_seated, v_most);
    v_to := array_position(v_seated, v_fewest);
    v_seated[v_from] := v_most - 1;
    v_seated[v_to] := v_fewest + 1;
    move := move + 1;
    from_table := v_from;
    to_table := v_to;
    return next;
  end loop;
end;
$$;

-- @rivr/domain finishPlace: the place a run finished in, from the runs in the tournament and where its bust
-- stands among the busts (the first bust 1): the first out of 58 runs finishes 58th.
create function private.tournament_finish_place(p_runs integer, p_bust_rank integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_runs is null or p_bust_rank is null or p_bust_rank < 1 or p_bust_rank > p_runs then
    raise exception 'A bust is one of the runs' using errcode = '22023';
  end if;
  return p_runs - p_bust_rank + 1;
end;
$$;

revoke execute on function private.tournament_pool_share(bigint, bigint), private.tournament_eligible_seats(jsonb, integer, integer),
  private.tournament_balancing_moves(integer[]), private.tournament_finish_place(integer, integer) from public, anon, authenticated;
