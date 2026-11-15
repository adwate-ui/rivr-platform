-- The spin wheel goes (redesign of 15 Nov 2026, issue 949; docs/spec/redesign-2026-11-15.md slice 1): the wheel, its prizes
-- and spins, the free-spin reward and its template, the wheel's budget, and its TV board. What a promotion gives is points,
-- bonus chips or a perk. Every function below is as the newest migration before this one left it, less its spins.

-- The wheel itself: what staff and the TVs called, then its tables with their triggers.
drop function public.add_spin_prize(uuid, text, bigint, integer), public.remove_spin_prize(uuid, uuid), public.spin_prizes(uuid),
  public.spin_the_wheel(uuid, uuid), public.tv_spin_wheel(), public.waiting_spins(uuid);
drop function private.add_spin_prize(uuid, text, bigint, integer), private.remove_spin_prize(uuid, uuid), private.spin_prizes(uuid),
  private.spin_the_wheel(uuid, uuid), private.tv_spin_wheel(), private.waiting_spins(uuid), private.spin_budget_left(uuid),
  private.spin_prize(jsonb, bigint, bigint);
drop table public.spin, public.spin_wheel;
drop function private.signal_spin_wheel();

-- What gave spins. A promotion that was a free spin and nothing else goes whole: its grants, its versions, its rule and
-- itself. A spin's prize was paid as bonus chips or points of its own, which stay in their histories and in the ledger.
create temporary table spin_promotion as
select p.id from public.promotion p
where p.template_key = 'spin_wheel'
   or exists (select 1 from public.promotion_version v where v.promotion_id = p.id and v.reward ->> 'kind' = 'free_spin')
   or exists (select 1 from public.promotion_rule r where r.promotion_id = p.id and r.effect ->> 'kind' = 'spin');

-- A grant counts against its promotion's limits and budget, and a spin's prize was written back onto the grant that gave
-- it. So nothing is deleted from a promotion that also has another reward, and no grant that paid is deleted: either
-- would let a promotion give again what it gave. Production and staging have neither (read 15 Nov 2026); a database
-- that has one stops here, for a person to decide what its limits and budget keep.
do $$
begin
  if exists (select 1 from spin_promotion s
             where exists (select 1 from public.promotion_version v where v.promotion_id = s.id and v.reward ->> 'kind' <> 'free_spin')
                or exists (select 1 from public.promotion_rule r where r.promotion_id = s.id and r.effect ->> 'kind' <> 'spin'))
     or exists (select 1 from public.promotion_grant g
                where (g.spins > 0 or g.effect ->> 'kind' = 'spin' or g.promotion_id in (select id from spin_promotion))
                  and (g.promotion_id not in (select id from spin_promotion) or g.bonus_grant_id is not null or g.chips > 0 or g.points > 0)) then
    raise exception 'A free spin shares its promotion with another reward, or a grant that gave spins paid a prize: decide what its limits and budget keep before the wheel goes';
  end if;
end;
$$;

delete from public.promotion_grant g where g.promotion_id in (select id from spin_promotion);
delete from public.promotion_step_skip s where s.promotion_id in (select id from spin_promotion);
-- Its versions, rules and budget go with it.
delete from public.promotion p where p.id in (select id from spin_promotion);
drop table spin_promotion;
update public.host_queue_item set offer = null where offer ->> 'kind' = 'spin';
delete from public.setting s where s.key = 'spin.budget';
delete from public.setting_key where key in ('spin.budget');
update public.tv_screen set mode = 'waitlist' where mode = 'spin_wheel';
update public.tv_screen set rotation = array_remove(rotation, 'spin_wheel') where 'spin_wheel' = any (rotation);

alter table public.promotion_grant drop column spins, drop column spins_used;
-- A member's export lists every column of every table that names them (decision 0240): these are gone.
delete from private.member_export_column where table_name = 'spin' or (table_name = 'promotion_grant' and column_name in ('spins', 'spins_used'));

-- What a reward gives for one event: no spins.
drop function private.promo_grant(jsonb, jsonb);
create function private.promo_grant(p_reward jsonb, p_event jsonb)
 RETURNS TABLE(o_points bigint, o_chips bigint, o_perk text, o_refusal text)
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
  if v_refusal is null and v_perk is null and v_points + v_chips = 0 then
    v_refusal := 'nothing_earned';
  end if;
  if v_refusal is not null then
    return query select 0::bigint, 0::bigint, null::text, v_refusal;
  else
    return query select v_points, v_chips, v_perk, null::text;
  end if;
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
$function$;

CREATE OR REPLACE FUNCTION private.give_promotion_version(p_candidate jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_version public.promotion_version;
  v_event jsonb := p_candidate -> 'event';
  v_member uuid := (p_candidate #>> '{event,memberId}')::uuid;
  v_chips bigint := (p_candidate ->> 'chips')::bigint;
  v_points bigint := (p_candidate ->> 'points')::bigint;
  v_id uuid;
begin
  select * into v_version from public.promotion_version v where v.id = (p_candidate ->> 'version_id')::uuid;
  insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, table_id, trigger, effect, cost_paise, points, chips,
                                      perk, source_key, period_key, club_day)
  values (v_version.venue_id, v_version.promotion_id, v_version.id, v_member, (v_event ->> 'tableId')::uuid, p_candidate ->> 'trigger', v_version.reward,
          v_chips * 100, v_points, v_chips, p_candidate ->> 'perk', v_event ->> 'key', p_candidate ->> 'period_key',
          private.club_day_of((v_event ->> 'at')::timestamptz))
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  if v_chips > 0 then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_version.venue_id, v_member, v_chips * 100, v_version.name, null, 'promotion:' || v_id)
    where id = v_id;
  elsif v_points > 0 then
    perform private.credit_points(v_version.venue_id, v_member, v_points, v_version.name, 'promotion:' || v_id);
    update public.promotion_grant set fulfilled_at = now() where id = v_id;
  end if;
  perform private.emit(v_version.venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id,
                                          'member_id', v_member, 'effect', v_version.reward, 'cost_paise', v_chips * 100, 'points', v_points, 'chips', v_chips,
                                          'perk', p_candidate ->> 'perk'),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$function$;

-- A member's grants, for their record: no spins.
drop function public.member_promotion_grants(uuid, integer);
drop function private.member_promotion_grants(uuid, integer);
create function private.member_promotion_grants(p_member_id uuid, p_limit integer)
 RETURNS TABLE(grant_id uuid, granted_at timestamp with time zone, club_day date, promotion_name text, version integer, points bigint, chips bigint, perk text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, g.created_at, g.club_day, coalesce(v.name, p.name), v.version, g.points, g.chips, g.perk
  from public.promotion_grant g
  join public.promotion p on p.id = g.promotion_id
  left join public.promotion_version v on v.id = g.promotion_version_id
  where g.member_id = p_member_id and private.has_permission(g.venue_id, 'members.read')
  order by g.created_at desc, g.id
  limit greatest(least(coalesce(p_limit, 20), 5000), 1);
$function$;

create function public.member_promotion_grants(p_member_id uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(grant_id uuid, granted_at timestamp with time zone, club_day date, promotion_name text, version integer, points bigint, chips bigint, perk text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.member_promotion_grants(p_member_id, p_limit); $function$;
revoke execute on function private.member_promotion_grants(uuid, integer), public.member_promotion_grants(uuid, integer) from public, anon;
grant execute on function private.member_promotion_grants(uuid, integer), public.member_promotion_grants(uuid, integer) to authenticated;

-- The shapes a version may hold: no free spin, and a simulation counts no spins.
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
         "properties": {"kind": {"const": "bonus_chips"}, "chips": {"$ref": "#/$defs/chips"}, "on": {"enum": ["visit", "first_buyin", "referral", "signup"]}}},
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
         or (p_limits ->> 'perMember' = 'once' and not p_limits ? 'timesPerMember' and coalesce(p_limits ->> 'budgetPeriod', '') <> 'month'));
$function$;

CREATE OR REPLACE FUNCTION private.is_promotion_simulation(p_simulation jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select extensions.jsonb_matches_schema('{
    "type": "object", "additionalProperties": false,
    "required": ["events", "membersQualified", "timesGiven", "points", "chips", "perks", "isBudgetReached"],
    "properties": {
      "events": {"type": "integer", "minimum": 0}, "membersQualified": {"type": "integer", "minimum": 0},
      "timesGiven": {"type": "integer", "minimum": 0}, "points": {"type": "integer", "minimum": 0}, "chips": {"type": "integer", "minimum": 0},
      "perks": {"type": "integer", "minimum": 0}, "isBudgetReached": {"type": "boolean"}
    }
  }', p_simulation);
$function$;

update public.promotion_version set simulation = simulation - 'spins' where simulation ? 'spins';

-- Which rewards weigh time played, and which event each reward answers: no free spin.
CREATE OR REPLACE FUNCTION private.promo_is_eligible(p_terms jsonb, p_member jsonb, p_context jsonb)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.is_listed(e -> 'tiers', p_member ->> 'tierId')
     and case e ->> 'audience'
           when 'new_30d' then (p_member ->> 'daysSinceJoined')::integer < 30
           when 'lapsed' then coalesce((p_member ->> 'daysSinceLastVisit')::integer >= 30, false)
           -- Any audience the terms no longer have, such as women, matches nobody.
           when 'everyone' then true
           else false end
     and (p_terms #>> '{reward,kind}' in ('points_multiplier', 'hours_bonus')
          or (private.is_listed(e -> 'stakes', p_context ->> 'stake') and private.is_listed(e -> 'tableIds', p_context ->> 'tableId')
              and private.is_in_schedule(p_terms -> 'schedule', (p_context ->> 'at')::timestamptz)))
  from (select p_terms -> 'eligibility' as e) t;
$function$;

CREATE OR REPLACE FUNCTION private.promotion_event_kind(p_reward jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_reward ->> 'kind' = 'points_multiplier' then 'time_played'
    when p_reward ->> 'kind' = 'hours_bonus' then 'hours_step'
    when p_reward ->> 'kind' = 'seat_bonus' then 'seated'
    when p_reward ->> 'kind' = 'buyin_bonus' then 'buy_in'
    when p_reward ->> 'kind' = 'bonus_chips' then case p_reward ->> 'on' when 'first_buyin' then 'buy_in' else p_reward ->> 'on' end
    else 'visit' end;
$function$;

-- The old rules: a rule gives no spin, none converts to a free spin, and no template gives one.
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
         "properties": {"kind": {"const": "message"}, "text": {"type": "string", "minLength": 1, "maxLength": 500, "pattern": "\\S"}}}
      ]
    }', p_effect);
$function$;

CREATE OR REPLACE FUNCTION private.reward_from_rule(p_promotion promotion, p_rule promotion_rule)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select jsonb_strip_nulls(case
    when p_rule.trigger = 'hours_played' and e ->> 'kind' = 'points' and (e ->> 'multiplier_percent')::integer between 125 and 500
         and (e ->> 'multiplier_percent')::integer % 25 = 0 and not c ? 'min_hours'
      then jsonb_build_object('kind', 'points_multiplier', 'multiplier', (e ->> 'multiplier_percent')::numeric / 100)
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and (e ->> 'percent_bps')::integer % 100 = 0
      then jsonb_build_object('kind', 'buyin_bonus', 'mode', 'percent', 'percent', (e ->> 'percent_bps')::integer / 100,
                              'capChips', (e ->> 'cap_paise')::bigint / 100,
                              'firstNBuyinsPerTable', case when c #>> '{first_n,per}' = 'table' then (c #>> '{first_n,count}')::integer end)
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and e ? 'amount_paise' and p_promotion.per_player_period = 'promotion'
      then jsonb_build_object('kind', 'bonus_chips', 'chips', (e ->> 'amount_paise')::bigint / 100, 'on', 'first_buyin')
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and e ? 'amount_paise'
      then jsonb_build_object('kind', 'buyin_bonus', 'mode', 'fixed', 'chips', (e ->> 'amount_paise')::bigint / 100,
                              'firstNBuyinsPerTable', case when c #>> '{first_n,per}' = 'table' then (c #>> '{first_n,count}')::integer end)
    when p_rule.trigger = 'hours_played' and e ->> 'kind' = 'bonus' and e ? 'amount_paise' and c ? 'min_hours'
      then jsonb_build_object('kind', 'hours_bonus', 'chips', (e ->> 'amount_paise')::bigint / 100, 'afterMinutes', (c ->> 'min_hours')::integer * 60)
    when p_rule.trigger in ('referral', 'check_in') and e ->> 'kind' = 'bonus' and e ? 'amount_paise'
      then jsonb_build_object('kind', 'bonus_chips', 'chips', (e ->> 'amount_paise')::bigint / 100,
                              'on', case p_rule.trigger when 'referral' then 'referral' else 'visit' end)
    when p_rule.trigger = 'graduation' and e ->> 'kind' = 'freeroll_ticket'
      then jsonb_build_object('kind', 'tournament_entry', 'tournamentId', e ->> 'tournament')
  end)
  from (select p_rule.effect as e, p_rule.conditions as c) x
  -- Only the conditions the typed model has; first N per table only for a buy-in, where it is the reward's.
  where not exists (select 1 from jsonb_object_keys(p_rule.conditions) k
                    where k not in ('days', 'from', 'until', 'stakes', 'table_ids', 'tier_ids', 'first_n', 'min_hours'))
    and (not p_rule.conditions ? 'first_n' or p_rule.conditions #>> '{first_n,per}' = 'day' or p_rule.trigger = 'buy_in');
$function$;

CREATE OR REPLACE FUNCTION private.add_promotion_templates(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_graduate_tier uuid := (select t.id from public.tier t where t.venue_id = p_venue_id and t.name = 'Academy graduate');
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'tuesday_bonus', 'Buy-in bonus Tuesday', '20% on the first five buy-ins per table', 'Tuesday · all stakes', null, null),
    (p_venue_id, 'referral', 'Referral', '1,000 bonus chips to each side', 'Every day', null, null),
    (p_venue_id, 'graduate_first_buy_in', 'Graduate first buy-in', '1,000 bonus chips on an Academy graduate''s first buy-in', 'Every day', 1, 'promotion'),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'Front of every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus chips', '1,000 bonus chips after four hours at the tables', 'Every night', 1, 'day'),
    (p_venue_id, 'graduate_freeroll', 'Graduate freeroll', 'A RIVR Sunday freeroll entry when you graduate from the Academy', 'On graduation', 1, 'promotion')
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}'::jsonb,
     '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'::jsonb),
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('graduate_first_buy_in', 'buy_in', jsonb_build_object('tier_ids', jsonb_build_array(v_graduate_tier)),
     '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('hours_bonus', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}'::jsonb),
    ('graduate_freeroll', 'graduation', '{}'::jsonb, '{"kind": "freeroll_ticket", "tournament": "RIVR Sunday"}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where (r.template_key <> 'graduate_first_buy_in' or v_graduate_tier is not null)
    and not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
  perform private.version_promotions(p_venue_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.is_shareable_audit_row(p_entity text, p_before jsonb, p_after jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_entity in ('setting', 'tier', 'tier_feature', 'table_type', 'game_table', 'table_run', 'chip_denomination', 'blind_structure',
                      'tournament_template', 'tournament', 'promotion', 'promotion_rule', 'promotion_grant', 'bonus_grant', 'reward_item',
                      'league_season', 'fnb_item', 'sop', 'sop_version', 'site_block', 'site_page', 'site_revision', 'cage_shift',
                      'chip_inventory_count', 'chip_inventory_line', 'ledger_account', 'academy_batch', 'device', 'tablet_assignment',
                      'down_count', 'dealer_down', 'hand', 'high_hand_claim', 'jackpot_event', 'visit', 'waitlist_entry', 'credit_line',
                      'venue', 'alert')
     and not exists (
       select 1 from unnest(array[p_before, p_after]) r
       where coalesce(r ?| array['phone', 'full_name', 'address', 'signature_svg', 'buyer_name', 'buyer_gstin', 'pan', 'date_of_birth',
                                 'city', 'occupation', 'alert_whatsapp', 'bank_account_name', 'bank_account_number', 'bank_ifsc', 'upi_vpa',
                                 'upi_payee_name', 'staff_ip_allowlist', 'company_name', 'company_gstin', 'signatory_name'], false));
$function$;

-- The practice venue's seed keeps the new columns (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
