-- No audience of women (owner, 3 Nov; decision 0497). The club records no gender, so a promotion for women members
-- matched nobody; the audience goes from the typed terms, the eligibility twin and the member facts the engine and the
-- replay weigh, as it goes from @rivr/contracts and @rivr/domain.
--
-- A version that names women and has run, or waits to (scheduled, live or paused), ends first, while the old check still
-- holds its terms: it never gave anything, and widened to everyone it would start to. A draft, or one waiting for
-- approval, goes back to draft for everyone with its simulation cleared: it runs only once simulated again and approved
-- by a second person, and the promotion stays open to edits (an ended latest version would close it). Every version's
-- audience is then everyone, so each row meets the new check (a restore checks every row again); an ended one's card
-- words, written when it was made, still say who it was for.
do $$
declare
  v_promotion_ids uuid[];
  v_promotion_id uuid;
begin
  with changed as (
    update public.promotion_version v
    set status = case when v.status in ('scheduled', 'live', 'paused') then 'ended' else 'draft' end,
        simulation = case when v.status in ('draft', 'awaiting_approval') then null else v.simulation end,
        simulated_terms = case when v.status in ('draft', 'awaiting_approval') then null else v.simulated_terms end,
        simulated_at = case when v.status in ('draft', 'awaiting_approval') then null else v.simulated_at end
    where v.eligibility ->> 'audience' = 'women' and v.status <> 'ended'
    returning v.promotion_id
  )
  select array_agg(distinct promotion_id) into v_promotion_ids from changed;
  update public.promotion_version v
  set eligibility = jsonb_set(v.eligibility, '{audience}', '"everyone"')
  where v.eligibility ->> 'audience' = 'women';
  foreach v_promotion_id in array coalesce(v_promotion_ids, '{}') loop
    perform private.sync_promotion(v_promotion_id);
  end loop;
end;
$$;

-- The shapes @rivr/contracts checks, without women.
create or replace function private.is_promotion_terms(p_reward jsonb, p_eligibility jsonb, p_schedule jsonb, p_limits jsonb, p_channels jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
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
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips", "afterMinutes"],
         "properties": {"kind": {"const": "hours_bonus"}, "chips": {"$ref": "#/$defs/chips"}, "afterMinutes": {"$ref": "#/$defs/minutes"}}},
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
        "maxMembersPerDay": {"type": "integer", "minimum": 1, "maximum": 10000},
        "budgetChips": {"type": "integer", "minimum": 50, "maximum": 10000000, "multipleOf": 50},
        "maxGrants": {"type": "integer", "minimum": 1, "maximum": 1000000}
      }
    }', p_limits)
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["playerApp", "tv", "website", "whatsapp"],
      "properties": {"playerApp": {"type": "boolean"}, "tv": {"type": "boolean"}, "website": {"type": "boolean"}, "whatsapp": {"type": "boolean"}}
    }', p_channels);
$$;

-- Who qualifies (@rivr/domain isEligible): tier, audience (new members, lapsed regulars or everyone), then stakes,
-- tables and the schedule for rewards that are not for time played.
create or replace function private.promo_is_eligible(p_terms jsonb, p_member jsonb, p_context jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_listed(e -> 'tiers', p_member ->> 'tierId')
     and case e ->> 'audience'
           when 'new_30d' then (p_member ->> 'daysSinceJoined')::integer < 30
           when 'lapsed' then coalesce((p_member ->> 'daysSinceLastVisit')::integer >= 30, false)
           -- Any audience the terms no longer have, such as women, matches nobody.
           when 'everyone' then true
           else false end
     and (p_terms #>> '{reward,kind}' in ('points_multiplier', 'hours_bonus', 'free_spin')
          or (private.is_listed(e -> 'stakes', p_context ->> 'stake') and private.is_listed(e -> 'tableIds', p_context ->> 'tableId')
              and private.is_in_schedule(p_terms -> 'schedule', (p_context ->> 'at')::timestamptz)))
  from (select p_terms -> 'eligibility' as e) t;
$$;

-- What the engine knows of a member now.
create or replace function private.promotion_member_facts(p_member_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tierId', m.tier_id,
    'daysSinceJoined', private.club_day_of(now()) - private.club_day_of(m.created_at),
    'daysSinceLastVisit', (select floor(extract(epoch from now() - max(v.opened_at)) / 86400)::integer from public.visit v
                           where v.member_id = m.id and v.opened_at <= now() and v.id is distinct from private.current_visit(m.id)))
  from public.member m where m.id = p_member_id;
$$;

-- What the replay knows of a member at an event last week.
create or replace function private.replay_member_facts(p_member_id uuid, p_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tierId', m.tier_id,
    'daysSinceJoined', greatest(private.club_day_of(p_at) - private.club_day_of(m.created_at), 0),
    'daysSinceLastVisit', (select floor(extract(epoch from p_at - max(v.opened_at)) / 86400)::integer from public.visit v
                           where v.member_id = m.id and v.opened_at < p_at - interval '12 hours'))
  from public.member m where m.id = p_member_id;
$$;
