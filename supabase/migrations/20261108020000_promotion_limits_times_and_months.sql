-- Promotions say "up to N times a member" and "a budget each month" in their typed limits (owner, 3 Nov; decision 0499),
-- so the rules left on the old path for either move onto versions.
--
-- The rule in words. A version's limits may let a member have it up to `timesPerMember` times (2 to 20) in each of its
-- periods (a visit, a club day, a club week, or ever); left out, once. A member's grants in a period are keyed by the
-- period for the first, then `#2`, `#3` and on (private.promo_slot_key), so the unique (promotion, member, period key)
-- index still holds each one under concurrency: two cashiers racing for the last one write the same key, and one is
-- skipped. With `budgetPeriod` `month`, the budget in bonus chips and the most grants count only the grants of the
-- event's calendar month of club days (06:00 IST on the first to 06:00 IST on the first of the next), and start again
-- from nothing each month; approving such a version writes a monthly promotion_budget, so the spin wheel's cap and the
-- reports read the same month. A whole grant fits what is left, never part of it, as before. @rivr/domain
-- (periodKey, slotKey, tallyFor, checkLimits) is proved equal on packages/testing/golden/promotionRewards.json
-- (supabase/tests/024_golden_twins.test.sql).

-- 1. The terms' check takes the two new limits.
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
$$;

-- 2. @rivr/domain checkLimits: the member's grants in the period against up to N times.
create or replace function private.promo_check_limits(p_reward jsonb, p_limits jsonb, p_grant jsonb, p_tally jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when (p_tally ->> 'periodGiven')::integer >= coalesce((p_limits ->> 'timesPerMember')::integer, 1) then 'already_given'
    when p_reward ->> 'kind' = 'buyin_bonus' and p_reward ? 'firstNBuyinsPerTable'
         and coalesce((p_tally ->> 'grantsAtTableToday')::integer >= (p_reward ->> 'firstNBuyinsPerTable')::integer, true) then 'first_n_taken'
    when p_limits ? 'maxMembersPerDay' and not (p_tally ->> 'isMemberGrantedToday')::boolean
         and (p_tally ->> 'membersToday')::integer >= (p_limits ->> 'maxMembersPerDay')::integer then 'members_per_day'
    when p_limits ? 'maxGrants' and (p_tally ->> 'grantsGiven')::integer >= (p_limits ->> 'maxGrants')::integer then 'max_grants'
    when p_limits ? 'budgetChips'
         and (p_tally ->> 'chipsGiven')::bigint + coalesce((p_grant ->> 'chips')::bigint, 0) > (p_limits ->> 'budgetChips')::bigint then 'budget_exhausted'
  end;
$$;

-- 3. @rivr/domain slotKey: a member's next grant in a period, keyed as their Nth there.
create function private.promo_slot_key(p_base text, p_given integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_given = 0 then p_base else p_base || '#' || (p_given + 1)::text end;
$$;

-- 4. @rivr/domain tallyFor, over the promotion's grants: a monthly budget counts its month alone, and the member's grants
-- in the period are counted with their numbered keys.
drop function private.promotion_tally(uuid, uuid, text, uuid, date);
create function private.promotion_tally(p_promotion_id uuid, p_member_id uuid, p_period_key text, p_table_id uuid, p_day date, p_limits jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'chipsGiven', coalesce(sum(g.chips) filter (where g.is_counted), 0),
    'grantsGiven', count(*) filter (where g.is_counted),
    'membersToday', count(distinct g.member_id) filter (where g.club_day = p_day),
    'isMemberGrantedToday', coalesce(bool_or(g.member_id = p_member_id and g.club_day = p_day), false),
    'periodGiven', count(*) filter (where g.member_id = p_member_id
                                     and (g.period_key = p_period_key or starts_with(g.period_key, p_period_key || '#'))),
    'grantsAtTableToday', case when p_table_id is not null then count(*) filter (where g.club_day = p_day and g.table_id = p_table_id) end)
  from (select x.*, p_limits ->> 'budgetPeriod' is distinct from 'month'
                    or date_trunc('month', x.club_day) = date_trunc('month', p_day) as is_counted
        from public.promotion_grant x where x.promotion_id = p_promotion_id) g;
$$;

-- 5. The engine on versions, as 20261107120000_promotion_engine_on_versions.sql made it, with the tally and the key.
create or replace function private.evaluate_promotion_versions(p_venue_id uuid, p_trigger text, p_context jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := case p_trigger when 'buy_in' then 'buy_in' when 'hours_played' then 'time_played' when 'check_in' then 'visit'
                                when 'referral' then 'referral' when 'signup' then 'signup' end;
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
begin
  if v_kind is null or exists (select 1 from public.promotion_grant g where g.venue_id = p_venue_id and g.member_id = v_member_id
                                 and g.source_key = p_context ->> 'key' and g.promotion_version_id is not null) then
    return;
  end if;
  v_member := private.promotion_member_facts(v_member_id);
  for v_version in
    select v.* from public.promotion_version v join public.promotion p on p.id = v.promotion_id
    where v.venue_id = p_venue_id and v.status = 'live' and private.promotion_event_kind(v.reward) = v_kind
    order by p.created_at, p.id
    for update of v
  loop
    v_event := private.promotion_event(v_kind, v_version, p_context);
    continue when not private.promo_is_eligible(
      jsonb_build_object('reward', v_version.reward, 'eligibility', v_version.eligibility, 'schedule', v_version.schedule), v_member, v_event);
    select * into v_grant from private.promo_grant(v_version.reward, v_event);
    continue when v_grant.o_refusal is not null;
    -- The member's grants in the period count against up to N times; the next is keyed as theirs in it (decision 0499).
    v_base := private.promo_period_key(v_version.limits, p_context ->> 'key', now(), (v_event ->> 'visitId')::uuid);
    v_tally := private.promotion_tally(v_version.promotion_id, v_member_id, v_base, (v_event ->> 'tableId')::uuid, private.club_day_of(now()),
                                       v_version.limits);
    continue when private.promo_check_limits(v_version.reward, v_version.limits, jsonb_build_object('chips', v_grant.o_chips), v_tally) is not null;
    v_period := private.promo_slot_key(v_base, (v_tally ->> 'periodGiven')::integer);
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
$$;

-- 6. Approving a version: its budget, monthly or whole, for the wheel and the reports.
create or replace function private.approve_promotion_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.approve');
  v_staff_id uuid := private.current_staff_id(v_version.venue_id);
begin
  if v_version.status <> 'awaiting_approval' then
    raise exception 'This version is not waiting: it was already decided' using errcode = 'RVDEC';
  end if;
  if v_staff_id is null or v_staff_id = v_version.author_staff_id or v_staff_id = v_version.edited_by_staff_id then
    raise exception 'Another super admin approves the promotion you submitted or changed' using errcode = 'RVTWO';
  end if;
  update public.promotion_version set status = 'ended' where promotion_id = v_version.promotion_id and status in ('scheduled', 'live', 'paused');
  update public.promotion_version
  set status = case when (v_version.schedule ->> 'startsOn')::date <= private.club_day_of(now()) then 'live' else 'scheduled' end,
      decided_by_staff_id = v_staff_id, decided_at = now()
  where id = p_version_id;
  delete from public.promotion_budget b where b.promotion_id = v_version.promotion_id;
  if v_version.limits ? 'budgetChips' or v_version.limits ? 'maxGrants' then
    insert into public.promotion_budget (venue_id, promotion_id, cap_paise, cap_count, period)
    values (v_version.venue_id, v_version.promotion_id, (v_version.limits ->> 'budgetChips')::bigint * 100, (v_version.limits ->> 'maxGrants')::integer,
            -- A monthly budget is the wheel's and the reports' monthly cap too (decision 0499).
            case v_version.limits ->> 'budgetPeriod' when 'month' then 'month' else 'promotion' end);
  end if;
  perform private.sync_promotion(v_version.promotion_id);
  perform private.emit(v_version.venue_id, 'promotion.published',
                       jsonb_build_object('promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id, 'name', v_version.name,
                                          'detail', v_version.detail, 'runs', v_version.runs),
                       'promotion.published:' || v_version.id);
end;
$$;

-- 7. The rules left on the old path for up to N a member or a monthly budget move onto versions.
create or replace function private.insert_version_from_rule(p_promotion public.promotion, p_reward jsonb, p_conditions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget public.promotion_budget;
  v_status text := case p_promotion.status when 'pending' then 'awaiting_approval' else p_promotion.status end;
begin
  select * into v_budget from public.promotion_budget b where b.promotion_id = p_promotion.id;
  if v_status = 'awaiting_approval' and p_promotion.requested_by_staff_id is null then
    v_status := 'draft';
  end if;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels, rules_text, link,
                                        detail, runs, author_staff_id, submitted_at, decided_by_staff_id, decided_at, rejected_reason)
  values (p_promotion.venue_id, p_promotion.id, 1, v_status, p_promotion.name, p_reward,
          jsonb_strip_nulls(jsonb_build_object('stakes', coalesce(p_conditions -> 'stakes', '"all"'), 'tiers', coalesce(p_conditions -> 'tier_ids', '"all"'),
                                               'audience', 'everyone', 'tableIds', p_conditions -> 'table_ids')),
          jsonb_strip_nulls(jsonb_build_object('days', coalesce(p_conditions -> 'days', '[1, 2, 3, 4, 5, 6, 7]'), 'from', coalesce(p_conditions ->> 'from', '06:00'),
                             'to', coalesce(p_conditions ->> 'until', '06:00'), 'startsOn', private.club_day_of(p_promotion.starts_at)::text,
                             'timezone', 'Asia/Kolkata',
                             -- No end date, no last day: greatest() skips a null, which made the start day the last.
                             'endsOn', case when p_promotion.ends_at is not null
                                            then greatest(private.club_day_of(p_promotion.ends_at - interval '1 second'),
                                                          private.club_day_of(p_promotion.starts_at))::text end)),
          jsonb_strip_nulls(jsonb_build_object(
            'perMember', case when p_promotion.per_player_limit >= 1 and p_promotion.per_player_period = 'day' then 'per_day'
                              when p_promotion.per_player_limit >= 1 and p_promotion.per_player_period = 'promotion' then 'once'
                              -- The first N grants a club day with no limit a member: one a club day each, N members a day,
                              -- so never more than N grants a club day (decision 0501).
                              when p_promotion.per_player_limit is null and p_conditions #>> '{first_n,per}' = 'day' then 'per_day'
                              else 'none' end,
            -- Up to N a day or ever, as the rule allowed N (decision 0499).
            'timesPerMember', case when p_promotion.per_player_limit > 1 and p_promotion.per_player_period in ('day', 'promotion')
                                   then p_promotion.per_player_limit end,
            'maxMembersPerDay', case when p_conditions #>> '{first_n,per}' = 'day' then (p_conditions #>> '{first_n,count}')::integer end,
            'budgetChips', nullif(v_budget.cap_paise / 5000 * 50, 0), 'maxGrants', v_budget.cap_count,
            'budgetPeriod', case when v_budget.period = 'month' and (v_budget.cap_paise >= 5000 or v_budget.cap_count is not null) then 'month' end)),
          '{"playerApp": true, "tv": true, "website": true, "whatsapp": true}', p_promotion.rules, p_promotion.link, p_promotion.detail, p_promotion.runs,
          p_promotion.requested_by_staff_id, p_promotion.requested_at, p_promotion.decided_by_staff_id, p_promotion.decided_at, p_promotion.refused_reason);
  perform set_config('rivr.promotion_sync', 'on', true);
  update public.promotion set current_version = 1 where id = p_promotion.id and status in ('live', 'paused', 'ended');
  perform set_config('rivr.promotion_sync', 'off', true);
  -- The old path wrote a bonus's spend in rupees only (cost_paise), never as chips: the version's budget counts chips, so
  -- each such grant counts its chips now, rounded up, so the budget is never spent twice (money audit, decision 0499).
  update public.promotion_grant g
  set chips = (g.cost_paise + 99) / 100
  where g.promotion_id = p_promotion.id and g.promotion_rule_id is not null and g.chips = 0 and g.cost_paise > 0
    and g.effect ->> 'kind' = 'bonus';
  -- Grants already given count in their period, so a once-only promotion stays once; a member's second and later in one
  -- period are numbered as the engine numbers them (decision 0499).
  update public.promotion_grant g
  set period_key = private.promo_slot_key(k.base, k.n - 1)
  from (select x.id, private.promo_period_key(v.limits, x.source_key, x.created_at, null) as base,
               row_number() over (partition by x.member_id, private.promo_period_key(v.limits, x.source_key, x.created_at, null)
                                  order by x.created_at, x.id)::integer as n
        from public.promotion_grant x
        join public.promotion_version v on v.promotion_id = x.promotion_id and v.version = 1
        where x.promotion_id = p_promotion.id and x.period_key is null) k
  where g.id = k.id;
end;
$$;

create or replace function private.version_promotions(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
    -- Up to N ever on a buy-in is a fixed bonus on any buy-in: the first buy-in's chips say once ever (money audit).
    if coalesce(v_promotion.per_player_limit, 1) > 1 and v_reward ->> 'kind' = 'bonus_chips' and v_reward ->> 'on' = 'first_buyin' then
      v_reward := jsonb_strip_nulls(jsonb_build_object('kind', 'buyin_bonus', 'mode', 'fixed', 'chips', v_reward -> 'chips',
        'firstNBuyinsPerTable', case when v_rule.conditions #>> '{first_n,per}' = 'table' then (v_rule.conditions #>> '{first_n,count}')::integer end));
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
  perform private.add_points_multiplier_templates(p_venue_id);
end;
$$;

select private.version_promotions(v.id) from public.venue v;

-- The practice venue's reset keeps them in versions (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;

revoke execute on function private.promo_slot_key(text, integer),
  private.promotion_tally(uuid, uuid, text, uuid, date, jsonb) from public, anon, authenticated;
