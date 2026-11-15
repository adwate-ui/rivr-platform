-- The buy-in trigger goes from promotions (issue 1009; the owner, 15 Nov: "Remove it"). Nothing has recorded a buy-in since
-- the cage went (20261117210000), so a promotion on a buy-in looked live and never paid. What goes: the buy-in bonus (a
-- percent of the buy-in, or fixed chips), bonus chips on a visit's first buy-in, the old engine's buy_in rule, and the
-- "Buy-in bonus Tuesday" template. Bonus on the seat, on hours played, on a referral, on sign-up and by hand are untouched.
-- Every function below is as the newest migration before this one left it, less the buy-in.

-- Promotions that only a buy-in set off go whole, as the free spin's and the points multiplier's did: a version's reward
-- must stay one the schema accepts. The Buy-in bonus Tuesday template goes whole too where its one version is the seat
-- bonus draft 20261110130000 made of it and nobody has touched since: the owner's word is that the template goes.
-- What a person must decide stops the migration: a buy-in promotion that ever gave a grant (a member's history, which
-- counts against limits); one with a rule of another trigger; and one with a version of another kind that runs (live or
-- scheduled), that someone wrote, changed, submitted or decided, or that is not the template's.
-- Read on 15 Nov 2026: production has one, the practice venue's template as an untouched seat bonus draft with its buy_in
-- rule; staging has two, the template paused at each venue with a buy-in bonus. None ever gave a grant. All three go.
create temporary table buy_in_promotion as
select p.id, p.status, p.template_key from public.promotion p
where p.template_key = 'tuesday_bonus'
   or exists (select 1 from public.promotion_version v where v.promotion_id = p.id
              and (v.reward ->> 'kind' = 'buyin_bonus' or v.reward ->> 'on' = 'first_buyin'))
   or exists (select 1 from public.promotion_rule r where r.promotion_id = p.id and r.trigger = 'buy_in');
do $$
declare
  v_counts text;
begin
  if exists (select 1 from public.promotion_grant g where g.promotion_id in (select id from buy_in_promotion))
     or exists (select 1 from buy_in_promotion s join public.promotion_rule r on r.promotion_id = s.id where r.trigger <> 'buy_in')
     or exists (select 1 from buy_in_promotion s join public.promotion_version v on v.promotion_id = s.id
                where v.reward ->> 'kind' <> 'buyin_bonus' and v.reward ->> 'on' is distinct from 'first_buyin'
                  and (s.template_key is distinct from 'tuesday_bonus' or v.status in ('live', 'scheduled') or v.version > 1
                       or v.edited_by_staff_id is not null or v.author_staff_id is not null or v.decided_by_staff_id is not null)) then
    raise exception 'A buy-in promotion gave something, has a rule of another trigger, or has a version of another kind that runs or that someone wrote: decide what is kept before the buy-in trigger goes';
  end if;
  select coalesce(string_agg(c.status || ' ' || c.n, ', ' order by c.status), 'none') into v_counts
  from (select s.status, count(*) as n from buy_in_promotion s group by s.status) c;
  raise notice 'Buy-in promotions removed, by status: %', v_counts;
end;
$$;
delete from public.promotion_step_skip s where s.promotion_id in (select id from buy_in_promotion);
-- Its versions, rules and budget go with it.
delete from public.promotion p where p.id in (select id from buy_in_promotion);
drop table buy_in_promotion;

-- No rule is set off by a buy-in.
alter table public.promotion_rule drop constraint promotion_rule_trigger_check;
alter table public.promotion_rule add constraint promotion_rule_trigger_check
  check (trigger = any (array['hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in', 'graduation', 'date_window']));

-- A new venue's templates: no Buy-in bonus Tuesday.
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
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
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

-- A version's terms: no buy-in bonus, and bonus chips on a visit, a referral or a sign-up.
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
        {"type": "object", "additionalProperties": false, "required": ["kind", "fromVisitInMonth"],
         "properties": {"kind": {"const": "cab_home"}, "fromVisitInMonth": {"type": "integer", "minimum": 1, "maximum": 31}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tournamentId"],
         "properties": {"kind": {"const": "tournament_entry"}, "tournamentId": {"type": "string", "minLength": 1, "maxLength": 80, "pattern": "\\S"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"const": "waitlist_priority"}}}
      ]
    }', p_reward)
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
         or (p_limits ->> 'perMember' = 'once' and not p_limits ? 'timesPerMember' and coalesce(p_limits ->> 'budgetPeriod', '') <> 'month'));
$function$
;

-- The kind of event a reward is given for.
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
    else 'visit' end;
$function$
;

-- An event as a version weighs it: no buy-in.
CREATE OR REPLACE FUNCTION private.promotion_event(p_kind text, p_version promotion_version, p_context jsonb)
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
  if p_kind = 'seated' then
    -- At the moment they sat; the first of the visit unless an earlier seat of it remains (one undone is gone).
    return v_base || jsonb_build_object('at', least((p_context ->> 'at')::timestamptz, now()),
      'isFirstOfVisit', not exists (select 1 from public.seat_session s where s.visit_id = v_visit and s.member_id = v_member
                                      and s.started_at < (p_context ->> 'at')::timestamptz));
  elsif p_kind = 'time_played' then
    select * into v_time from private.visit_schedule_time(v_visit, p_version.schedule, p_version.eligibility);
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60);
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
$function$
;

-- What a reward gives for one event (@rivr/domain computeGrant; packages/testing/golden/promotionRewards.json): nothing on a
-- buy-in. Chips are whole 50s from 50 by the terms' own check, so a grant of nothing cannot be reached and is not named.
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
  elsif v_event = 'visit' and v_kind = 'cab_home' then
    if (p_event ->> 'visitInMonth')::integer >= (p_reward ->> 'fromVisitInMonth')::integer then v_perk := 'cab_home'; else v_refusal := 'not_yet'; end if;
  elsif v_event = 'visit' and v_kind in ('tournament_entry', 'waitlist_priority') then
    v_perk := v_kind;
  elsif v_kind = 'bonus_chips' and v_event in ('visit', 'referral', 'signup') and p_reward ->> 'on' = v_event then
    v_chips := (p_reward ->> 'chips')::bigint;
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

-- Whether the limits let a grant through (@rivr/domain checkLimits): the first N are a seat bonus's alone.
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
    when p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'firstNSeatsPerTable'
         and coalesce((p_tally ->> 'grantsAtTableToday')::integer >= (p_reward ->> 'firstNSeatsPerTable')::integer, true) then 'first_n_taken'
    when p_limits ? 'maxMembersPerDay' and not (p_tally ->> 'isMemberGrantedToday')::boolean
         and (p_tally ->> 'membersToday')::integer >= (p_limits ->> 'maxMembersPerDay')::integer then 'members_per_day'
    when p_limits ? 'maxGrants' and (p_tally ->> 'grantsGiven')::integer >= (p_limits ->> 'maxGrants')::integer then 'max_grants'
    when p_limits ? 'budgetChips'
         and (p_tally ->> 'chipsGiven')::bigint
             + coalesce(private.promo_tier_chips(p_reward, (p_tally ->> 'grantsGiven')::integer), (p_grant ->> 'chips')::bigint, 0) > (p_limits ->> 'budgetChips')::bigint then 'budget_exhausted'
  end;
$function$
;

-- An old rule as a version's reward: one on a buy-in is none now.
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
    when p_rule.trigger = 'graduation' and e ->> 'kind' = 'freeroll_ticket'
      then jsonb_build_object('kind', 'tournament_entry', 'tournamentId', e ->> 'tournament')
  end)
  from (select p_rule.effect as e, p_rule.conditions as c) x
  -- Only the conditions the typed model has; the first N a table was a buy-in's, so a rule with it stays on the old path.
  where not exists (select 1 from jsonb_object_keys(p_rule.conditions) k
                    where k not in ('days', 'from', 'until', 'stakes', 'table_ids', 'tier_ids', 'first_n', 'min_hours'))
    and (not p_rule.conditions ? 'first_n' or p_rule.conditions #>> '{first_n,per}' = 'day');
$function$
;

-- The old promotions as versions: no buy-in to convert.
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
    elsif v_rule.id is null and v_promotion.template_key = 'cab' then
      v_reward := '{"kind": "cab_home", "fromVisitInMonth": 4}';
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

-- The old engine: a buy-in is no trigger.
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
  if p_trigger is null or p_trigger <> all (array['hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in',
                                                  'graduation', 'date_window', 'signup', 'hours_step', 'seated'])
     or length(coalesce(p_context ->> 'key', '')) not between 1 and 200 or coalesce((p_context ->> 'amount_paise')::bigint, 0) < 0
     or coalesce((p_context ->> 'hours_played')::numeric, 0) < 0
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
$function$
;

-- The engine on versions: a buy-in is no event.
CREATE OR REPLACE FUNCTION private.evaluate_promotion_versions(p_venue_id uuid, p_trigger text, p_context jsonb)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_kind text := case p_trigger when 'hours_played' then 'time_played' when 'check_in' then 'visit'
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
      'promotion', v_version.promotion_id::text, 'version_id', v_version.id, 'trigger', p_trigger,
      'chips', v_chips, 'perk', v_grant.o_perk, 'period_key', v_period, 'event', v_event));
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
$function$
;
