-- Tiers and members. Admins create, rename, order and retire tiers; every member has exactly one
-- (additions, "Tier-gated features"). A black-card member's qualifying stake is stored as blinds.

create table public.tier (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(trim(name)) > 0),
  -- Display order; higher is more senior.
  rank integer not null check (rank > 0),
  is_retired boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, name),
  unique (venue_id, rank) deferrable initially deferred,
  -- Lets other tables require that a tier belongs to the same venue as the row.
  unique (id, venue_id)
);

create trigger tier_touch_updated_at before update on public.tier
  for each row execute function private.touch_updated_at();
create trigger tier_audit after insert or update or delete on public.tier
  for each row execute function private.audit_row_change();

create table public.member (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  user_id uuid unique references auth.users (id) on delete set null,
  member_number bigint generated always as identity unique,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  tier_id uuid not null,
  -- The stake a black card qualifies at, as blinds in paise (100/200 is 10000 and 20000).
  qualifying_small_blind bigint check (qualifying_small_blind > 0),
  qualifying_big_blind bigint check (qualifying_big_blind > qualifying_small_blind),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'hi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, phone),
  unique (id, venue_id),
  foreign key (tier_id, venue_id) references public.tier (id, venue_id),
  check ((qualifying_small_blind is null) = (qualifying_big_blind is null))
);

create index member_tier_id_idx on public.member (tier_id, venue_id);
create trigger member_touch_updated_at before update on public.member
  for each row execute function private.touch_updated_at();
create trigger member_audit after insert or update or delete on public.member
  for each row execute function private.audit_row_change();

-- The caller's member record, or null for staff, devices and the public.
create function private.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.member m where m.user_id = (select auth.uid());
$$;

create function private.current_member_venue_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.venue_id from public.member m where m.user_id = (select auth.uid());
$$;

grant execute on function private.current_member_id(), private.current_member_venue_id() to authenticated, service_role;

alter table public.tier enable row level security;
alter table public.member enable row level security;
grant select, insert, update on public.tier to authenticated;
grant select, insert, update on public.member to authenticated;

create policy "members see their own venue" on public.venue
  for select to authenticated
  using (id = (select private.current_member_venue_id()));

create policy "staff and members see the venue's tiers" on public.tier
  for select to authenticated
  using (venue_id in (select private.staff_venues()) or venue_id = (select private.current_member_venue_id()));

create policy "tier managers add tiers" on public.tier
  for insert to authenticated
  with check (venue_id in (select private.venues_where('tiers.manage')));

create policy "tier managers change tiers" on public.tier
  for update to authenticated
  using (venue_id in (select private.venues_where('tiers.manage')))
  with check (venue_id in (select private.venues_where('tiers.manage')));

create policy "members see themselves" on public.member
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "staff with member access see the venue's members" on public.member
  for select to authenticated
  using (venue_id in (select private.venues_where('members.read')));

-- Members change their own details through functions (lane C); staff through these policies.
create policy "member managers add members" on public.member
  for insert to authenticated
  with check (venue_id in (select private.venues_where('members.manage')));

create policy "member managers change members" on public.member
  for update to authenticated
  using (venue_id in (select private.venues_where('members.manage')))
  with check (venue_id in (select private.venues_where('members.manage')));
