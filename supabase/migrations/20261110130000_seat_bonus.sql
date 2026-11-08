-- The buy-in bonus moves to the seat (audit of 8 Nov 2026, F-005; the owner, 8 Nov). Nothing records a buy-in since the
-- Cage was hidden (29 Oct, decision 0284), so a promotion paying on one never paid. A seat bonus is a fixed number of bonus
-- chips, never a percentage: on the first seat of the member's visit, or, with first N, on each of the first N seats taken
-- at a table in a club day. It pays once the seat is past its two minutes of Undo (decision 0480), by a sweep each minute,
-- as referrals do (decision 0509): a seat taken by mistake and undone or released pays nobody; decision 0543. @rivr/domain computeGrant and checkLimits
-- are the twins, proved equal on promotionRewards.json (024).

-- As 20261109180000_hours_bonus_steps.sql made it, with the seat bonus.
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
    }', p_channels);
$function$;

-- @rivr/domain triggerOf: a seat bonus is weighed when a seat is past its Undo.
CREATE OR REPLACE FUNCTION private.promotion_event_kind(p_reward jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_reward ->> 'kind' in ('points_multiplier', 'free_spin') then 'time_played'
    when p_reward ->> 'kind' = 'hours_bonus' then 'hours_step'
    when p_reward ->> 'kind' = 'seat_bonus' then 'seated'
    when p_reward ->> 'kind' = 'buyin_bonus' then 'buy_in'
    when p_reward ->> 'kind' = 'bonus_chips' then case p_reward ->> 'on' when 'first_buyin' then 'buy_in' else p_reward ->> 'on' end
    else 'visit' end;
$function$;

-- @rivr/domain computeGrant: the chips on a visit's first seat, or on any seat with first N (checkLimits counts them).
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
    if not p_reward ? 'firstNSeatsPerTable' and not (p_event ->> 'isFirstOfVisit')::boolean then
      v_refusal := 'not_first_seat';
    else
      v_chips := (p_reward ->> 'chips')::bigint;
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

-- @rivr/domain checkLimits: the first N seats at a table in a club day.
CREATE OR REPLACE FUNCTION private.promo_check_limits(p_reward jsonb, p_limits jsonb, p_grant jsonb, p_tally jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when (p_tally ->> 'periodGiven')::integer >= coalesce((p_limits ->> 'timesPerMember')::integer, 1) then 'already_given'
    when p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'firstNSeatsPerTable' and (p_tally ->> 'isMemberGrantedToday')::boolean then 'already_given'
    when p_reward ->> 'kind' = 'buyin_bonus' and p_reward ? 'firstNBuyinsPerTable'
         and coalesce((p_tally ->> 'grantsAtTableToday')::integer >= (p_reward ->> 'firstNBuyinsPerTable')::integer, true) then 'first_n_taken'
    when p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'firstNSeatsPerTable'
         and coalesce((p_tally ->> 'grantsAtTableToday')::integer >= (p_reward ->> 'firstNSeatsPerTable')::integer, true) then 'first_n_taken'
    when p_limits ? 'maxMembersPerDay' and not (p_tally ->> 'isMemberGrantedToday')::boolean
         and (p_tally ->> 'membersToday')::integer >= (p_limits ->> 'maxMembersPerDay')::integer then 'members_per_day'
    when p_limits ? 'maxGrants' and (p_tally ->> 'grantsGiven')::integer >= (p_limits ->> 'maxGrants')::integer then 'max_grants'
    when p_limits ? 'budgetChips'
         and (p_tally ->> 'chipsGiven')::bigint + coalesce((p_grant ->> 'chips')::bigint, 0) > (p_limits ->> 'budgetChips')::bigint then 'budget_exhausted'
  end;
$function$;

-- With a seat taken.
CREATE OR REPLACE FUNCTION private.promotion_event(p_kind text, p_version public.promotion_version, p_context jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member uuid := (p_context ->> 'member_id')::uuid;
  v_table uuid := (p_context ->> 'table_id')::uuid;
  v_visit uuid := coalesce((p_context ->> 'visit_id')::uuid, private.current_visit(v_member));
  v_base jsonb;
  v_time record;
begin
  v_base := jsonb_build_object('kind', p_kind, 'key', p_context ->> 'key', 'at', now(), 'memberId', v_member, 'visitId', v_visit,
    'tableId', v_table,
    'stake', (select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = v_table));
  if p_kind = 'buy_in' then
    return v_base || jsonb_build_object(
      'ownChips', case when p_context ->> 'method' = 'bonus' then 0 else coalesce((p_context ->> 'amount_paise')::bigint, 0) / 100 end,
      'isFirstOfVisit', (select count(*) <= 1 from public.cage_transaction c
                         where c.member_id = v_member and c.kind = 'buy_in'
                           and c.created_at >= coalesce((select v.opened_at from public.visit v where v.id = v_visit), private.tonight_began(now()))));
  elsif p_kind = 'seated' then
    -- At the moment they sat; the first of the visit unless an earlier seat of it remains (one undone is gone).
    return v_base || jsonb_build_object('at', least((p_context ->> 'at')::timestamptz, now()),
      'isFirstOfVisit', not exists (select 1 from public.seat_session s where s.visit_id = v_visit and s.member_id = v_member
                                      and s.started_at < (p_context ->> 'at')::timestamptz));
  elsif p_kind = 'time_played' then
    select * into v_time from private.visit_schedule_time(v_visit, p_version.schedule, p_version.eligibility);
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60, 'points', v_time.o_points);
  elsif p_kind = 'hours_step' then
    select * into v_time from private.visit_schedule_time_at(v_visit, p_version.schedule, p_version.eligibility,
                                                             least(coalesce((p_context ->> 'at')::timestamptz, now()), now()));
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60, 'stepMinutes', (p_context ->> 'step_minutes')::integer);
  elsif p_kind = 'visit' then
    return v_base || jsonb_build_object('tableId', null, 'stake', null,
      'visitInMonth', (select count(*) from public.visit v where v.member_id = v_member and v.opened_at <= now()
                         and v.opened_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'));
  end if;
  return v_base || jsonb_build_object('visitId', null, 'tableId', null, 'stake', null);
end;
$function$;

-- With a seat taken among the triggers.
CREATE OR REPLACE FUNCTION private.evaluate_promotions(p_venue_id uuid, p_trigger text, p_context jsonb)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_table_id uuid := (p_context ->> 'table_id')::uuid;
  v_facts jsonb;
  v_promotion public.promotion;
  v_candidate jsonb;
  v_candidates jsonb := '[]'::jsonb;
begin
  if p_trigger is null or p_trigger <> all (array['buy_in', 'hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in',
                                                  'graduation', 'date_window', 'signup', 'hours_step', 'seated'])
     or length(coalesce(p_context ->> 'key', '')) not between 1 and 200 or coalesce((p_context ->> 'amount_paise')::bigint, 0) < 0
     or coalesce((p_context ->> 'points')::bigint, 0) < 0 or coalesce((p_context ->> 'hours_played')::numeric, 0) < 0
     or (p_trigger = 'hours_step') <> (p_context ? 'step_minutes')
     or (p_trigger = 'seated' and not p_context ? 'at')
     or (p_context ? 'amount_paise') <> (p_context ? 'method') or coalesce(p_context ->> 'method', 'cash') not in ('cash', 'upi', 'wallet', 'bonus')
     or coalesce(p_context ->> 'hand', 'bad_beat') not in ('four_of_a_kind', 'straight_flush', 'royal_flush', 'bad_beat')
     or (v_table_id is not null and not exists (select 1 from public.game_table g where g.id = v_table_id and g.venue_id = p_venue_id)) then
    raise exception 'A trigger, the event''s key, a table of this venue, a known method and hand, and nothing below nothing' using errcode = '22023';
  end if;
  if not exists (select 1 from public.member m where m.id = v_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  begin
    perform private.assert_writable(p_venue_id, 'promotions', v_member_id);
  exception when sqlstate 'RVFRZ' or sqlstate 'RVKIL' or sqlstate 'RVMBR' then
    return;
  end;
  v_facts := private.promotion_facts(v_member_id, v_table_id, now())
             || jsonb_strip_nulls(jsonb_build_object('hours_played', p_context -> 'hours_played', 'hand', p_context -> 'hand'));
  for v_promotion in
    select p.* from public.promotion p
    where p.venue_id = p_venue_id and p.status = 'live' and p.starts_at <= now() and (p.ends_at is null or p.ends_at > now())
      and exists (select 1 from public.promotion_rule r where r.promotion_id = p.id and r.trigger = p_trigger)
      and not exists (select 1 from public.promotion_version x where x.promotion_id = p.id)
    order by p.priority desc, p.created_at, p.id
    for update
  loop
    v_candidate := private.promotion_candidate(v_promotion, p_trigger, v_facts, p_context);
    if v_candidate is not null then
      v_candidates := v_candidates || jsonb_build_array(v_candidate);
    end if;
  end loop;
  for v_candidate in
    select e.c from jsonb_array_elements(v_candidates) with ordinality as e (c, n)
    where e.c ->> 'promotion' = any (private.promotions_to_give(v_candidates)) order by e.n
  loop
    return next private.give_promotion(v_candidate, v_facts, p_context);
  end loop;
  return query select * from private.evaluate_promotion_versions(p_venue_id, p_trigger, p_context);
end;
$function$;

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
    continue when private.promo_check_limits(v_version.reward, v_version.limits, jsonb_build_object('chips', v_grant.o_chips), v_tally) is not null;
    v_period := private.promo_slot_key(v_base, (v_tally ->> 'periodGiven')::integer);
    -- A step's grant has its visit and place for its source, so the database refuses it a second time in the visit.
    if p_trigger = 'hours_step' then
      v_event := v_event || jsonb_build_object('key', 'hours_step:' || (p_context ->> 'visit_id') || ':@' || v_step);
    end if;
    v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
      'promotion', v_version.promotion_id::text, 'version_id', v_version.id, 'trigger', p_trigger, 'points', v_grant.o_points,
      'chips', v_grant.o_chips, 'spins', v_grant.o_spins, 'perk', v_grant.o_perk, 'period_key', v_period, 'event', v_event));
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

-- With the seats taken, for the approver's look at last week.
CREATE OR REPLACE FUNCTION private.replay_version_events(p_version public.promotion_version, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with buy_ins as (
    select c.id, c.created_at as at, c.member_id, vis.id as visit_id, t.o_table_id as table_id, tt.code as stake,
           case when c.method = 'bonus' then 0 else c.amount_paise / 100 end as own_chips,
           row_number() over (partition by c.member_id, coalesce(vis.id::text, private.club_day_of(c.created_at)::text) order by c.created_at, c.id) as nth
    from public.cage_transaction c
    left join lateral (select v.id from public.visit v where v.member_id = c.member_id and v.opened_at <= c.created_at
                       order by v.opened_at desc limit 1) vis on true
    left join lateral (select st.o_table_id from private.session_tables(c.session_id) st where st.o_from <= c.created_at
                       order by st.o_from desc limit 1) t on true
    left join public.game_table g on g.id = t.o_table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'buy_in'
      and c.venue_id = p_version.venue_id and c.kind = 'buy_in' and c.created_at >= p_from and c.created_at < p_to
  ),
  seats as (
    select s.id, s.started_at as at, s.member_id, s.visit_id, s.table_id, tt.code as stake,
           row_number() over (partition by s.visit_id order by s.started_at, s.id) as nth
    from public.seat_session s
    left join public.game_table g on g.id = s.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'seated'
      and s.venue_id = p_version.venue_id and s.started_at >= p_from and s.started_at < p_to
  ),
  played as (
    select v.id, v.closed_at as at, v.member_id, w.o_seconds, w.o_points, lt.table_id, tt.code as stake
    from public.visit v
    cross join lateral private.visit_schedule_time(v.id, p_version.schedule, p_version.eligibility) w
    left join lateral (select e.table_id from public.points_earning e where e.visit_id = v.id and e.basis = 'hours'
                       group by e.table_id order by sum(e.played_seconds) desc, e.table_id limit 1) lt on true
    left join public.game_table g on g.id = lt.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) in ('time_played', 'hours_step')
      and v.venue_id = p_version.venue_id and v.closed_at >= p_from and v.closed_at < p_to and w.o_seconds > 0
  ),
  visits as (
    select v.id, v.opened_at as at, v.member_id,
           (select count(*) from public.visit x where x.member_id = v.member_id and x.opened_at <= v.opened_at
              and x.opened_at >= date_trunc('month', v.opened_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as in_month
    from public.visit v
    where private.promotion_event_kind(p_version.reward) = 'visit'
      and v.venue_id = p_version.venue_id and v.opened_at >= p_from and v.opened_at < p_to
  ),
  others as (
    select r.id, r.completed_at as at, side.member_id
    from public.referral r cross join lateral (values (r.member_id), (r.referrer_member_id)) side (member_id)
    where private.promotion_event_kind(p_version.reward) = 'referral'
      and r.venue_id = p_version.venue_id and r.completed_at >= p_from and r.completed_at < p_to
    union all
    select k.id, k.verified_at, k.member_id from public.kyc_record k
    where private.promotion_event_kind(p_version.reward) = 'signup'
      and k.venue_id = p_version.venue_id and k.status = 'verified' and k.verified_at >= p_from and k.verified_at < p_to
  ),
  entries as (
    select b.at, b.id::text as id, b.member_id, 'buy_in' as kind,
           jsonb_build_object('tableId', b.table_id, 'stake', b.stake, 'ownChips', b.own_chips, 'isFirstOfVisit', b.nth = 1,
                              'visitId', 'v' || dense_rank() over (order by b.visit_id)) as more
    from buy_ins b
    union all
    select s.at, s.id::text, s.member_id, 'seated',
           jsonb_build_object('tableId', s.table_id, 'stake', s.stake, 'isFirstOfVisit', s.nth = 1, 'visitId', 'v' || dense_rank() over (order by s.visit_id))
    from seats s
    union all
    select p.at, p.id::text, p.member_id, 'time_played',
           jsonb_build_object('tableId', p.table_id, 'stake', p.stake, 'minutes', p.o_seconds / 60, 'points', p.o_points,
                              'visitId', 'v' || dense_rank() over (order by p.id))
    from played p
    union all
    select v.at, v.id::text, v.member_id, 'visit', jsonb_build_object('visitInMonth', v.in_month, 'visitId', 'v' || dense_rank() over (order by v.id))
    from visits v
    union all
    select o.at, o.id::text || o.member_id::text, o.member_id, private.promotion_event_kind(p_version.reward), '{}'::jsonb
    from others o
  )
  select coalesce(jsonb_agg(private.replay_entry(e.kind, e.n, e.at, e.member_id, e.member_n, e.more) order by e.at, e.n), '[]'::jsonb)
  from (select x.*, row_number() over (order by x.at, x.id) as n, dense_rank() over (order by x.member_id) as member_n from entries x) e;
$function$;

-- Which seats have been weighed, each once: a seat waits through a freeze, and is never weighed twice.
create table private.seat_bonus_weighed (
  seat_session_id uuid primary key references public.seat_session (id) on delete cascade,
  weighed_at timestamptz not null default now()
);

-- Each minute, every seat of the last day past its Undo and not yet weighed, at a venue with a live seat bonus, earliest
-- first, so the first N at a table are the first seated, at the table they first sat at. Not a seat left inside its two
-- minutes (taken by mistake and released), nor one a staff member gave their own member record. A seat waits, unweighed,
-- while the venue or the member is frozen or promotions are stopped. One that cannot be weighed never stops the others; it
-- is logged and tried again.
create function private.sweep_seat_bonus(p_from timestamptz default now() - interval '1 day')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat record;
begin
  for v_seat in
    select s.id, s.venue_id, s.member_id, f.o_table_id as table_id, s.visit_id, s.started_at
    from public.seat_session s
    cross join lateral (select t.o_table_id from private.session_tables(s.id) t order by t.o_from limit 1) f
    where s.started_at > p_from and not private.is_undoable(s.started_at)
      and (s.ended_at is null or s.ended_at >= s.started_at + interval '2 minutes')
      and exists (select 1 from public.promotion_version v where v.venue_id = s.venue_id and v.status = 'live' and v.reward ->> 'kind' = 'seat_bonus')
      and not exists (select 1 from private.seat_bonus_weighed w where w.seat_session_id = s.id)
      and not exists (select 1 from public.staff st join public.member m on m.id = s.member_id
                      where st.id = s.seated_by_staff_id and (st.user_id = m.user_id or st.phone = m.phone))
    order by s.started_at, s.id
  loop
    begin
      perform private.assert_writable(v_seat.venue_id, 'promotions', v_seat.member_id);
    exception when others then
      continue;
    end;
    begin
      perform private.evaluate_promotions(v_seat.venue_id, 'seated', jsonb_build_object(
        'member_id', v_seat.member_id, 'table_id', v_seat.table_id, 'visit_id', v_seat.visit_id,
        'key', 'seated:' || v_seat.id, 'at', v_seat.started_at));
      insert into private.seat_bonus_weighed (seat_session_id) values (v_seat.id) on conflict do nothing;
    exception when others then
      raise warning 'seat bonus: seat % not weighed: %', v_seat.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function private.sweep_seat_bonus(timestamptz) from public, anon, authenticated;

select cron.schedule('seat-bonus', '* * * * *', 'select private.sweep_seat_bonus()');

-- What already pays on a buy-in, or offers what the club does not run (decision 0543). Read on 8 Nov: production has drafts
-- only; staging one live percentage promotion, in each venue. Anything running stops, since it can pay nobody and new terms
-- need a second person. A draft or one awaiting approval becomes a seat bonus draft, for staff to read again and submit: its
-- fixed chips, or a percentage's cap, or 1,000. Drafts for a cab home, a tournament entry or an Academy graduate end. Each
-- promotion is synced, so a card stops showing what stopped running. The deploy's log says how many.
do $$
declare
  v_row record;
  v_paused integer := 0;
  v_moved integer := 0;
  v_ended integer := 0;
begin
  for v_row in
    update public.promotion_version v set status = 'ended'
    from public.promotion p
    where p.id = v.promotion_id and v.status in ('draft', 'awaiting_approval')
      and (v.reward ->> 'kind' in ('cab_home', 'tournament_entry') or p.template_key = 'graduate_first_buy_in')
    returning v.promotion_id
  loop
    perform private.sync_promotion(v_row.promotion_id);
    v_ended := v_ended + 1;
  end loop;
  for v_row in
    update public.promotion_version set status = 'paused'
    where status in ('live', 'scheduled') and (reward ->> 'kind' = 'buyin_bonus' or reward ->> 'on' = 'first_buyin')
    returning promotion_id
  loop
    perform private.sync_promotion(v_row.promotion_id);
    v_paused := v_paused + 1;
  end loop;
  for v_row in
    update public.promotion_version
    set status = 'draft',
        name = replace(name, 'Buy-in bonus', 'Seat bonus chips'),
        reward = jsonb_strip_nulls(jsonb_build_object(
          'kind', 'seat_bonus', 'chips', coalesce((reward ->> 'chips')::bigint, (reward ->> 'capChips')::bigint, 1000),
          'firstNSeatsPerTable', (reward ->> 'firstNBuyinsPerTable')::integer)),
        detail = null, simulation = null, simulated_terms = null, simulated_at = null
    where status in ('draft', 'awaiting_approval') and (reward ->> 'kind' = 'buyin_bonus' or reward ->> 'on' = 'first_buyin')
    returning promotion_id
  loop
    perform private.sync_promotion(v_row.promotion_id);
    v_moved := v_moved + 1;
  end loop;
  raise notice 'seat bonus: % paused, % drafts moved to the seat, % drafts ended', v_paused, v_moved, v_ended;
end;
$$;

-- The practice venue's reset keeps them (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
