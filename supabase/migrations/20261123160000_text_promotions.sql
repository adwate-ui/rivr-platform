-- Text promotions (#1064, the owner, 17 Nov): a promotion that is words on a card alone, `{"kind": "text", "words"}`,
-- never a grant. It has no limits, is weighed for no event (so it never gives anything and never reaches Bonus
-- approvals), is submitted without a simulation, and goes live through the same approval as the rest, showing wherever
-- promotion cards show. Generated from the live definitions by gen1064.py.

-- The terms a version may hold, with a text promotion among the rewards.
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
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips"],
         "properties": {"kind": {"const": "seat_bonus"}, "chips": {"$ref": "#/$defs/chips"}, "firstNSeatsPerTable": {"$ref": "#/$defs/firstN"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tiers"],
         "properties": {"kind": {"const": "seat_bonus"}, "tiers": {"type": "array", "minItems": 1, "maxItems": 5,
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
         "properties": {"kind": {"const": "bonus_chips"}, "chips": {"$ref": "#/$defs/chips"}, "on": {"enum": ["visit", "referral", "signup"]}}},
        {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"const": "waitlist_priority"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "hands", "rules"],
         "properties": {"kind": {"const": "high_hand"},
                        "hands": {"type": "array", "minItems": 1, "maxItems": 5,
                                  "items": {"type": "object", "additionalProperties": false, "required": ["hand", "chips"],
                                            "properties": {"hand": {"enum": ["royal_flush", "straight_flush", "four_of_a_kind", "aces_full", "full_house"]},
                                                           "chips": {"$ref": "#/$defs/chips"}}}},
                        "rules": {"type": "object", "additionalProperties": false, "required": ["bothHoleCards", "shownAtShowdown", "minPlayersDealt"],
                                  "properties": {"bothHoleCards": {"type": "boolean"}, "shownAtShowdown": {"type": "boolean"},
                                                 "minPlayersDealt": {"type": "integer", "minimum": 2, "maximum": 10}}}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "words"],
         "properties": {"kind": {"const": "text"}, "words": {"type": "string", "minLength": 1, "maxLength": 200}}}
      ]
    }', p_reward)
    -- A play-time bonus's set steps each later than the one before (owner, 8 Nov).
    and (p_reward ->> 'mode' is distinct from 'steps' or private.is_rising_steps(p_reward -> 'steps'))
    -- A high hand lists each hand once, and is held by its budget alone, which it must have (redesign RD-22).
    and (p_reward ->> 'kind' is distinct from 'high_hand'
         or ((select count(distinct h ->> 'hand') = count(*) from jsonb_array_elements(p_reward -> 'hands') h)
             and p_limits ->> 'perMember' = 'none' and not p_limits ? 'maxMembersPerDay' and not p_limits ? 'maxGrants'
             and p_limits ? 'budgetChips'))
    -- A text promotion's card words, trimmed, and no limits: it gives nothing (#1064).
    and (p_reward ->> 'kind' is distinct from 'text'
         or (p_reward ->> 'words' = btrim(p_reward ->> 'words') and p_limits = '{"perMember": "none"}'::jsonb))
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
         or (p_limits ->> 'perMember' = 'once' and not p_limits ? 'timesPerMember' and coalesce(p_limits ->> 'budgetPeriod', '') <> 'month'));
$function$;

-- The event a reward is weighed for; a text promotion, none.
CREATE OR REPLACE FUNCTION private.promotion_event_kind(p_reward jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_reward ->> 'kind' = 'hours_bonus' then 'hours_step'
    when p_reward ->> 'kind' = 'seat_bonus' then 'seated'
    when p_reward ->> 'kind' = 'bonus_chips' then p_reward ->> 'on'
    when p_reward ->> 'kind' = 'high_hand' then 'high_hand'
    -- A text promotion is weighed for no event (#1064): no event is of kind 'none', so it gives nothing.
    when p_reward ->> 'kind' = 'text' then 'none'
    else 'visit' end;
$function$;

-- Submitting a draft for approval: simulated first, unless it is a text promotion.
CREATE OR REPLACE FUNCTION private.submit_promotion_version(p_version_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.manage');
begin
  if v_version.status <> 'draft' then
    raise exception 'Only a draft is submitted' using errcode = 'RVDEC';
  end if;
  -- A text promotion gives nothing to simulate (#1064).
  if v_version.reward ->> 'kind' is distinct from 'text' and v_version.simulated_terms is distinct from private.version_terms(v_version) then
    raise exception 'Simulate this version on last week before submitting it' using errcode = 'RVSIM';
  end if;
  perform private.assert_only_high_hand(v_version);
  update public.promotion_version
  set status = 'awaiting_approval', author_staff_id = private.current_staff_id(v_version.venue_id), submitted_at = now(),
      decided_by_staff_id = null, decided_at = null, rejected_reason = null
  where id = p_version_id;
  perform private.sync_promotion(v_version.promotion_id);
end;
$function$;
