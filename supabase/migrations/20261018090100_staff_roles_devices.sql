-- Staff, the seven permission roles and enrolled devices (features-2026-10-14.md, "Roles";
-- additions, "Staff job titles"). Access comes only from the role; the job title is separate.
-- The role x permission matrix mirrors packages/contracts/src/roles.ts (a db test keeps them equal).

create type public.staff_role as enum (
  'super_admin', 'admin', 'cashier', 'dealer', 'marketing', 'host', 'owner_view'
);

create table public.role_permission (
  role public.staff_role not null,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, permission),
  -- Purge, the full export, the kill switch, per-member overrides and venue configuration
  -- belong to super_admin and can never be granted to another role.
  constraint super_admin_only_permissions check (
    role = 'super_admin'
    or permission not in ('purge.run', 'exports.full', 'control.engage', 'members.override_features', 'venue.configure')
  )
);

comment on table public.role_permission is
  'Global reference data declared in code (packages/contracts/src/roles.ts), so it has no venue_id. Changed only by migrations.';

insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array[
  'venue.configure', 'settings.manage', 'staff.manage', 'devices.manage', 'members.read', 'members.manage',
  'members.override_features', 'kyc.review', 'tiers.manage', 'floor.manage', 'waitlist.manage',
  'call_time.override', 'hands.log', 'cage.transact', 'cage.second_approve', 'markers.issue',
  'markers.manage_limits', 'withdrawals.approve', 'ledger.read', 'tournaments.manage', 'promotions.manage',
  'jackpots.approve', 'marketing.publish', 'website.edit', 'host_queue.manage', 'fnb.manage', 'reports.read',
  'dashboards.read', 'exports.table', 'exports.full', 'audit.read', 'control.engage', 'purge.run',
  'sops.manage', 'sops.acknowledge', 'incidents.log', 'aml.review', 'learn.manage_sources'
]) as permission;

insert into public.role_permission (role, permission)
select 'admin', permission
from unnest(array[
  'sops.acknowledge', 'incidents.log', 'settings.manage', 'staff.manage', 'devices.manage', 'members.read',
  'members.manage', 'kyc.review', 'tiers.manage', 'floor.manage', 'waitlist.manage', 'call_time.override',
  'cage.second_approve', 'markers.manage_limits', 'ledger.read', 'tournaments.manage', 'promotions.manage',
  'jackpots.approve', 'host_queue.manage', 'fnb.manage', 'reports.read', 'exports.table', 'sops.manage',
  'aml.review'
]) as permission;

insert into public.role_permission (role, permission)
select 'cashier', permission
from unnest(array[
  'sops.acknowledge', 'incidents.log', 'members.read', 'cage.transact', 'cage.second_approve',
  'markers.issue', 'withdrawals.approve', 'ledger.read'
]) as permission;

insert into public.role_permission (role, permission)
select 'dealer', permission
from unnest(array['sops.acknowledge', 'incidents.log', 'hands.log']) as permission;

insert into public.role_permission (role, permission)
select 'marketing', permission
from unnest(array['sops.acknowledge', 'incidents.log', 'promotions.manage', 'marketing.publish', 'website.edit']) as permission;

insert into public.role_permission (role, permission)
select 'host', permission
from unnest(array['sops.acknowledge', 'incidents.log', 'members.read', 'waitlist.manage', 'host_queue.manage']) as permission;

insert into public.role_permission (role, permission)
select 'owner_view', permission
from unnest(array['sops.acknowledge', 'incidents.log', 'reports.read', 'dashboards.read', 'ledger.read', 'audit.read']) as permission;

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- The staff member's login. Null for staff who only sign in on a device with a PIN.
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null check (length(trim(full_name)) > 0),
  -- From the manpower plan (dealer, floor supervisor, cashier, host...). Rosters use it; access does not.
  job_title text not null check (length(trim(job_title)) > 0),
  role public.staff_role not null,
  phone text check (phone ~ '^\+91[6-9][0-9]{9}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, user_id)
);

create index staff_user_id_idx on public.staff (user_id);
create trigger staff_touch_updated_at before update on public.staff
  for each row execute function private.touch_updated_at();

-- Dealer PINs, kept apart from staff so no client can ever read a hash.
create table public.staff_credential (
  staff_id uuid primary key references public.staff (id) on delete cascade,
  venue_id uuid not null references public.venue (id),
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_credential_venue_id_idx on public.staff_credential (venue_id);
create trigger staff_credential_touch_updated_at before update on public.staff_credential
  for each row execute function private.touch_updated_at();

create type public.device_kind as enum ('dealer_tablet', 'cage', 'console', 'tv', 'door', 'driver_phone');

create table public.device (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  kind public.device_kind not null,
  name text not null check (length(trim(name)) > 0),
  -- The device's own login (tablets and TVs sign in as the device, not as a person).
  auth_user_id uuid unique references auth.users (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  enrolled_by_staff_id uuid references public.staff (id),
  revoked_at timestamptz,
  revoked_reason text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((revoked_at is null) = (revoked_reason is null))
);

create index device_venue_id_idx on public.device (venue_id);
create index device_enrolled_by_staff_id_idx on public.device (enrolled_by_staff_id);
create trigger device_touch_updated_at before update on public.device
  for each row execute function private.touch_updated_at();

-- Venues where the caller is active staff holding a permission. Policies use
--   venue_id in (select private.venues_where('members.read'))
-- so the lookup runs once per query rather than once per row.
create function private.venues_where(p_permission text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.venue_id
  from public.staff s
  join public.role_permission rp on rp.role = s.role
  where s.user_id = (select auth.uid()) and s.is_active and rp.permission = p_permission;
$$;

-- Venues where the caller is active staff, whatever the role.
create function private.staff_venues()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.venue_id from public.staff s where s.user_id = (select auth.uid()) and s.is_active;
$$;

-- True when the caller is active staff at the venue with the permission. For write functions.
create function private.has_permission(p_venue_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.venues_where(p_permission) v where v = p_venue_id);
$$;

-- The caller's staff record at a venue, or null.
create function private.current_staff_id(p_venue_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff s
  where s.user_id = (select auth.uid()) and s.venue_id = p_venue_id and s.is_active;
$$;

-- The enrolled, unrevoked device the caller is signed in as, or null.
create function private.current_device_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id from public.device d
  where d.auth_user_id = (select auth.uid()) and d.revoked_at is null;
$$;

grant execute on function private.venues_where(text), private.staff_venues(),
  private.has_permission(uuid, text), private.current_staff_id(uuid), private.current_device_id()
  to authenticated, service_role;

-- Row-level security. Default deny; each policy names who may do what.
alter table public.role_permission enable row level security;
alter table public.staff enable row level security;
alter table public.staff_credential enable row level security;
alter table public.device enable row level security;

grant select on public.role_permission to authenticated;
grant select, insert, update on public.staff to authenticated;
grant select, insert, update on public.device to authenticated;
-- staff_credential: no grants. Only security-definer functions read or write PINs.

create policy "staff read the role matrix" on public.role_permission
  for select to authenticated
  using (exists (select 1 from private.staff_venues()));

create policy "staff see their own venue" on public.venue
  for select to authenticated
  using (id in (select private.staff_venues()));

create policy "devices see their own venue" on public.venue
  for select to authenticated
  using (id in (select d.venue_id from public.device d where d.id = (select private.current_device_id())));

create policy "staff see their colleagues" on public.staff
  for select to authenticated
  using (venue_id in (select private.staff_venues()));

-- Only a super_admin (venue.configure) may create, change or promote a super_admin.
create policy "staff managers add staff" on public.staff
  for insert to authenticated
  with check (
    venue_id in (select private.venues_where('staff.manage'))
    and (role <> 'super_admin' or venue_id in (select private.venues_where('venue.configure')))
  );

create policy "staff managers change staff" on public.staff
  for update to authenticated
  using (
    venue_id in (select private.venues_where('staff.manage'))
    and (role <> 'super_admin' or venue_id in (select private.venues_where('venue.configure')))
  )
  with check (
    venue_id in (select private.venues_where('staff.manage'))
    and (role <> 'super_admin' or venue_id in (select private.venues_where('venue.configure')))
  );

create policy "staff see the venue's devices" on public.device
  for select to authenticated
  using (venue_id in (select private.staff_venues()) or id = (select private.current_device_id()));

create policy "device managers enrol devices" on public.device
  for insert to authenticated
  with check (venue_id in (select private.venues_where('devices.manage')));

create policy "device managers change devices" on public.device
  for update to authenticated
  using (venue_id in (select private.venues_where('devices.manage')))
  with check (venue_id in (select private.venues_where('devices.manage')));
