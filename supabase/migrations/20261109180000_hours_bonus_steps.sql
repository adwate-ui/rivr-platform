-- Play-time bonus paid as each step is reached (the owner, 8 Nov): "promotions that give bonus chips based on playing
-- times are flexible enough to set rewards at defined intervals". A reward is its one step after a time, two to six set
-- steps (rising), or chips every so many minutes up to its times a visit (never past 24 hours). Each step reached, in
-- minutes played inside the version's schedule at its stakes and tables (seated, less time away), pays that step's
-- chips while the member is still seated: a sweep each minute weighs open visits, and a visit's close pays any step it
-- reached by then. A step is its own event (hours_step, keyed 'hours_step:' visit ':' minutes) and its own period for
-- the member limit (the period '@' its minutes), so the limit holds for each step. Live hours versions, which paid one
-- step at close, now pay it as reached. @rivr/domain hourSteps, stepsReached, computeGrant and periodKey are the twins,
-- proved equal on promotionRewards.json (024).

-- @rivr/domain hourSteps: a play-time bonus's steps, earliest first.
create function private.promo_hours_steps(p_reward jsonb)
returns table (o_after_minutes integer, o_chips bigint)
language sql
immutable
set search_path = ''
as $$
  select * from (
    select (p_reward ->> 'afterMinutes')::integer, (p_reward ->> 'chips')::bigint where not p_reward ? 'mode'
    union all
    select (s ->> 'afterMinutes')::integer, (s ->> 'chips')::bigint
    from jsonb_array_elements(case when p_reward ->> 'mode' = 'steps' then p_reward -> 'steps' else '[]'::jsonb end) s
    union all
    select n * (p_reward ->> 'everyMinutes')::integer, (p_reward ->> 'chips')::bigint
    from generate_series(1, case when p_reward ->> 'mode' = 'every'
                                 then least(coalesce((p_reward ->> 'timesPerVisit')::integer, 1440), 1440 / (p_reward ->> 'everyMinutes')::integer)
                                 else 0 end) n
  ) steps (o_after_minutes, o_chips)
  order by 1;
$$;

-- Whether set steps are each later than the one before; false for anything that is not a list of steps.
create function private.is_rising_steps(p_steps jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  return jsonb_typeof(p_steps) = 'array' and not exists (
    select 1 from jsonb_array_elements(p_steps) with ordinality a (s, n)
    join jsonb_array_elements(p_steps) with ordinality b (s, n) on b.n = a.n + 1
    where (b.s ->> 'afterMinutes')::integer <= (a.s ->> 'afterMinutes')::integer);
exception when others then
  return false;
end;
$$;

-- @rivr/domain triggerOf: a play-time bonus is weighed on each step reached.
create or replace function private.promotion_event_kind(p_reward jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_reward ->> 'kind' in ('points_multiplier', 'free_spin') then 'time_played'
    when p_reward ->> 'kind' = 'hours_bonus' then 'hours_step'
    when p_reward ->> 'kind' = 'buyin_bonus' then 'buy_in'
    when p_reward ->> 'kind' = 'bonus_chips' then case p_reward ->> 'on' when 'first_buyin' then 'buy_in' else p_reward ->> 'on' end
    else 'visit' end;
$$;

-- @rivr/domain periodKey, a play-time bonus step in a period of its own: the period '@' its minutes.
drop function private.promo_period_key(jsonb, text, timestamptz, uuid);
create function private.promo_period_key(p_limits jsonb, p_key text, p_at timestamptz, p_visit_id uuid, p_step_minutes integer default null)
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
    else 'event:' || p_key end || coalesce('@' || p_step_minutes, '');
$$;

-- The seconds a visit was played inside a version's schedule at its stakes and tables, up to `p_at` while it is open,
-- or to its close: as private.visit_schedule_time counts a closed one, and time away still under way not played.
create function private.visit_schedule_time_at(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb, p_at timestamptz)
returns table (o_seconds bigint, o_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with visit_end as (
    select v.id, least(coalesce(v.closed_at, p_at), p_at) as ended_at from public.visit v where v.id = p_visit_id
  ),
  stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_schedule(p_schedule, t.o_from, least(t.o_to, e.ended_at)) as seconds,
           floor(extract(epoch from (least(coalesce(s.ended_at, e.ended_at), e.ended_at) - s.started_at)))::bigint as wall,
           s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                 then greatest(0, floor(extract(epoch from (e.ended_at - s.away_since))))::bigint else 0 end as away_seconds
    from visit_end e
    join public.seat_session s on s.visit_id = e.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < e.ended_at
  ),
  rated as (
    select st.*, coalesce((private.setting_at(st.venue_id, 'points.per_hour', tt.code, st.o_from) ->> 'points')::integer, 0) as rate
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where private.is_listed(p_eligibility -> 'stakes', tt.code) and private.is_listed(p_eligibility -> 'tableIds', st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds, r.rate
    from rated r
    group by r.session_id, r.table_id, r.rate, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint, coalesce(sum(private.points_for_time(p.seconds, p.rate)), 0)::bigint from played p;
$$;

-- As 20261108020000 made it, with a play-time bonus's set steps and every so often.
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
$$;

-- @rivr/domain computeGrant, as 20261107110000 made it: a play-time bonus pays a step's chips on its own event.
create or replace function private.promo_grant(p_reward jsonb, p_event jsonb)
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
$$;

-- As 20261107120000 made it, with a step reached.
create or replace function private.promotion_event(p_kind text, p_version public.promotion_version, p_context jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

-- As 20261107120000 made it, with the step trigger and its minutes.
create or replace function private.evaluate_promotions(p_venue_id uuid, p_trigger text, p_context jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_table_id uuid := (p_context ->> 'table_id')::uuid;
  v_facts jsonb;
  v_promotion public.promotion;
  v_candidate jsonb;
  v_candidates jsonb := '[]'::jsonb;
begin
  if p_trigger is null or p_trigger <> all (array['buy_in', 'hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in',
                                                  'graduation', 'date_window', 'signup', 'hours_step'])
     or length(coalesce(p_context ->> 'key', '')) not between 1 and 200 or coalesce((p_context ->> 'amount_paise')::bigint, 0) < 0
     or coalesce((p_context ->> 'points')::bigint, 0) < 0 or coalesce((p_context ->> 'hours_played')::numeric, 0) < 0
     or (p_trigger = 'hours_step') <> (p_context ? 'step_minutes')
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
$$;

-- As 20261108020000 made it, a step weighed as its own event and period.
create or replace function private.evaluate_promotion_versions(p_venue_id uuid, p_trigger text, p_context jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := case p_trigger when 'buy_in' then 'buy_in' when 'hours_played' then 'time_played' when 'check_in' then 'visit'
                                when 'referral' then 'referral' when 'signup' then 'signup' when 'hours_step' then 'hours_step' end;
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
    continue when p_trigger = 'hours_step' and exists (select 1 from public.promotion_grant g where g.promotion_id = v_version.promotion_id
                                                         and g.member_id = v_member_id and g.source_key = p_context ->> 'key');
    v_event := private.promotion_event(v_kind, v_version, p_context);
    continue when not private.promo_is_eligible(
      jsonb_build_object('reward', v_version.reward, 'eligibility', v_version.eligibility, 'schedule', v_version.schedule), v_member, v_event);
    select * into v_grant from private.promo_grant(v_version.reward, v_event);
    continue when v_grant.o_refusal is not null;
    -- The member's grants in the period count against up to N times; the next is keyed as theirs in it (decision 0499).
    v_base := private.promo_period_key(v_version.limits, p_context ->> 'key', now(), (v_event ->> 'visitId')::uuid,
                                       (v_event ->> 'stepMinutes')::integer);
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

-- Weighs every play-time bonus step a visit has reached by `p_at` and not yet been given, earliest first: each is one
-- event for the engine, which gives it under each live version's limits and budget (and nothing while the venue is
-- frozen, promotions are off or the member is frozen). The grant names the table the member sits at, else their last.
create function private.weigh_hours_steps(p_visit_id uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_table uuid;
  v_step integer;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id;
  if v_visit.id is null then
    return;
  end if;
  v_table := (select s.table_id from public.seat_session s where s.visit_id = p_visit_id
              order by s.ended_at is null desc, s.started_at desc limit 1);
  for v_step in
    select distinct s.o_after_minutes
    from public.promotion_version pv
    cross join lateral private.visit_schedule_time_at(p_visit_id, pv.schedule, pv.eligibility, p_at) t
    cross join lateral private.promo_hours_steps(pv.reward) s
    where pv.venue_id = v_visit.venue_id and pv.status = 'live' and pv.reward ->> 'kind' = 'hours_bonus' and s.o_after_minutes <= t.o_seconds / 60
      and not exists (select 1 from public.promotion_grant g where g.promotion_id = pv.promotion_id and g.member_id = v_visit.member_id
                        and g.source_key = 'hours_step:' || p_visit_id || ':' || s.o_after_minutes)
    order by 1
  loop
    perform private.evaluate_promotions(v_visit.venue_id, 'hours_step', jsonb_build_object(
      'member_id', v_visit.member_id, 'table_id', v_table, 'visit_id', p_visit_id,
      'key', 'hours_step:' || p_visit_id || ':' || v_step, 'step_minutes', v_step, 'at', p_at));
  end loop;
end;
$$;

-- Each minute, every open visit with the member seated now, at a venue with a live play-time bonus, is weighed for the
-- steps it has reached: paid while seated, and a visit left open from an earlier night is not. One visit that cannot be
-- weighed never stops the others; it is logged.
create function private.sweep_hours_bonus()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit uuid;
begin
  for v_visit in
    select v.id from public.visit v
    where v.closed_at is null
      and exists (select 1 from public.seat_session s where s.visit_id = v.id and s.ended_at is null)
      and exists (select 1 from public.promotion_version pv where pv.venue_id = v.venue_id and pv.status = 'live'
                    and pv.reward ->> 'kind' = 'hours_bonus')
    order by v.opened_at
  loop
    begin
      perform private.weigh_hours_steps(v_visit, now());
    exception when others then
      raise warning 'hours-bonus: visit % not weighed: %', v_visit, sqlerrm;
    end;
  end loop;
end;
$$;

select cron.schedule('hours-bonus', '* * * * *', 'select private.sweep_hours_bonus()');

revoke execute on function private.promo_hours_steps(jsonb), private.is_rising_steps(jsonb),
  private.promo_period_key(jsonb, text, timestamptz, uuid, integer), private.visit_schedule_time_at(uuid, jsonb, jsonb, timestamptz),
  private.weigh_hours_steps(uuid, timestamptz), private.sweep_hours_bonus() from public, anon, authenticated;

-- As 20261026210000 made it, with the steps reached by the close paid first.
create or replace function private.weigh_hours_played(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_hours record;
  v_table uuid;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id;
  if v_visit.closed_at is not null then
    perform private.weigh_hours_steps(p_visit_id, v_visit.closed_at);
  end if;
  select * into v_hours from private.visit_hours(p_visit_id);
  if v_visit.closed_at is null or v_hours.o_played <= 0 then return; end if;
  select e.table_id into v_table from public.points_earning e where e.visit_id = p_visit_id and e.basis = 'hours'
  group by e.table_id order by sum(e.played_seconds) desc, e.table_id limit 1;
  perform private.evaluate_promotions(v_visit.venue_id, 'hours_played', jsonb_build_object(
    'member_id', v_visit.member_id, 'table_id', v_table, 'key', 'hours_played:' || p_visit_id, 'visit_id', p_visit_id,
    'hours_played', trunc(v_hours.o_played / 3600.0, 2), 'points', v_hours.o_points));
end;
$$;

-- As 20261107160000 made it, with a play-time bonus's visits.
create or replace function private.replay_version_events(p_version public.promotion_version, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

-- Grants made before steps count against their step: each one-step play-time bonus grant's period gets '@' its minutes,
-- so a member paid once ever, today or this week under the old key is not paid again under the new (money audit, 8 Nov).
update public.promotion_grant g
set period_key = regexp_replace(g.period_key, '^([^#@]*)(#[0-9]+)?$', '\1@' || (v.reward ->> 'afterMinutes') || '\2')
from public.promotion_version v
where v.id = g.promotion_version_id and v.reward ->> 'kind' = 'hours_bonus' and v.reward ? 'afterMinutes'
  and g.period_key is not null and position('@' in g.period_key) = 0;
