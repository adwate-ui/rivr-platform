-- Cage and admin computers (#384; scope-v1 module 10; .claude/rules/security.md; decision 0110). Staff with
-- devices.manage enrol a computer as the cage or as an admin console: the browser makes a secret token,
-- keeps it, and sends it with every database call (the x-rivr-computer header); only its SHA-256 hash is
-- stored. At a venue with cage and admin networks (venue_config.staff_ip_allowlist), the cage's money
-- permissions work only from an enrolled cage computer, and the admin permissions only from an enrolled
-- admin console, each from an address on those networks (private.request_ip, decision 0022). A revoked
-- computer stops at once. A venue with no networks, and the practice venue, enforce nothing.

alter table public.device add column token_hash text unique check (token_hash ~ '^[0-9a-f]{64}$');
alter table public.device add constraint device_token_only_computers check (token_hash is null or kind in ('cage', 'console'));
grant insert (token_hash) on public.device to authenticated;

-- The kind of enrolled computer a permission needs, or null for a permission that needs none.
create function private.computer_kind_for(p_permission text)
returns public.device_kind
language sql
immutable
set search_path = ''
as $$
  select case
    when p_permission in ('cage.transact', 'cage.second_approve', 'markers.issue', 'withdrawals.approve') then 'cage'::public.device_kind
    when p_permission in ('settings.manage', 'staff.manage', 'devices.manage', 'tiers.manage', 'venue.configure', 'control.engage',
                          'purge.run', 'exports.full') then 'console'::public.device_kind
  end;
$$;

-- The enrolled, unrevoked computer at the venue whose token this request carries, or null.
create function private.request_computer(p_venue_id uuid)
returns public.device
language sql
stable
security definer
set search_path = ''
as $$
  select d.* from public.device d
  where d.venue_id = p_venue_id and d.revoked_at is null
    and d.token_hash = encode(extensions.digest(nullif(current_setting('request.headers', true), '')::json ->> 'x-rivr-computer', 'sha256'), 'hex')
    and not exists (select 1 from public.control_state c where c.level = 'access_revoke' and c.device_id = d.id and c.released_at is null);
$$;

-- True when the venue enforces computers: it has cage and admin networks, and it is not the practice venue.
create function private.enforces_computers(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.venue v join public.venue_config c on c.venue_id = v.id
                 where v.id = p_venue_id and not v.is_practice and cardinality(c.staff_ip_allowlist) > 0);
$$;

-- True when this request comes from an address on the venue's cage and admin networks.
create function private.on_staff_network(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.venue_config c
                 where c.venue_id = p_venue_id and private.request_ip() <<= any (c.staff_ip_allowlist));
$$;

-- True when the request may use the permission at the venue, as far as computers go.
create function private.at_right_computer(p_venue_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.computer_kind_for(p_permission) is null
    or not private.enforces_computers(p_venue_id)
    or (private.on_staff_network(p_venue_id)
        and (private.request_computer(p_venue_id)).kind is not distinct from private.computer_kind_for(p_permission));
$$;

-- Every policy and write check asks for a permission through here (has_permission included), so the
-- computer rule holds wherever a permission does. As in the control_state migration, plus that rule.
create or replace function private.venues_where(p_permission text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.venue_id
  from public.staff s
  join public.role_permission rp on rp.role = s.role
  where s.user_id = (select auth.uid()) and s.is_active and rp.permission = p_permission
    and not exists (select 1 from public.control_state c
                    where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null)
    and private.at_right_computer(s.venue_id, p_permission);
$$;

-- This computer at the venue, for its staff: what it is enrolled as, whether the venue enforces
-- computers, and whether this request comes from the venue's networks.
create function private.this_computer(p_venue_id uuid)
returns table (device_id uuid, kind public.device_kind, name text, is_enforced boolean, is_on_staff_network boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.kind, d.name, private.enforces_computers(p_venue_id), private.on_staff_network(p_venue_id)
  from private.request_computer(p_venue_id) d
  where p_venue_id in (select private.staff_venues());
$$;

create function public.this_computer(p_venue_id uuid)
returns table (device_id uuid, kind public.device_kind, name text, is_enforced boolean, is_on_staff_network boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.this_computer(p_venue_id); $$;

revoke execute on function private.computer_kind_for(text), private.request_computer(uuid), private.enforces_computers(uuid),
  private.on_staff_network(uuid), private.at_right_computer(uuid, text), private.this_computer(uuid), public.this_computer(uuid)
  from public, anon;
grant execute on function private.computer_kind_for(text), private.request_computer(uuid), private.enforces_computers(uuid),
  private.on_staff_network(uuid), private.at_right_computer(uuid, text), private.this_computer(uuid), public.this_computer(uuid)
  to authenticated, service_role;
