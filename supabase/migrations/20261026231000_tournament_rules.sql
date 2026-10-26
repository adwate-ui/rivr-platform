-- The tournament rules both @rivr/domain and the database run (#115, #116; decisions 0200, 0202), each
-- proved equal to its twin on a golden file in supabase/tests/024_golden_twins.test.sql: what makes a
-- blind structure one the clock can run, and who may buy what at the clock's level.

-- A whole number in JSON, from p_least to p_most.
create function private.jsonb_is_whole(p_value jsonb, p_least bigint, p_most bigint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric % 1 = 0
                  and (p_value #>> '{}')::numeric between p_least and p_most, false);
$$;

-- @rivr/domain structureProblem: what is wrong with a structure, or null when the clock can run it. Each
-- stage is {"kind": "level", "small_blind", "big_blind", "ante", "minutes"} in chips and minutes, or
-- {"kind": "break", "minutes"}. Here also: 'shape' for anything else.
create function private.blind_levels_problem(p_levels jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  with stage as (
    select s.value as v, s.ordinality as n, s.value ->> 'kind' as kind, lead(s.value ->> 'kind') over (order by s.ordinality) as next_kind
    from jsonb_array_elements(case when jsonb_typeof(p_levels) = 'array' then p_levels else '[]' end) with ordinality s
  )
  select case
    when jsonb_typeof(p_levels) is distinct from 'array' or jsonb_array_length(p_levels) = 0 then 'empty'
    when jsonb_array_length(p_levels) > 60 then 'too_long'
    when (select kind from stage where n = 1) = 'break' then 'break_first'
    when exists (select 1 from stage where kind = 'break' and next_kind = 'break') then 'breaks_together'
    when exists (select 1 from stage where not private.jsonb_is_whole(v -> 'minutes', 1, 120)) then 'minutes'
    when exists (select 1 from stage where kind is null or kind not in ('level', 'break')
                 or (kind = 'break' and v - 'kind' - 'minutes' <> '{}')
                 or (kind = 'level' and v - array['kind', 'minutes', 'small_blind', 'big_blind', 'ante'] <> '{}')) then 'shape'
    when exists (select 1 from stage where kind = 'level'
                 and not (private.jsonb_is_whole(v -> 'big_blind', 1, 1000000000) and private.jsonb_is_whole(v -> 'small_blind', 1, 1000000000)
                          and (v ->> 'small_blind')::bigint <= (v ->> 'big_blind')::bigint
                          and private.jsonb_is_whole(v -> 'ante', 0, 1000000000))) then 'blinds'
  end;
$$;

-- @rivr/domain checkPurchase: why a player may not make a purchase at the clock's level, or null when they
-- may (decision 0202). The checks and their order are the domain's.
create function private.tournament_purchase_refusal(p_purchase text, p_format text, p_last_registration_level integer, p_max_buys integer,
                                                    p_has_add_on boolean, p_level integer, p_buys integer, p_is_alive boolean,
                                                    p_has_taken_add_on boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_is_open boolean := p_level <= p_last_registration_level;
begin
  -- Every caller knows each fact; a missing one is a bug, never a purchase allowed.
  if num_nulls(p_purchase, p_format, p_last_registration_level, p_has_add_on, p_level, p_buys, p_is_alive, p_has_taken_add_on) > 0 then
    raise exception 'A purchase is checked with every fact' using errcode = '22023';
  end if;
  if p_purchase = 'entry' then
    return case when p_buys > 0 then 'already_entered' when not v_is_open then 'registration_closed' end;
  end if;
  if p_purchase = 'add_on' then
    return case when not p_has_add_on then 'no_add_on' when p_buys = 0 then 'not_entered' when not p_is_alive then 'busted'
                when p_has_taken_add_on then 'add_on_taken' when p_level <> p_last_registration_level then 'add_on_closed' end;
  end if;
  return case when p_format is distinct from p_purchase then 'wrong_format' when p_buys = 0 then 'not_entered'
              when p_purchase = 're_entry' and p_is_alive then 'still_playing' when not v_is_open then 'registration_closed'
              when p_max_buys is not null and p_buys >= p_max_buys then 'limit_reached' end;
end;
$$;

revoke execute on function private.jsonb_is_whole(jsonb, bigint, bigint), private.blind_levels_problem(jsonb),
  private.tournament_purchase_refusal(text, text, integer, integer, boolean, integer, integer, boolean, boolean) from public, anon, authenticated;
