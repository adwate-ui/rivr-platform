-- The promotions engine (#83; scope-v1 module 7; lane D contract). A promotion has rules: each a
-- trigger (the event a lane passes in), conditions (who and when) and an effect (what it gives). Its
-- controls are its dates, whether it stacks, its priority, a per-player limit and a budget in rupees
-- and count. private.evaluate_promotions(venue, trigger, context) gives every live promotion whose
-- rule applies, as @rivr/domain promotions decides (promotionApplies, promotionReward,
-- promotionsToGive, proved equal on packages/testing/golden/promotions.json): a bonus is credited at
-- once through lane A's private.credit_bonus; every other effect is a grant its owner fulfils
-- (points #89, spin #150, the floor for a ticket, cab, prize or jackpot payout, messaging for a
-- message), each announced by promotion.granted. Promotions switched off, or the venue or member frozen:
-- nothing is given and the caller's own write goes on. Decision 0140.

-- A 24-hour IST time ("14:00") as minutes into the club's day, which begins at 06:00.
create function private.club_minute(p_time text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer - 360 + 1440) % 1440;
$$;

-- The shapes @rivr/contracts promotionConditionsSchema and promotionEffectSchema check. A definer,
-- because the builder's inserts run it and signed-in clients cannot call the JSON Schema extension.
create function private.is_promotion_rule(p_conditions jsonb, p_effect jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
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
        {"type": "object", "additionalProperties": false, "required": ["kind", "amount_paise", "expires_days"],
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
$$;

create table public.promotion (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(btrim(name)) between 3 and 80),
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  -- Whether it may be given with other promotions for the same event; one that does not is given alone.
  stacks boolean not null default true,
  -- The order the promotions for one event are weighed in, highest first.
  priority integer not null default 0 check (priority between 0 and 1000),
  -- How many a member may have, each club day or over the whole promotion; null is no limit.
  per_player_limit integer check (per_player_limit between 1 and 1000),
  per_player_period text check (per_player_period in ('day', 'promotion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  check (ends_at is null or ends_at > starts_at),
  check ((per_player_limit is null) = (per_player_period is null))
);

comment on table public.promotion is 'A promotion and its controls: dates, stacking, priority, per-player limit (#83).';

create table public.promotion_rule (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  promotion_id uuid not null,
  -- The first rule that applies, in this order, is the one given: royal flush before four of a kind.
  position integer not null default 1 check (position between 1 and 20),
  trigger text not null check (trigger in ('buy_in', 'hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in',
                                           'graduation', 'date_window')),
  conditions jsonb not null default '{}',
  effect jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promotion_id, position),
  unique (id, venue_id),
  foreign key (promotion_id, venue_id) references public.promotion (id, venue_id) on delete cascade,
  check (private.is_promotion_rule(conditions, effect))
);

comment on table public.promotion_rule is 'A promotion''s rule: the trigger, the conditions and the effect (#83).';

create table public.promotion_budget (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  promotion_id uuid not null unique,
  -- What the promotion may cost in rupees (bonus, prize value, jackpot payout) and how many grants; null is no cap.
  cap_paise bigint check (cap_paise > 0),
  cap_count integer check (cap_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (promotion_id, venue_id) references public.promotion (id, venue_id) on delete cascade
);

comment on table public.promotion_budget is 'A promotion''s budget in rupees and in count; what is spent is the sum of its grants (#83).';

create table public.promotion_grant (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  promotion_id uuid not null,
  promotion_rule_id uuid not null,
  member_id uuid not null,
  -- Where the member was, for first N per table.
  table_id uuid,
  trigger text not null,
  -- The effect as given: the rule may change later.
  effect jsonb not null,
  cost_paise bigint not null check (cost_paise >= 0),
  points bigint not null check (points >= 0),
  -- The event it was given for: one grant of a promotion per member and event.
  source_key text not null check (length(source_key) between 1 and 200),
  -- The club day (06:00 to 06:00 IST) it was given on.
  club_day date not null,
  bonus_grant_id uuid references public.bonus_grant (id),
  -- When its effect was carried out: at once for a bonus, by its consumer for the rest.
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promotion_id, member_id, source_key),
  foreign key (promotion_id, venue_id) references public.promotion (id, venue_id),
  foreign key (promotion_rule_id, venue_id) references public.promotion_rule (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id)
);

comment on table public.promotion_grant is 'What a promotion gave a member for one event (#83).';

create index promotion_venue_live_idx on public.promotion (venue_id, priority desc) where status = 'live';
create index promotion_rule_promotion_idx on public.promotion_rule (promotion_id, venue_id);
create index promotion_budget_promotion_idx on public.promotion_budget (promotion_id, venue_id);
create index promotion_grant_day_idx on public.promotion_grant (promotion_id, club_day, table_id);
create index promotion_grant_member_idx on public.promotion_grant (member_id, venue_id);
create index promotion_grant_promotion_venue_idx on public.promotion_grant (promotion_id, venue_id);
create index promotion_grant_rule_idx on public.promotion_grant (promotion_rule_id, venue_id);
create index promotion_grant_table_idx on public.promotion_grant (table_id, venue_id);
create index promotion_grant_bonus_idx on public.promotion_grant (bonus_grant_id);

create trigger promotion_touch_updated_at before update on public.promotion
  for each row execute function private.touch_updated_at();
create trigger promotion_audit after insert or update or delete on public.promotion
  for each row execute function private.audit_row_change();
create trigger promotion_rule_touch_updated_at before update on public.promotion_rule
  for each row execute function private.touch_updated_at();
create trigger promotion_rule_audit after insert or update or delete on public.promotion_rule
  for each row execute function private.audit_row_change();
create trigger promotion_budget_touch_updated_at before update on public.promotion_budget
  for each row execute function private.touch_updated_at();
create trigger promotion_budget_audit after insert or update or delete on public.promotion_budget
  for each row execute function private.audit_row_change();
create trigger promotion_grant_touch_updated_at before update on public.promotion_grant
  for each row execute function private.touch_updated_at();
create trigger promotion_grant_audit after insert or update on public.promotion_grant
  for each row execute function private.audit_row_change();

-- Staff who manage promotions (admins, marketing, super admins) see and shape their venue's; grants
-- only the engine writes. Members and other staff see none of it (cards reach Home through #86).
alter table public.promotion enable row level security;
alter table public.promotion_rule enable row level security;
alter table public.promotion_budget enable row level security;
alter table public.promotion_grant enable row level security;
grant select, insert on public.promotion, public.promotion_rule, public.promotion_budget to authenticated;
grant update (name, status, starts_at, ends_at, stacks, priority, per_player_limit, per_player_period) on public.promotion to authenticated;
grant update (position, trigger, conditions, effect) on public.promotion_rule to authenticated;
grant update (cap_paise, cap_count) on public.promotion_budget to authenticated;
grant delete on public.promotion_rule, public.promotion_budget to authenticated;
grant select on public.promotion_grant to authenticated;
grant execute on function private.is_promotion_rule(jsonb, jsonb) to authenticated;

create policy "promotion managers see the venue's promotions" on public.promotion
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers add promotions" on public.promotion
  for insert to authenticated with check (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers change promotions" on public.promotion
  for update to authenticated
  using (venue_id in (select private.venues_where('promotions.manage')))
  with check (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers see the venue's rules" on public.promotion_rule
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers add rules" on public.promotion_rule
  for insert to authenticated with check (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers change rules" on public.promotion_rule
  for update to authenticated
  using (venue_id in (select private.venues_where('promotions.manage')))
  with check (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers remove rules" on public.promotion_rule
  for delete to authenticated using (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers see the venue's budgets" on public.promotion_budget
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers set budgets" on public.promotion_budget
  for insert to authenticated with check (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers change budgets" on public.promotion_budget
  for update to authenticated
  using (venue_id in (select private.venues_where('promotions.manage')))
  with check (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers remove budgets" on public.promotion_budget
  for delete to authenticated using (venue_id in (select private.venues_where('promotions.manage')));
create policy "promotion managers see the venue's grants" on public.promotion_grant
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));

-- Lane C's private.visits_this_month as its contract has it ("closed visits in the calendar month"),
-- added here because the engine is the first to need it: visits closed this IST month by that moment.
create function private.visits_this_month(p_member_id uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.visit v
  where v.member_id = p_member_id and v.closed_at <= p_at
    and v.closed_at >= date_trunc('month', p_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
$$;

-- @rivr/domain promotionApplies in SQL, proved on the same golden file: every condition named holds.
-- A fact left out reads as unknown, none or no.
create function private.promotion_applies(p_conditions jsonb, p_facts jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (not p_conditions ? 'tier_ids' or coalesce(p_conditions -> 'tier_ids' ? (p_facts ->> 'tier_id'), false))
     and (not p_conditions ? 'stakes' or coalesce(p_conditions -> 'stakes' ? (p_facts ->> 'stake'), false))
     and (not p_conditions ? 'table_ids' or coalesce(p_conditions -> 'table_ids' ? (p_facts ->> 'table_id'), false))
     and (not p_conditions ? 'days' or p_conditions -> 'days' @> to_jsonb(extract(isodow from c.clock)::integer))
     and (not p_conditions ? 'from'
          or (c.minute >= private.club_minute(p_conditions ->> 'from')
              and c.minute < coalesce(nullif(private.club_minute(p_conditions ->> 'until'), 0), 1440)))
     and (not p_conditions ? 'first_n'
          or (p_conditions #>> '{first_n,per}' = 'day' and coalesce((p_facts ->> 'granted_today')::integer, 0) < (p_conditions #>> '{first_n,count}')::integer)
          or (p_conditions #>> '{first_n,per}' = 'table' and p_facts ->> 'table_id' is not null
              and coalesce((p_facts ->> 'granted_today_at_table')::integer, 0) < (p_conditions #>> '{first_n,count}')::integer))
     and (not p_conditions ? 'new_player' or (p_facts ->> 'days_since_last_visit') is null)
     and (not p_conditions ? 'lapsed_days'
          or coalesce((p_facts ->> 'days_since_last_visit')::integer >= (p_conditions ->> 'lapsed_days')::integer, false))
     and coalesce((p_facts ->> 'visits_in_month')::integer, 0) >= coalesce((p_conditions ->> 'min_visits_in_month')::integer, 0)
     and (not p_conditions ? 'call_time_complete' or coalesce((p_facts ->> 'call_time_complete')::boolean, false))
     and coalesce((p_facts ->> 'hours_played')::numeric, 0) >= coalesce((p_conditions ->> 'min_hours')::numeric, 0)
     and (not p_conditions ? 'hands' or coalesce(p_conditions -> 'hands' ? (p_facts ->> 'hand'), false))
  from (select (p_facts ->> 'at')::timestamptz at time zone 'Asia/Kolkata' - interval '6 hours' as clock) t
  cross join lateral (select t.clock, (extract(hour from t.clock) * 60 + extract(minute from t.clock))::integer as minute) c;
$$;

-- @rivr/domain promotionReward in SQL, proved on the same golden file: the rupee cost and points an
-- effect gives for this amount and these points earned; no row when a bonus or points come to nothing.
create function private.promotion_reward(p_effect jsonb, p_amount_paise bigint, p_points bigint)
returns table (cost_paise bigint, points bigint)
language sql
immutable
set search_path = ''
as $$
  select r.cost, r.points
  from (select case p_effect ->> 'kind'
                 when 'bonus' then coalesce((p_effect ->> 'amount_paise')::bigint,
                                            least(coalesce(p_amount_paise, 0) * (p_effect ->> 'percent_bps')::bigint / 10000 / 5000 * 5000,
                                                  coalesce((p_effect ->> 'cap_paise')::bigint, 9223372036854775807)))
                 when 'jackpot_payout' then (p_effect ->> 'amount_paise')::bigint
                 when 'physical_prize' then coalesce((p_effect ->> 'value_paise')::bigint, 0)
                 else 0 end as cost,
               case when p_effect ->> 'kind' = 'points'
                    then coalesce((p_effect ->> 'points')::bigint, coalesce(p_points, 0) * ((p_effect ->> 'multiplier_percent')::bigint - 100) / 100)
                    else 0 end as points) r
  where not (p_effect ->> 'kind' = 'bonus' and r.cost = 0) and not (p_effect ->> 'kind' = 'points' and r.points = 0);
$$;

-- @rivr/domain promotionsToGive in SQL, proved on the same golden file: of the candidates for one
-- event, in priority order, the promotions to give now.
create function private.promotions_to_give(p_candidates jsonb)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_given jsonb := coalesce((select jsonb_agg(c) from jsonb_array_elements(p_candidates) c where (c ->> 'is_given')::boolean), '[]'::jsonb);
  v_candidate jsonb;
  v_chosen text[] := '{}'::text[];
begin
  for v_candidate in select e.c from jsonb_array_elements(p_candidates) with ordinality as e (c, n) order by e.n loop
    exit when exists (select 1 from jsonb_array_elements(v_given) g where not (g ->> 'stacks')::boolean);
    continue when coalesce((v_candidate ->> 'is_given')::boolean, false)
      or (not (v_candidate ->> 'stacks')::boolean and jsonb_array_length(v_given) > 0)
      or coalesce((v_candidate ->> 'grants_left')::integer, 1) <= 0
      or coalesce((v_candidate ->> 'player_left')::integer, 1) <= 0
      or (v_candidate ->> 'cost_paise')::bigint > coalesce((v_candidate ->> 'budget_left_paise')::bigint, (v_candidate ->> 'cost_paise')::bigint);
    v_given := v_given || jsonb_build_array(v_candidate);
    v_chosen := v_chosen || (v_candidate ->> 'promotion');
  end loop;
  return v_chosen;
end;
$$;

-- What the engine knows about a member at a moment: tier, table and its stake, visits this month,
-- days since the last visit before this one (null for a new player), call time, and the club day.
create function private.promotion_facts(p_member_id uuid, p_table_id uuid, p_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'at', p_at,
    'club_day', (private.tonight_began(p_at) at time zone 'Asia/Kolkata')::date,
    'tier_id', m.tier_id,
    'stake', (select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = p_table_id),
    'table_id', p_table_id,
    'visits_in_month', private.visits_this_month(p_member_id, p_at),
    'days_since_last_visit', (select floor(extract(epoch from p_at - max(v.opened_at)) / 86400)::integer from public.visit v
                              where v.member_id = p_member_id and v.opened_at <= p_at and v.id is distinct from private.current_visit(p_member_id)),
    'call_time_complete', coalesce((select o.o_seconds = 0 from private.call_time_owed(p_member_id, p_at) o), false))
  from public.member m where m.id = p_member_id;
$$;

-- One live promotion weighed for an event: the first of its rules for the trigger that applies, its
-- reward, and what its budget and per-player limit leave; or, if it was already given for the event,
-- that. Null when no rule applies or the reward is nothing. A share is of the member's own money: a
-- buy-in paid from bonus earns none (question #392). The rule's effect travels with the candidate, so
-- what is given is what was weighed.
create function private.promotion_candidate(p_promotion public.promotion, p_trigger text, p_facts jsonb, p_context jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_day date := (p_facts ->> 'club_day')::date;
  v_given public.promotion_grant;
  v_rule public.promotion_rule;
  v_reward record;
  v_budget public.promotion_budget;
begin
  select * into v_given from public.promotion_grant g
  where g.promotion_id = p_promotion.id and g.member_id = v_member_id and g.source_key = p_context ->> 'key';
  if v_given.id is not null then
    return jsonb_build_object('promotion', p_promotion.id, 'stacks', p_promotion.stacks, 'cost_paise', v_given.cost_paise, 'is_given', true);
  end if;
  select * into v_rule from public.promotion_rule r
  where r.promotion_id = p_promotion.id and r.trigger = p_trigger
    and private.promotion_applies(r.conditions, p_facts || jsonb_build_object(
      'granted_today', (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id and g.club_day = v_day),
      'granted_today_at_table', (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id and g.club_day = v_day
                                 and g.table_id = (p_facts ->> 'table_id')::uuid)))
  order by r.position limit 1;
  if v_rule.id is null then
    return null;
  end if;
  select * into v_reward from private.promotion_reward(v_rule.effect,
    case when p_context ->> 'method' = 'bonus' then 0 else (p_context ->> 'amount_paise')::bigint end, (p_context ->> 'points')::bigint);
  if not found then
    return null;
  end if;
  select * into v_budget from public.promotion_budget b where b.promotion_id = p_promotion.id;
  return jsonb_build_object('promotion', p_promotion.id, 'name', p_promotion.name, 'venue_id', p_promotion.venue_id, 'rule', v_rule.id,
    'trigger', v_rule.trigger, 'effect', v_rule.effect, 'stacks', p_promotion.stacks, 'cost_paise', v_reward.cost_paise, 'points', v_reward.points,
    'budget_left_paise', v_budget.cap_paise - (select coalesce(sum(g.cost_paise), 0) from public.promotion_grant g where g.promotion_id = p_promotion.id),
    'grants_left', v_budget.cap_count - (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id),
    'player_left', p_promotion.per_player_limit - (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id
                                                   and g.member_id = v_member_id and (p_promotion.per_player_period = 'promotion' or g.club_day = v_day)));
end;
$$;

-- Gives one promotion to the member for the event: the grant, a bonus credited at once, and
-- promotion.granted for the consumers of everything else.
create function private.give_promotion(p_candidate jsonb, p_facts jsonb, p_context jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (p_candidate ->> 'venue_id')::uuid;
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_effect jsonb := p_candidate -> 'effect';
  v_id uuid;
begin
  insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, table_id, trigger, effect, cost_paise, points,
                                      source_key, club_day)
  values (v_venue_id, (p_candidate ->> 'promotion')::uuid, (p_candidate ->> 'rule')::uuid, v_member_id, (p_facts ->> 'table_id')::uuid,
          p_candidate ->> 'trigger', v_effect, (p_candidate ->> 'cost_paise')::bigint, (p_candidate ->> 'points')::bigint, p_context ->> 'key',
          (p_facts ->> 'club_day')::date)
  returning id into v_id;
  if v_effect ->> 'kind' = 'bonus' then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_venue_id, v_member_id, (p_candidate ->> 'cost_paise')::bigint, p_candidate ->> 'name',
                                              now() + make_interval(days => (v_effect ->> 'expires_days')::integer), 'promotion:' || v_id)
    where id = v_id;
  end if;
  perform private.emit(v_venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', p_candidate ->> 'promotion', 'member_id', v_member_id,
                                          'effect', v_effect, 'cost_paise', (p_candidate ->> 'cost_paise')::bigint,
                                          'points', (p_candidate ->> 'points')::bigint),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$$;

-- Gives every live promotion whose rule for this trigger applies (lane D contract), for the event
-- the context names. Always member_id and key (the event, such as 'buy_in:' and the cage transaction);
-- where they apply table_id, amount_paise with its method (a buy-in or an entry: cash, upi, wallet or bonus),
-- points (earned: hours played), hours_played (this visit) and hand (hand logged: four_of_a_kind,
-- straight_flush, royal_flush or bad_beat). Returns the grants given now; a replay of the event gives
-- nothing more. The promotions are locked in priority order, so two cashiers never both take the last
-- of a budget. For lanes' server functions; never called by an app.
create function private.evaluate_promotions(p_venue_id uuid, p_trigger text, p_context jsonb)
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
                                                  'graduation', 'date_window'])
     or length(coalesce(p_context ->> 'key', '')) not between 1 and 200 or coalesce((p_context ->> 'amount_paise')::bigint, 0) < 0
     or coalesce((p_context ->> 'points')::bigint, 0) < 0 or coalesce((p_context ->> 'hours_played')::numeric, 0) < 0
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
end;
$$;

-- Every minute while a date-window rule is live at a venue: everyone in the club then is weighed for
-- it, once a club day (the event's key is the day).
create function private.open_promotion_windows()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit record;
begin
  for v_visit in
    select v.venue_id, v.member_id,
           (select s.table_id from public.seat_session s where s.member_id = v.member_id and s.ended_at is null) as table_id
    from public.visit v
    where v.closed_at is null
      and exists (select 1 from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
                  where p.venue_id = v.venue_id and p.status = 'live' and r.trigger = 'date_window'
                    and p.starts_at <= now() and (p.ends_at is null or p.ends_at > now()))
  loop
    perform private.evaluate_promotions(v_visit.venue_id, 'date_window',
      jsonb_build_object('member_id', v_visit.member_id, 'table_id', v_visit.table_id,
                         'key', 'date_window:' || (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date));
  end loop;
end;
$$;

select cron.schedule('promotion-windows', '* * * * *', 'select private.open_promotion_windows()');

revoke execute on function private.visits_this_month(uuid, timestamptz), private.promotion_applies(jsonb, jsonb), private.club_minute(text),
  private.promotion_reward(jsonb, bigint, bigint), private.promotions_to_give(jsonb), private.promotion_facts(uuid, uuid, timestamptz),
  private.promotion_candidate(public.promotion, text, jsonb, jsonb), private.give_promotion(jsonb, jsonb, jsonb),
  private.evaluate_promotions(uuid, text, jsonb), private.open_promotion_windows() from public, anon, authenticated;
grant execute on function private.evaluate_promotions(uuid, text, jsonb), private.visits_this_month(uuid, timestamptz) to service_role;
