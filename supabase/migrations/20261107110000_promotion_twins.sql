-- The SQL twins of @rivr/domain promotions' typed model (decision 0037): when a version runs (isInSchedule,
-- secondsInSchedule), who qualifies (isEligible), what its reward gives (computeGrant), whether its limits let it through
-- (checkLimits) and which of an event's grants stack (stackGrants). supabase/tests/024_golden_twins.test.sql proves them on
-- packages/testing/golden/promotionSchedule.json and promotionRewards.json, the files the domain is proved on.

-- The club day (06:00 to 06:00 IST) a moment falls in.
create function private.club_day_of(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select ((p_at at time zone 'Asia/Kolkata') - interval '6 hours')::date;
$$;

-- How long each opening lasts: from `from` to the next `to`; the same time at both ends is a whole day.
create function private.opening_minutes(p_schedule jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif((split_part(p_schedule ->> 'to', ':', 1)::integer * 60 + split_part(p_schedule ->> 'to', ':', 2)::integer
                          - split_part(p_schedule ->> 'from', ':', 1)::integer * 60 - split_part(p_schedule ->> 'from', ':', 2)::integer + 1440) % 1440, 0),
                  1440);
$$;

-- The opening that begins on a club day: from `from` that club day (before 06:00 is the next morning) for its length.
-- Null when the schedule does not open that day: not a listed day, or before its start day or after its end day.
create function private.schedule_opening(p_schedule jsonb, p_day date)
returns tstzrange
language sql
stable
set search_path = ''
as $$
  select tstzrange(o.start, o.start + make_interval(mins => private.opening_minutes(p_schedule)), '[)')
  from (select ((p_day + (p_schedule ->> 'from')::time + case when p_schedule ->> 'from' < '06:00' then interval '1 day' else interval '0' end)
                at time zone 'Asia/Kolkata') as start) o
  where p_schedule -> 'days' @> to_jsonb(extract(isodow from p_day)::integer)
    and p_day >= (p_schedule ->> 'startsOn')::date
    and (not p_schedule ? 'endsOn' or p_day <= (p_schedule ->> 'endsOn')::date);
$$;

-- @rivr/domain isInSchedule: the moment is in the opening that began this club day, or last night's still running.
create function private.is_in_schedule(p_schedule jsonb, p_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from (values (private.club_day_of(p_at)), (private.club_day_of(p_at) - 1)) d (day)
                 where private.schedule_opening(p_schedule, d.day) @> p_at);
$$;

-- @rivr/domain secondsInSchedule: the whole seconds of a span inside the openings of the club days it could touch.
create function private.seconds_in_schedule(p_schedule jsonb, p_from timestamptz, p_to timestamptz)
returns bigint
language sql
stable
set search_path = ''
as $$
  select case when p_to <= p_from then 0 else coalesce(floor(sum(extract(epoch from upper(o.part) - lower(o.part)))), 0)::bigint end
  from (select private.schedule_opening(p_schedule, d::date) * tstzrange(p_from, greatest(p_to, p_from), '[)') as part
        from generate_series(private.club_day_of(p_from) - 1, private.club_day_of(p_to), interval '1 day') d) o
  where o.part is not null and not isempty(o.part);
$$;

-- Whether a value is among those allowed: 'all' or no list allows any; a list allows its own, and never none.
create function private.is_listed(p_allowed jsonb, p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_allowed is null or p_allowed = '"all"'::jsonb or coalesce(p_allowed ? p_value, false);
$$;

-- @rivr/domain isEligible: the member's tier and audience, and for an event at a moment (not a time-played reward) its
-- stake, table and moment. Terms are {reward, eligibility, schedule}; the member and context as the golden file has them.
create function private.promo_is_eligible(p_terms jsonb, p_member jsonb, p_context jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_listed(e -> 'tiers', p_member ->> 'tierId')
     and case e ->> 'audience'
           when 'new_30d' then (p_member ->> 'daysSinceJoined')::integer < 30
           when 'lapsed' then coalesce((p_member ->> 'daysSinceLastVisit')::integer >= 30, false)
           when 'women' then coalesce((p_member ->> 'isWoman')::boolean, false)
           else true end
     and (p_terms #>> '{reward,kind}' in ('points_multiplier', 'hours_bonus', 'free_spin')
          or (private.is_listed(e -> 'stakes', p_context ->> 'stake') and private.is_listed(e -> 'tableIds', p_context ->> 'tableId')
              and private.is_in_schedule(p_terms -> 'schedule', (p_context ->> 'at')::timestamptz)))
  from (select p_terms -> 'eligibility' as e) t;
$$;

-- @rivr/domain computeGrant: what a reward gives for one event, or why nothing. Chips in whole 50s, never paise.
create function private.promo_grant(p_reward jsonb, p_event jsonb)
returns table (o_points bigint, o_chips bigint, o_spins integer, o_perk text, o_refusal text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_kind text := p_reward ->> 'kind';
  v_event text := p_event ->> 'kind';
  v_own bigint := coalesce((p_event ->> 'ownChips')::bigint, 0);
  v_points bigint := 0;
  v_chips bigint := 0;
  v_spins integer := 0;
  v_perk text;
  v_refusal text;
begin
  if v_event = 'buy_in' and v_kind = 'buyin_bonus' then
    v_chips := case when v_own <= 0 then 0
                    when p_reward ->> 'mode' = 'fixed' then (p_reward ->> 'chips')::bigint
                    else least(v_own * (p_reward ->> 'percent')::bigint / 5000 * 50, coalesce((p_reward ->> 'capChips')::bigint, v_own)) end;
  elsif v_event = 'buy_in' and v_kind = 'bonus_chips' and p_reward ->> 'on' = 'first_buyin' then
    if not (p_event ->> 'isFirstOfVisit')::boolean then
      v_refusal := 'not_first_buy_in';
    elsif v_own > 0 then
      v_chips := (p_reward ->> 'chips')::bigint;
    end if;
  elsif v_event = 'time_played' and v_kind = 'points_multiplier' then
    v_points := (p_event ->> 'points')::bigint * (round((p_reward ->> 'multiplier')::numeric * 4)::bigint - 4) / 4;
  elsif v_event = 'time_played' and v_kind in ('hours_bonus', 'free_spin') then
    if (p_event ->> 'minutes')::integer < (p_reward ->> 'afterMinutes')::integer then
      v_refusal := 'too_short';
    elsif v_kind = 'hours_bonus' then
      v_chips := (p_reward ->> 'chips')::bigint;
    else
      v_spins := (p_reward ->> 'spins')::integer;
    end if;
  elsif v_event = 'visit' and v_kind = 'cab_home' then
    if (p_event ->> 'visitInMonth')::integer >= (p_reward ->> 'fromVisitInMonth')::integer then v_perk := 'cab_home'; else v_refusal := 'not_yet'; end if;
  elsif v_event = 'visit' and v_kind in ('tournament_entry', 'waitlist_priority') then
    v_perk := v_kind;
  elsif v_kind = 'bonus_chips' and v_event in ('visit', 'referral', 'signup') and p_reward ->> 'on' = v_event then
    v_chips := (p_reward ->> 'chips')::bigint;
  else
    v_refusal := 'other_event';
  end if;
  if v_refusal is null and v_perk is null and v_spins = 0 and v_points + v_chips = 0 then
    v_refusal := 'nothing_earned';
  end if;
  if v_refusal is not null then
    return query select 0::bigint, 0::bigint, 0, null::text, v_refusal;
  else
    return query select v_points, v_chips, v_spins, v_perk, null::text;
  end if;
end;
$$;

-- @rivr/domain checkLimits: the first limit a grant breaks, in order, or null when it is let through. The tally is what
-- the promotion's grants so far say, as private.promotion_tally counts them.
create function private.promo_check_limits(p_reward jsonb, p_limits jsonb, p_grant jsonb, p_tally jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when (p_tally ->> 'isPeriodTaken')::boolean then 'already_given'
    when p_reward ->> 'kind' = 'buyin_bonus' and p_reward ? 'firstNBuyinsPerTable'
         and coalesce((p_tally ->> 'grantsAtTableToday')::integer >= (p_reward ->> 'firstNBuyinsPerTable')::integer, true) then 'first_n_taken'
    when p_limits ? 'maxMembersPerDay' and not (p_tally ->> 'isMemberGrantedToday')::boolean
         and (p_tally ->> 'membersToday')::integer >= (p_limits ->> 'maxMembersPerDay')::integer then 'members_per_day'
    when p_limits ? 'maxGrants' and (p_tally ->> 'grantsGiven')::integer >= (p_limits ->> 'maxGrants')::integer then 'max_grants'
    when p_limits ? 'budgetChips'
         and (p_tally ->> 'chipsGiven')::bigint + coalesce((p_grant ->> 'chips')::bigint, 0) > (p_limits ->> 'budgetChips')::bigint then 'budget_exhausted'
  end;
$$;

-- @rivr/domain stackGrants: of one event's grants, in order, the promotions to give: the one multiplier giving the most
-- points (the first on a tie), every grant of chips or spins, and the first perk of each kind.
create function private.promo_stack(p_candidates jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with c as (
    select e.c, e.n, coalesce((e.c ->> 'points')::bigint, 0) as points, e.c ->> 'perk' as perk
    from jsonb_array_elements(p_candidates) with ordinality as e (c, n)
  ),
  best as (select c.n from c where c.points > 0 order by c.points desc, c.n limit 1)
  select coalesce(array_agg(c.c ->> 'promotion' order by c.n), '{}'::text[])
  from c
  where (c.points > 0 and c.n = (select b.n from best b))
     or (c.points = 0 and c.perk is null)
     or (c.points = 0 and c.n = (select min(x.n) from c x where x.points = 0 and x.perk = c.perk));
$$;

-- @rivr/domain periodKey: the period a member's grant counts in, kept unique per promotion and member. Days are written
-- with to_char, never a date's text, so a session's DateStyle cannot change a key and let a second grant past the unique
-- index (money audit, console v3; 305 proves it).
create function private.promo_period_key(p_limits jsonb, p_key text, p_at timestamptz, p_visit_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_limits ->> 'perMember'
    when 'per_visit' then 'visit:' || coalesce(p_visit_id::text, p_key)
    when 'per_day' then 'day:' || to_char(private.club_day_of(p_at), 'YYYY-MM-DD')
    when 'per_week' then 'week:' || to_char(private.club_day_of(p_at) - (extract(isodow from private.club_day_of(p_at))::integer - 1), 'YYYY-MM-DD')
    when 'once' then 'once'
    else 'event:' || p_key end;
$$;

revoke execute on function private.club_day_of(timestamptz), private.opening_minutes(jsonb), private.schedule_opening(jsonb, date),
  private.is_in_schedule(jsonb, timestamptz), private.seconds_in_schedule(jsonb, timestamptz, timestamptz), private.is_listed(jsonb, text),
  private.promo_is_eligible(jsonb, jsonb, jsonb), private.promo_grant(jsonb, jsonb), private.promo_check_limits(jsonb, jsonb, jsonb, jsonb),
  private.promo_stack(jsonb), private.promo_period_key(jsonb, text, timestamptz, uuid) from public, anon, authenticated;
