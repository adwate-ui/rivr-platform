-- Promotions in versions (console v3 phase 7; decisions 0470 to 0472, 0491). A promotion keeps its row; what it gives,
-- to whom, when, how often and where it shows now live in its versions, typed as @rivr/contracts promotionModel has
-- them. A version is drafted, submitted, approved by another person and run; editing a running one drafts the next,
-- and the running one goes on until that is approved. `promotion` keeps a copy of its current version's words and
-- status, so every reader of a promotion's card keeps working. Grants record their version and the period they count
-- in, unique per promotion and member, so a member's limit holds in the database across versions.

-- A calendar day written as ISO, '2026-11-17', and a real one.
create function private.is_iso_day(p_day text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and to_char(p_day::date, 'YYYY-MM-DD') = p_day;
exception when others then
  return false;
end;
$$;

-- The shapes @rivr/contracts rewardSchema, eligibilitySchema, scheduleSchema, limitsSchema and channelsSchema check. A
-- definer, as private.is_promotion_rule is, because the JSON Schema extension is not the caller's.
create function private.is_promotion_terms(p_reward jsonb, p_eligibility jsonb, p_schedule jsonb, p_limits jsonb, p_channels jsonb)
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
        "audience": {"enum": ["everyone", "new_30d", "lapsed", "women"]}
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

-- What a simulation stored on a version holds (@rivr/contracts promotionSimulationSchema).
create function private.is_promotion_simulation(p_simulation jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select extensions.jsonb_matches_schema('{
    "type": "object", "additionalProperties": false,
    "required": ["events", "membersQualified", "timesGiven", "points", "chips", "spins", "perks", "isBudgetReached"],
    "properties": {
      "events": {"type": "integer", "minimum": 0}, "membersQualified": {"type": "integer", "minimum": 0},
      "timesGiven": {"type": "integer", "minimum": 0}, "points": {"type": "integer", "minimum": 0}, "chips": {"type": "integer", "minimum": 0},
      "spins": {"type": "integer", "minimum": 0}, "perks": {"type": "integer", "minimum": 0}, "isBudgetReached": {"type": "boolean"}
    }
  }', p_simulation);
$$;

create table public.promotion_version (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  promotion_id uuid not null,
  version integer not null check (version between 1 and 10000),
  status text not null default 'draft' check (status in ('draft', 'awaiting_approval', 'scheduled', 'live', 'paused', 'ended')),
  name text not null check (length(btrim(name)) between 3 and 80),
  reward jsonb not null,
  eligibility jsonb not null,
  schedule jsonb not null,
  limits jsonb not null,
  channels jsonb not null,
  -- The rules on the website, one a line (decision 0283), and the card's link (#776).
  rules_text text[] not null default '{}' check (private.is_promotion_rules(rules_text)),
  link text check (link ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][!-~]*)?$' and length(link) <= 500),
  -- The card's words, from describePromotion: what it gives, and who and when.
  detail text check (detail is null or length(btrim(detail)) between 1 and 200),
  runs text check (runs is null or length(btrim(runs)) between 1 and 120),
  -- Who last changed the draft, who submitted it (its author, decision 0471) and who approved or rejected it.
  edited_by_staff_id uuid references public.staff (id),
  author_staff_id uuid references public.staff (id),
  submitted_at timestamptz,
  decided_by_staff_id uuid references public.staff (id),
  decided_at timestamptz,
  rejected_reason text check (rejected_reason is null or length(btrim(rejected_reason)) between 3 and 300),
  -- Last week replayed on these terms (simulated_terms), which submitting requires to be the version's own.
  simulation jsonb check (simulation is null or private.is_promotion_simulation(simulation)),
  simulated_terms jsonb,
  simulated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promotion_id, version),
  unique (id, venue_id),
  foreign key (promotion_id, venue_id) references public.promotion (id, venue_id) on delete cascade,
  check (private.is_promotion_terms(reward, eligibility, schedule, limits, channels)),
  -- Versions converted from rules that went live before approval existed have no author; a waiting one always has.
  check (status <> 'awaiting_approval' or (author_staff_id is not null and submitted_at is not null)),
  check ((simulation is null) = (simulated_terms is null))
);

comment on table public.promotion_version is 'A version of a promotion: its typed reward, who, when, limits and channels, and its approval (console v3 phase 7).';

-- At most one draft or awaiting version, and one running version, a promotion.
create unique index promotion_version_one_open on public.promotion_version (promotion_id) where status in ('draft', 'awaiting_approval');
create unique index promotion_version_one_running on public.promotion_version (promotion_id) where status in ('scheduled', 'live', 'paused');
create index promotion_version_venue_status_idx on public.promotion_version (venue_id, status);
create index promotion_version_promotion_venue_idx on public.promotion_version (promotion_id, venue_id);
create index promotion_version_edited_by_idx on public.promotion_version (edited_by_staff_id);
create index promotion_version_author_idx on public.promotion_version (author_staff_id);
create index promotion_version_decided_by_idx on public.promotion_version (decided_by_staff_id);

create trigger promotion_version_touch_updated_at before update on public.promotion_version
  for each row execute function private.touch_updated_at();
create trigger promotion_version_audit after insert or update or delete on public.promotion_version
  for each row execute function private.audit_row_change();

-- Staff who manage promotions read their venue's versions; only the version functions write them.
alter table public.promotion_version enable row level security;
grant select on public.promotion_version to authenticated;
create policy "promotion managers see the venue's versions" on public.promotion_version
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));

-- The promotion's current version: the one running, or the last that ran; null until one is approved.
alter table public.promotion
  add column current_version integer check (current_version between 1 and 10000),
  drop constraint promotion_status_check,
  add constraint promotion_status_check check (status in ('draft', 'pending', 'scheduled', 'live', 'paused', 'ended'));

-- A grant's version, the period it counts in (decision 0471), and what it gave in chips, spins or a perk; a rule's grant
-- (before versions) has its rule instead. Spins are taken one at a time at the wheel.
alter table public.promotion_grant
  add column promotion_version_id uuid,
  add column period_key text check (period_key is null or length(period_key) between 1 and 220),
  add column chips bigint not null default 0 check (chips >= 0),
  add column spins integer not null default 0 check (spins >= 0),
  add column spins_used integer not null default 0 check (spins_used >= 0),
  add column perk text check (perk in ('cab_home', 'tournament_entry', 'waitlist_priority')),
  alter column promotion_rule_id drop not null,
  add constraint promotion_grant_rule_or_version check ((promotion_rule_id is null) <> (promotion_version_id is null)),
  add constraint promotion_grant_version_fkey foreign key (promotion_version_id, venue_id) references public.promotion_version (id, venue_id);
create unique index promotion_grant_period_key on public.promotion_grant (promotion_id, member_id, period_key) where period_key is not null;
create index promotion_grant_version_idx on public.promotion_grant (promotion_version_id, venue_id);

-- What a rule's grants gave, in the new terms: a bonus's chips, a spin.
update public.promotion_grant set chips = cost_paise / 100 where effect ->> 'kind' = 'bonus';
update public.promotion_grant set spins = 1, spins_used = case when fulfilled_at is null then 0 else 1 end where effect ->> 'kind' = 'spin';

-- A member's export holds their grants' new columns too (decision 0240).
insert into private.member_export_column (table_name, column_name, kind) values
  ('promotion_grant', 'promotion_version_id', 'owed'), ('promotion_grant', 'period_key', 'owed'), ('promotion_grant', 'chips', 'owed'),
  ('promotion_grant', 'spins', 'owed'), ('promotion_grant', 'spins_used', 'owed'), ('promotion_grant', 'perk', 'owed');

revoke execute on function private.is_iso_day(text), private.is_promotion_terms(jsonb, jsonb, jsonb, jsonb, jsonb),
  private.is_promotion_simulation(jsonb) from public, anon;
grant execute on function private.is_iso_day(text), private.is_promotion_terms(jsonb, jsonb, jsonb, jsonb, jsonb),
  private.is_promotion_simulation(jsonb) to authenticated;
