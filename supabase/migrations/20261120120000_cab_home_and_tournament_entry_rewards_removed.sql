-- The cab home and the tournament entry leave a promotion's rewards (redesign of 15 Nov 2026, issue 966, RD-23; the owner's
-- answer to question 943: "remove both"). A tournament has no ticket to give since registration went, and a cab home was
-- never shown to members. What a promotion gives now: Bonus on a seat, on hours played, on a visit, a referral or a
-- sign-up, for a high hand, and waitlist priority. Cab requests themselves (the feature cab.requests, the setting
-- cab.minimum_visits, the website's card) are not this migration's: only the reward. Every function below is as the newest
-- migration before this one left it, less the two rewards.

-- Promotions that gave only one of the two go whole, whatever their status, as the free spin's, the points multiplier's
-- and the buy-in's did: a version's reward must stay one the schema accepts. Read on 15 Nov 2026: production has one (the
-- practice venue's Cab home template, ended since 20261110130000, one untouched version, no rule, no grant); staging has
-- two of the same, one a venue. A person decides, and the migration stops, where one ever gave a grant (a member's
-- history), a perk of either kind was granted anywhere, or the promotion also has a version of another kind or a rule.
create temporary table gone_reward_promotion as
select p.id, p.status from public.promotion p
where p.template_key = 'cab'
   or exists (select 1 from public.promotion_version v where v.promotion_id = p.id and v.reward ->> 'kind' in ('cab_home', 'tournament_entry'));
do $$
declare
  v_counts text;
begin
  if exists (select 1 from public.promotion_grant g where g.promotion_id in (select id from gone_reward_promotion))
     or exists (select 1 from public.promotion_grant g where g.perk in ('cab_home', 'tournament_entry'))
     or exists (select 1 from gone_reward_promotion s join public.promotion_version v on v.promotion_id = s.id
                where v.reward ->> 'kind' not in ('cab_home', 'tournament_entry'))
     or exists (select 1 from gone_reward_promotion s join public.promotion_rule r on r.promotion_id = s.id) then
    raise exception 'A cab home or tournament entry promotion gave something, or has a rule or a version of another kind: a person decides what is kept before the two rewards go';
  end if;
  select coalesce(string_agg(c.status || ' ' || c.n, ', ' order by c.status), 'none') into v_counts
  from (select s.status, count(*) as n from gone_reward_promotion s group by s.status) c;
  raise notice 'Cab home and tournament entry promotions removed, by status: %', v_counts;
end;
$$;
delete from public.promotion_step_skip s where s.promotion_id in (select id from gone_reward_promotion);
-- Its versions and budget go with it.
delete from public.promotion p where p.id in (select id from gone_reward_promotion);
drop table gone_reward_promotion;

-- The one perk a grant can carry.
alter table public.promotion_grant drop constraint promotion_grant_perk_check;
alter table public.promotion_grant add constraint promotion_grant_perk_check check (perk = 'waitlist_priority');

-- A new venue's templates: no Cab home.
CREATE OR REPLACE FUNCTION private.add_promotion_templates(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'referral', 'Referral', '1,000 bonus chips to each side', 'Every day', null, null),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'Front of every waitlist', 'Every night', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus chips', '1,000 bonus chips after four hours at the tables', 'Every night', 1, 'day')
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('hours_bonus', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
  perform private.version_promotions(p_venue_id);
end;
$function$
;

-- A version's terms: neither reward.
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
                                                 "minPlayersDealt": {"type": "integer", "minimum": 2, "maximum": 10}}}}}
      ]
    }', p_reward)
    -- A play-time bonus's set steps each later than the one before (owner, 8 Nov).
    and (p_reward ->> 'mode' is distinct from 'steps' or private.is_rising_steps(p_reward -> 'steps'))
    -- A high hand lists each hand once, and is held by its budget alone, which it must have (redesign RD-22).
    and (p_reward ->> 'kind' is distinct from 'high_hand'
         or ((select count(distinct h ->> 'hand') = count(*) from jsonb_array_elements(p_reward -> 'hands') h)
             and p_limits ->> 'perMember' = 'none' and not p_limits ? 'maxMembersPerDay' and not p_limits ? 'maxGrants'
             and p_limits ? 'budgetChips'))
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
$function$
;

-- What a reward gives for one event (@rivr/domain computeGrant): the one perk on a visit is waitlist priority.
CREATE OR REPLACE FUNCTION private.promo_grant(p_reward jsonb, p_event jsonb)
 RETURNS TABLE(o_chips bigint, o_perk text, o_refusal text)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_kind text := p_reward ->> 'kind';
  v_event text := p_event ->> 'kind';
  v_chips bigint := 0;
  v_perk text;
  v_refusal text;
  v_step bigint;
begin
  if v_event = 'seated' and v_kind = 'seat_bonus' then
    -- In tiers (decision 0580): on the first seat of a visit, at the first tier's chips until the limits set the tier.
    if (p_reward ? 'tiers' or not p_reward ? 'firstNSeatsPerTable') and not (p_event ->> 'isFirstOfVisit')::boolean then
      v_refusal := 'not_first_seat';
    else
      v_chips := coalesce((p_reward ->> 'chips')::bigint, (p_reward -> 'tiers' -> 0 ->> 'chips')::bigint);
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
  elsif v_event = 'visit' and v_kind = 'waitlist_priority' then
    v_perk := v_kind;
  elsif v_kind = 'bonus_chips' and v_event in ('visit', 'referral', 'signup') and p_reward ->> 'on' = v_event then
    v_chips := (p_reward ->> 'chips')::bigint;
  elsif v_event = 'high_hand' and v_kind = 'high_hand' then
    -- The listed hand's chips, whole, every time (redesign RD-22).
    select h.o_chips, h.o_refusal into v_chips, v_refusal from private.high_hand_payout(p_reward, p_event) h;
  else
    v_refusal := 'other_event';
  end if;
  if v_refusal is not null then
    return query select 0::bigint, null::text, v_refusal;
  else
    return query select v_chips, v_perk, null::text;
  end if;
end;
$function$
;

-- An old rule as a version's reward: a graduate's freeroll ticket is none now, so its rule stays on the old path.
CREATE OR REPLACE FUNCTION private.reward_from_rule(p_promotion promotion, p_rule promotion_rule)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select jsonb_strip_nulls(case
    when p_rule.trigger = 'hours_played' and e ->> 'kind' = 'bonus' and e ? 'amount_paise' and c ? 'min_hours'
      then jsonb_build_object('kind', 'hours_bonus', 'chips', (e ->> 'amount_paise')::bigint / 100, 'afterMinutes', (c ->> 'min_hours')::integer * 60)
    when p_rule.trigger in ('referral', 'check_in') and e ->> 'kind' = 'bonus' and e ? 'amount_paise'
      then jsonb_build_object('kind', 'bonus_chips', 'chips', (e ->> 'amount_paise')::bigint / 100,
                              'on', case p_rule.trigger when 'referral' then 'referral' else 'visit' end)
  end)
  from (select p_rule.effect as e, p_rule.conditions as c) x
  -- Only the conditions the typed model has; the first N a table was a buy-in's, so a rule with it stays on the old path.
  where not exists (select 1 from jsonb_object_keys(p_rule.conditions) k
                    where k not in ('days', 'from', 'until', 'stakes', 'table_ids', 'tier_ids', 'first_n', 'min_hours'))
    and (not p_rule.conditions ? 'first_n' or p_rule.conditions #>> '{first_n,per}' = 'day');
$function$
;

-- The old promotions as versions: no cab home to make of the template.
CREATE OR REPLACE FUNCTION private.version_promotions(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_promotion public.promotion;
  v_rule public.promotion_rule;
  v_reward jsonb;
begin
  for v_promotion in
    select p.* from public.promotion p
    where p.venue_id = p_venue_id and not exists (select 1 from public.promotion_version v where v.promotion_id = p.id)
    order by p.created_at, p.id
  loop
    select * into v_rule from public.promotion_rule r where r.promotion_id = v_promotion.id order by r.position limit 1;
    if v_rule.id is not null and (select count(*) from public.promotion_rule r where r.promotion_id = v_promotion.id) = 1 then
      v_reward := private.reward_from_rule(v_promotion, v_rule);
    elsif v_rule.id is null and v_promotion.template_key = 'founders_priority' then
      v_reward := '{"kind": "waitlist_priority"}';
    else
      v_reward := null;
    end if;
    -- A rule the model cannot say exactly stays on the old path (decision 0491; money audit). Up to N a member and monthly
    -- budgets are the model's now (decision 0499); more than 20 a member is not, nor a budget under 50 chips, whole or
    -- monthly, which a version's whole 50s of chips would drop, nor the first N grants a club day when a member may have
    -- it more than once: the model counts members a day, and a member given it twice would take two of the N. With no
    -- limit a member, it converts as one a club day each (decision 0501).
    if coalesce(v_promotion.per_player_limit, 1) > 20
       or exists (select 1 from public.promotion_budget b where b.promotion_id = v_promotion.id and b.cap_paise is not null and b.cap_paise < 5000)
       or (v_rule.conditions #>> '{first_n,per}' = 'day' and coalesce(v_promotion.per_player_limit, 1) > 1) then
      v_reward := null;
    end if;
    if v_reward is not null then
      perform private.insert_version_from_rule(v_promotion, v_reward,
        case when v_promotion.template_key = 'founders_priority'
             then jsonb_strip_nulls(jsonb_build_object('tier_ids',
                    (select jsonb_agg(t.id) from public.tier t where t.venue_id = p_venue_id and t.name = 'Founders'' Circle')))
             else coalesce(v_rule.conditions, '{}') end);
    end if;
  end loop;
end;
$function$
;

-- Where a promotion shows: its version's channels, with no cab home to hold back.
CREATE OR REPLACE FUNCTION private.promotion_shows_on(p_promotion_id uuid, p_channel text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select coalesce((v.channels ->> p_channel)::boolean, false)
    from public.promotion p join public.promotion_version v on v.promotion_id = p.id and v.version = p.current_version
    where p.id = p_promotion_id), true);
$function$
;

-- Only the cab home card asked whether a tier offers cab requests.
drop function private.offers_cab_requests(uuid);
