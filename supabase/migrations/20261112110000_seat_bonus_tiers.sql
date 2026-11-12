-- A seat bonus in tiers (the owner, 12 Nov; decision 0580; #909): the first X members to claim it get A chips, the next Y get
-- B, and more tiers can be added, counted over the promotion's life, each member once, on their first seat of a visit;
-- nothing once the last tier is claimed. @rivr/domain tierChips and checkLimits are the twins of private.promo_tier_chips
-- and promo_check_limits, proved equal on promotionRewards.json (024). The fixed and first-N seat bonuses are as they were.

-- @rivr/domain tierChips: a seat bonus in tiers' chips for the claim after `p_claimed` claims; null once every tier is
-- claimed, and for any other reward.
create function private.promo_tier_chips(p_reward jsonb, p_claimed integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (t.tier ->> 'chips')::bigint
  from (select e.tier, sum((e.tier ->> 'count')::integer) over (order by e.n) as up_to
        from jsonb_array_elements(case when p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'tiers' then p_reward -> 'tiers' end)
          with ordinality as e (tier, n)) t
  where p_claimed < t.up_to
  order by t.up_to
  limit 1;
$$;
revoke execute on function private.promo_tier_chips(jsonb, integer) from public, anon, authenticated;

-- As 20261110130000_seat_bonus.sql made it, with a seat bonus in tiers, held to once a member and no monthly reset.
CREATE OR REPLACE FUNCTION private.is_promotion_terms(p_reward jsonb, p_eligibility jsonb, p_schedule jsonb, p_limits jsonb, p_channels jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select extensions.jsonb_matches_schema('{
      "$defs": {
        "chips": {"type": "integer", "minimum": 50, "maximum": 10000000, "multipleOf": 50},
        "minutes": {"type": "integer", "minimum": 30, "maximum": 1440, "multipleOf": 30},
        "firstN": {"type": "integer", "minimum": 1, "maximum": 100}
      },
      "oneOf": [
        {"type": "object", "additionalProperties": false, "required": ["kind", "multiplier"],
         "properties": {"kind": {"const": "points_multiplier"}, "multiplier": {"type": "number", "minimum": 1.25, "maximum": 5}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "percent"],
         "properties": {"kind": {"const": "buyin_bonus"}, "mode": {"const": "percent"}, "percent": {"type": "integer", "minimum": 1, "maximum": 100},
                        "capChips": {"$ref": "#/$defs/chips"}, "firstNBuyinsPerTable": {"$ref": "#/$defs/firstN"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "chips"],
         "properties": {"kind": {"const": "buyin_bonus"}, "mode": {"const": "fixed"}, "chips": {"$ref": "#/$defs/chips"},
                        "firstNBuyinsPerTable": {"$ref": "#/$defs/firstN"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips"],
         "properties": {"kind": {"const": "seat_bonus"}, "chips": {"$ref": "#/$defs/chips"}, "firstNSeatsPerTable": {"$ref": "#/$defs/firstN"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tiers"],
         "properties": {"kind": {"const": "seat_bonus"}, "tiers": {"type": "array", "minItems": 1, "maxItems": 10,
           "items": {"type": "object", "additionalProperties": false, "required": ["count", "chips"],
                     "properties": {"count": {"type": "integer", "minimum": 1, "maximum": 10000}, "chips": {"$ref": "#/$defs/chips"}}}}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips", "afterMinutes"],
         "properties": {"kind": {"const": "hours_bonus"}, "chips": {"$ref": "#/$defs/chips"}, "afterMinutes": {"$ref": "#/$defs/minutes"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "steps"],
         "properties": {"kind": {"const": "hours_bonus"}, "mode": {"const": "steps"},
                        "steps": {"type": "array", "minItems": 2, "maxItems": 6,
                                  "items": {"type": "object", "additionalProperties": false, "required": ["afterMinutes", "chips"],
                                            "properties": {"afterMinutes": {"$ref": "#/$defs/minutes"}, "chips": {"$ref": "#/$defs/chips"}}}}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "everyMinutes", "chips"],
         "properties": {"kind": {"const": "hours_bonus"}, "mode": {"const": "every"},
                        "everyMinutes": {"type": "integer", "minimum": 30, "maximum": 720, "multipleOf": 30}, "chips": {"$ref": "#/$defs/chips"},
                        "timesPerVisit": {"type": "integer", "minimum": 1, "maximum": 20}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips", "on"],
         "properties": {"kind": {"const": "bonus_chips"}, "chips": {"$ref": "#/$defs/chips"}, "on": {"enum": ["visit", "first_buyin", "referral", "signup"]}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "spins", "afterMinutes"],
         "properties": {"kind": {"const": "free_spin"}, "spins": {"type": "integer", "minimum": 1, "maximum": 10}, "afterMinutes": {"$ref": "#/$defs/minutes"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "fromVisitInMonth"],
         "properties": {"kind": {"const": "cab_home"}, "fromVisitInMonth": {"type": "integer", "minimum": 1, "maximum": 31}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tournamentId"],
         "properties": {"kind": {"const": "tournament_entry"}, "tournamentId": {"type": "string", "minLength": 1, "maxLength": 80, "pattern": "\\S"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"const": "waitlist_priority"}}}
      ]
    }', p_reward)
    -- 1.25 to 5 in quarters.
    and (p_reward ->> 'kind' <> 'points_multiplier' or ((p_reward ->> 'multiplier')::numeric * 4) % 1 = 0)
    -- A play-time bonus's set steps each later than the one before (owner, 8 Nov).
    and (p_reward ->> 'mode' is distinct from 'steps' or private.is_rising_steps(p_reward -> 'steps'))
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["stakes", "tiers", "audience"],
      "properties": {
        "stakes": {"oneOf": [{"const": "all"}, {"type": "array", "minItems": 1, "items": {"type": "string", "pattern": "^[a-z0-9_]{2,40}$"}}]},
        "tableIds": {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}},
        "tiers": {"oneOf": [{"const": "all"}, {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}}]},
        "audience": {"enum": ["everyone", "new_30d", "lapsed"]}
      }
    }', p_eligibility)
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["days", "from", "to", "startsOn", "timezone"],
      "properties": {
        "days": {"type": "array", "minItems": 1, "maxItems": 7, "uniqueItems": true, "items": {"type": "integer", "minimum": 1, "maximum": 7}},
        "from": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "to": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "startsOn": {"type": "string"},
        "endsOn": {"type": "string"},
        "timezone": {"const": "Asia/Kolkata"}
      }
    }', p_schedule)
    and private.is_iso_day(p_schedule ->> 'startsOn')
    and (not p_schedule ? 'endsOn' or (private.is_iso_day(p_schedule ->> 'endsOn') and p_schedule ->> 'endsOn' >= p_schedule ->> 'startsOn'))
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["perMember"],
      "properties": {
        "perMember": {"enum": ["none", "per_visit", "per_day", "per_week", "once"]},
        "timesPerMember": {"type": "integer", "minimum": 2, "maximum": 20},
        "maxMembersPerDay": {"type": "integer", "minimum": 1, "maximum": 10000},
        "budgetChips": {"type": "integer", "minimum": 50, "maximum": 10000000, "multipleOf": 50},
        "maxGrants": {"type": "integer", "minimum": 1, "maximum": 1000000},
        "budgetPeriod": {"enum": ["month"]}
      }
    }', p_limits)
    -- Up to N times a member needs a period; a monthly budget needs a budget or most grants (decision 0499).
    and (not p_limits ? 'timesPerMember' or p_limits ->> 'perMember' <> 'none')
    and (not p_limits ? 'budgetPeriod' or p_limits ? 'budgetChips' or p_limits ? 'maxGrants')
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["playerApp", "tv", "website", "whatsapp"],
      "properties": {"playerApp": {"type": "boolean"}, "tv": {"type": "boolean"}, "website": {"type": "boolean"}, "whatsapp": {"type": "boolean"}}
    }', p_channels)
    -- A seat bonus in tiers counts its claims over the promotion's life, each member once (decision 0580): no monthly reset.
    and (not (p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'tiers')
         or (p_limits ->> 'perMember' = 'once' and coalesce(p_limits ->> 'budgetPeriod', '') <> 'month'));
$function$;

-- As before, with a seat bonus in tiers on the first seat of a visit.
CREATE OR REPLACE FUNCTION private.promo_grant(p_reward jsonb, p_event jsonb)
 RETURNS TABLE(o_points bigint, o_chips bigint, o_spins integer, o_perk text, o_refusal text)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_kind text := p_reward ->> 'kind';
  v_event text := p_event ->> 'kind';
  v_own bigint := coalesce((p_event ->> 'ownChips')::bigint, 0);
  v_points bigint := 0;
  v_chips bigint := 0;
  v_spins integer := 0;
  v_perk text;
  v_refusal text;
  v_step bigint;
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
  elsif v_event = 'seated' and v_kind = 'seat_bonus' then
    -- In tiers (decision 0580): on the first seat of a visit, at the first tier's chips until the limits set the tier.
    if (p_reward ? 'tiers' or not p_reward ? 'firstNSeatsPerTable') and not (p_event ->> 'isFirstOfVisit')::boolean then
      v_refusal := 'not_first_seat';
    else
      v_chips := coalesce((p_reward ->> 'chips')::bigint, (p_reward -> 'tiers' -> 0 ->> 'chips')::bigint);
    end if;
  elsif v_event = 'time_played' and v_kind = 'points_multiplier' then
    v_points := (p_event ->> 'points')::bigint * (round((p_reward ->> 'multiplier')::numeric * 4)::bigint - 4) / 4;
  elsif v_event = 'time_played' and v_kind = 'free_spin' then
    if (p_event ->> 'minutes')::integer < (p_reward ->> 'afterMinutes')::integer then
      v_refusal := 'too_short';
    else
      v_spins := (p_reward ->> 'spins')::integer;
    end if;
  elsif v_event = 'hours_step' and v_kind = 'hours_bonus' then
    select s.o_chips into v_step from private.promo_hours_steps(p_reward) s where s.o_after_minutes = (p_event ->> 'stepMinutes')::integer;
    if v_step is null then
      v_refusal := 'not_a_step';
    elsif (p_event ->> 'minutes')::integer < (p_event ->> 'stepMinutes')::integer then
      v_refusal := 'too_short';
    else
      v_chips := v_step;
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
$function$;

-- As before, stopping a seat bonus in tiers once its last tier is claimed, and counting a tier's chips against the budget.
CREATE OR REPLACE FUNCTION private.promo_check_limits(p_reward jsonb, p_limits jsonb, p_grant jsonb, p_tally jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when (p_tally ->> 'periodGiven')::integer >= coalesce((p_limits ->> 'timesPerMember')::integer, 1) then 'already_given'
    when p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'firstNSeatsPerTable' and (p_tally ->> 'isMemberGrantedToday')::boolean then 'already_given'
    when p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'tiers' and private.promo_tier_chips(p_reward, (p_tally ->> 'grantsGiven')::integer) is null
      then 'tiers_used_up'
    when p_reward ->> 'kind' = 'buyin_bonus' and p_reward ? 'firstNBuyinsPerTable'
         and coalesce((p_tally ->> 'grantsAtTableToday')::integer >= (p_reward ->> 'firstNBuyinsPerTable')::integer, true) then 'first_n_taken'
    when p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'firstNSeatsPerTable'
         and coalesce((p_tally ->> 'grantsAtTableToday')::integer >= (p_reward ->> 'firstNSeatsPerTable')::integer, true) then 'first_n_taken'
    when p_limits ? 'maxMembersPerDay' and not (p_tally ->> 'isMemberGrantedToday')::boolean
         and (p_tally ->> 'membersToday')::integer >= (p_limits ->> 'maxMembersPerDay')::integer then 'members_per_day'
    when p_limits ? 'maxGrants' and (p_tally ->> 'grantsGiven')::integer >= (p_limits ->> 'maxGrants')::integer then 'max_grants'
    when p_limits ? 'budgetChips'
         and (p_tally ->> 'chipsGiven')::bigint
             + coalesce(private.promo_tier_chips(p_reward, (p_tally ->> 'grantsGiven')::integer), (p_grant ->> 'chips')::bigint, 0) > (p_limits ->> 'budgetChips')::bigint then 'budget_exhausted'
  end;
$function$;

-- As before, paying a seat bonus in tiers its tier's chips.
CREATE OR REPLACE FUNCTION private.evaluate_promotion_versions(p_venue_id uuid, p_trigger text, p_context jsonb)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_kind text := case p_trigger when 'buy_in' then 'buy_in' when 'hours_played' then 'time_played' when 'check_in' then 'visit'
                                when 'referral' then 'referral' when 'signup' then 'signup' when 'hours_step' then 'hours_step' when 'seated' then 'seated' end;
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_member jsonb;
  v_version public.promotion_version;
  v_event jsonb;
  v_grant record;
  v_base text;
  v_tally jsonb;
  v_period text;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate jsonb;
  v_id uuid;
  v_step integer;
  v_chips bigint;
begin
  -- An event is weighed once; a play-time bonus step once for each promotion, so one paying a step never stops another
  -- with the same step (money audit, 8 Nov).
  if v_kind is null or (p_trigger <> 'hours_step' and exists (
       select 1 from public.promotion_grant g where g.venue_id = p_venue_id and g.member_id = v_member_id
         and g.source_key = p_context ->> 'key' and g.promotion_version_id is not null)) then
    return;
  end if;
  v_member := private.promotion_member_facts(v_member_id);
  for v_version in
    select v.* from public.promotion_version v join public.promotion p on p.id = v.promotion_id
    where v.venue_id = p_venue_id and v.status = 'live' and private.promotion_event_kind(v.reward) = v_kind
    order by p.created_at, p.id
    for update of v
  loop
    -- A play-time step is paid once a visit by its place, whatever its minutes in the version that paid it.
    v_step := private.promo_step_key(v_version.reward, (p_context ->> 'step_minutes')::integer);
    continue when p_trigger = 'hours_step'
      and private.promo_step_settled(v_version.promotion_id, v_member_id, (p_context ->> 'visit_id')::uuid, v_step);
    v_event := private.promotion_event(v_kind, v_version, p_context);
    -- A seat is paid only by terms approved before it was taken: a promotion approved later does not reach back over it.
    continue when p_trigger = 'seated' and v_version.decided_at > (v_event ->> 'at')::timestamptz;
    continue when not private.promo_is_eligible(
      jsonb_build_object('reward', v_version.reward, 'eligibility', v_version.eligibility, 'schedule', v_version.schedule), v_member, v_event);
    select * into v_grant from private.promo_grant(v_version.reward, v_event);
    continue when v_grant.o_refusal is not null;
    -- The member's grants in the period count against up to N times; the next is keyed as theirs in it (decision 0499).
    -- The event's own moment, so a seat swept after 06:00 counts in the club day it was taken.
    v_base := private.promo_period_key(v_version.limits, p_context ->> 'key', (v_event ->> 'at')::timestamptz, (v_event ->> 'visitId')::uuid, v_step);
    v_tally := private.promotion_tally(v_version.promotion_id, v_member_id, v_base, (v_event ->> 'tableId')::uuid, private.club_day_of((v_event ->> 'at')::timestamptz),
                                       v_version.limits);
    -- A seat bonus in tiers pays its tier's chips (decision 0580).
    v_chips := coalesce(private.promo_tier_chips(v_version.reward, (v_tally ->> 'grantsGiven')::integer), v_grant.o_chips);
    continue when private.promo_check_limits(v_version.reward, v_version.limits, jsonb_build_object('chips', v_chips), v_tally) is not null;
    v_period := private.promo_slot_key(v_base, (v_tally ->> 'periodGiven')::integer);
    -- A step's grant has its visit and place for its source, so the database refuses it a second time in the visit.
    if p_trigger = 'hours_step' then
      v_event := v_event || jsonb_build_object('key', 'hours_step:' || (p_context ->> 'visit_id') || ':@' || v_step);
    end if;
    v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
      'promotion', v_version.promotion_id::text, 'version_id', v_version.id, 'trigger', p_trigger, 'points', v_grant.o_points,
      'chips', v_chips, 'spins', v_grant.o_spins, 'perk', v_grant.o_perk, 'period_key', v_period, 'event', v_event));
  end loop;
  for v_candidate in
    select e.c from jsonb_array_elements(v_candidates) with ordinality as e (c, n)
    where e.c ->> 'promotion' = any (private.promo_stack(v_candidates)) order by e.n
  loop
    v_id := private.give_promotion_version(v_candidate);
    if v_id is not null then
      return next v_id;
    end if;
  end loop;
end;
$function$;
