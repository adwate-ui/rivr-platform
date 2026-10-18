-- Effective-dated settings: rules that change without a release, where a transaction uses the
-- row in force at its own timestamp (.claude/rules/money.md). Rows are never edited; a change is a
-- new row from a future time, so hands logged before the change keep the old rule.
-- setting_key mirrors packages/contracts/src/settings.ts, including each value's JSON Schema.

create extension if not exists pg_jsonschema with schema extensions;

create type public.setting_scope as enum ('venue', 'table_type', 'stake', 'tier', 'role');

create table public.setting_key (
  key text primary key check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  description text not null,
  scope public.setting_scope not null,
  value_schema jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.setting_key is
  'Global catalogue declared in code (packages/contracts/src/settings.ts), so it has no venue_id. Changed only by migrations.';

create trigger setting_key_touch_updated_at before update on public.setting_key
  for each row execute function private.touch_updated_at();

insert into public.setting_key (key, description, scope, value_schema) values
  ('call_time.minutes',
   'Minutes a player must play after being seated before leaving, per table type (features, "Call time").',
   'table_type',
   '{"type":"object","properties":{"minutes":{"type":"integer","minimum":0,"maximum":1440}},"required":["minutes"],"additionalProperties":false}'),
  ('tier.default',
   'The tier every new member starts in (additions, "Tier-gated features").',
   'venue',
   '{"type":"object","properties":{"tier_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["tier_id"],"additionalProperties":false}');

create table public.setting (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  key text not null references public.setting_key (key),
  -- What the rule applies to: a table type code, a stake ('100/200'), a tier id or a role.
  -- Empty for venue-wide settings.
  subject text not null default '',
  value jsonb not null,
  effective_from timestamptz not null,
  reason text,
  created_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, key, subject, effective_from)
);

create index setting_lookup_idx on public.setting (venue_id, key, subject, effective_from desc);
create index setting_key_idx on public.setting (key);
create index setting_created_by_idx on public.setting (created_by_staff_id);

-- A value must match its key's schema; a venue-wide key has no subject; and nobody signed in may
-- backdate a rule (only migrations, seed and the venue bootstrap run without a signed-in user).
create function private.check_setting()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  definition public.setting_key;
begin
  select * into definition from public.setting_key k where k.key = new.key;
  if not extensions.jsonb_matches_schema(definition.value_schema::json, new.value) then
    raise exception 'value for % does not match its schema', new.key using errcode = 'check_violation';
  end if;
  if (definition.scope = 'venue') <> (new.subject = '') then
    raise exception 'subject for % must be % ', new.key,
      case when definition.scope = 'venue' then 'empty' else 'set' end using errcode = 'check_violation';
  end if;
  if (select auth.uid()) is not null and new.effective_from < now() - interval '1 minute' then
    raise exception 'settings cannot take effect in the past' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger setting_check before insert on public.setting
  for each row execute function private.check_setting();
create trigger setting_immutable before update on public.setting
  for each row execute function private.refuse_change();
create trigger setting_audit after insert or update or delete on public.setting
  for each row execute function private.audit_row_change();

-- The value in force for a key at a moment: the newest row whose effective_from is not after it.
create function private.setting_at(p_venue_id uuid, p_key text, p_subject text, p_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.value from public.setting s
  where s.venue_id = p_venue_id and s.key = p_key and s.subject = coalesce(p_subject, '') and s.effective_from <= p_at
  order by s.effective_from desc
  limit 1;
$$;

grant execute on function private.setting_at(uuid, text, text, timestamptz) to authenticated, service_role;

-- New members start in the venue's default tier unless a tier is given.
create function private.default_member_tier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tier_id is null then
    new.tier_id := (private.setting_at(new.venue_id, 'tier.default', '', now()) ->> 'tier_id')::uuid;
  end if;
  if new.tier_id is null then
    raise exception 'venue % has no default tier', new.venue_id using errcode = 'not_null_violation';
  end if;
  return new;
end;
$$;

create trigger member_default_tier before insert on public.member
  for each row execute function private.default_member_tier();

alter table public.setting_key enable row level security;
alter table public.setting enable row level security;
grant select on public.setting_key to authenticated;
grant select, insert, delete on public.setting to authenticated;

create policy "staff read the setting catalogue" on public.setting_key
  for select to authenticated
  using (exists (select 1 from private.staff_venues()));

create policy "staff read their venue's settings" on public.setting
  for select to authenticated
  using (venue_id in (select private.staff_venues()));

create policy "setting managers add settings" on public.setting
  for insert to authenticated
  with check (venue_id in (select private.venues_where('settings.manage')));

create policy "setting managers withdraw settings not yet in force" on public.setting
  for delete to authenticated
  using (venue_id in (select private.venues_where('settings.manage')) and effective_from > now());
