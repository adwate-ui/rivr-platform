-- A host's open offer, where the floor can honour it (8 Nov audit, I-66, F-015). The owner's rule stands: "record only, honoured
-- by hand; no money or points move without a person" (#598, decision 0276), so nothing is granted here. The offer is shown while
-- it is out, and on the night the member comes back, for the member's record and the Door.
create function private.open_host_offers(p_venue_id uuid)
returns table (member_id uuid, offer jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select h.member_id, h.offer
  from public.host_queue_item h
  where h.venue_id = p_venue_id and h.offer is not null
    and (h.status = 'offered' or (h.status = 'won_back' and h.won_back_at >= private.tonight_began(now())))
    and private.host_may_call(h.member_id)
    and (private.has_permission(p_venue_id, 'members.read') or private.has_permission(p_venue_id, 'waitlist.manage'));
$$;

create function public.open_host_offers(p_venue_id uuid)
returns table (member_id uuid, offer jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.open_host_offers(p_venue_id); $$;

revoke execute on function private.open_host_offers(uuid), public.open_host_offers(uuid) from public, anon;
grant execute on function private.open_host_offers(uuid), public.open_host_offers(uuid) to authenticated;

-- As 20261029090100_promotion_rules_and_questions.sql made it, with a bonus by amount needing no expiry (F-068): a host's offer
-- carries none, as bonus chips never expire (owner, 8 Nov).
CREATE OR REPLACE FUNCTION private.is_promotion_rule(p_conditions jsonb, p_effect jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false,
      "properties": {
        "tier_ids": {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}},
        "stakes": {"type": "array", "minItems": 1, "items": {"type": "string", "pattern": "^[a-z0-9_]{2,40}$"}},
        "table_ids": {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}},
        "days": {"type": "array", "minItems": 1, "items": {"type": "integer", "minimum": 1, "maximum": 7}},
        "from": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "until": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "first_n": {"type": "object", "additionalProperties": false, "required": ["count", "per"],
                    "properties": {"count": {"type": "integer", "minimum": 1, "maximum": 1000}, "per": {"enum": ["table", "day"]}}},
        "new_player": {"const": true},
        "lapsed_days": {"type": "integer", "minimum": 1, "maximum": 365},
        "min_visits_in_month": {"type": "integer", "minimum": 1, "maximum": 31},
        "call_time_complete": {"const": true},
        "min_hours": {"type": "integer", "minimum": 1, "maximum": 24},
        "hands": {"type": "array", "minItems": 1, "items": {"enum": ["four_of_a_kind", "straight_flush", "royal_flush", "bad_beat"]}}
      }
    }', p_conditions)
    -- A window is given whole, and opens before it closes within the club's day.
    and (p_conditions ? 'from') = (p_conditions ? 'until')
    and (not p_conditions ? 'from'
         or private.club_minute(p_conditions ->> 'from') < coalesce(nullif(private.club_minute(p_conditions ->> 'until'), 0), 1440))
    and extensions.jsonb_matches_schema('{
      "$defs": {
        "chips": {"type": "integer", "minimum": 5000, "maximum": 1000000000, "multipleOf": 5000},
        "days": {"type": "integer", "minimum": 1, "maximum": 90},
        "name": {"type": "string", "minLength": 1, "maxLength": 80, "pattern": "\\S"}
      },
      "oneOf": [
        {"type": "object", "additionalProperties": false, "required": ["kind", "amount_paise"],
         "properties": {"kind": {"const": "bonus"}, "amount_paise": {"$ref": "#/$defs/chips"}, "expires_days": {"$ref": "#/$defs/days"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "percent_bps", "expires_days"],
         "properties": {"kind": {"const": "bonus"}, "percent_bps": {"type": "integer", "minimum": 1, "maximum": 10000},
                        "cap_paise": {"$ref": "#/$defs/chips"}, "expires_days": {"$ref": "#/$defs/days"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "points"],
         "properties": {"kind": {"const": "points"}, "points": {"type": "integer", "minimum": 1, "maximum": 1000000}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "multiplier_percent"],
         "properties": {"kind": {"const": "points"}, "multiplier_percent": {"type": "integer", "minimum": 101, "maximum": 1000}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tournament"],
         "properties": {"kind": {"const": "freeroll_ticket"}, "tournament": {"$ref": "#/$defs/name"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"const": "cab_eligibility"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "prize"],
         "properties": {"kind": {"const": "physical_prize"}, "prize": {"$ref": "#/$defs/name"},
                        "value_paise": {"type": "integer", "minimum": 0, "maximum": 1000000000}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "pool", "amount_paise"],
         "properties": {"kind": {"const": "jackpot_payout"}, "pool": {"enum": ["main", "season", "freeroll"]}, "amount_paise": {"$ref": "#/$defs/chips"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "text"],
         "properties": {"kind": {"const": "message"}, "text": {"type": "string", "minLength": 1, "maxLength": 500, "pattern": "\\S"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"const": "spin"}}}
      ]
    }', p_effect);
$function$;
