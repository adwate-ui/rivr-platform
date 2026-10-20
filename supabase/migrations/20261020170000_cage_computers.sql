-- Cage and admin computers (#384; scope-v1 module 10; .claude/rules/security.md; decision 0110). Staff with
-- devices.manage add a computer as the cage or as an admin console and get a ten-minute code; on that
-- computer, staff claim the code: the browser makes a secret token, keeps it, and sends it with every
-- database call (the x-rivr-computer header); only its SHA-256 hash is stored. At a venue with cage and
-- admin networks (venue_config.staff_ip_allowlist), the cage's money permissions work only from an
-- enrolled cage computer, and the admin permissions only from an enrolled admin console, each from an
-- address on those networks (private.request_ip, decision 0022). A revoked computer stops at once. A
-- venue with no networks, and the practice venue, enforce nothing.

alter table public.device add column token_hash text unique check (token_hash ~ '^[0-9a-f]{64}$');
alter table public.device add constraint device_token_only_computers check (token_hash is null or kind in ('cage', 'console'));

-- A computer's enrolment codes, by hash, as tablets' pairing codes are. Only the functions below use them.
create table public.computer_enrolment (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  device_id uuid not null,
  code_hash text not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  foreign key (device_id, venue_id) references public.device (id, venue_id)
);
create index computer_enrolment_device_idx on public.computer_enrolment (device_id, venue_id);
create index computer_enrolment_venue_idx on public.computer_enrolment (venue_id);
create index computer_enrolment_staff_idx on public.computer_enrolment (created_by_staff_id);
create index computer_enrolment_live_idx on public.computer_enrolment (code_hash) where claimed_at is null;
alter table public.computer_enrolment enable row level security;

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

-- Which roles a staff member may give is a matter of roles, not of the computer they sit at: the cage's
-- permissions and the admin ones need different computers, so asking has_permission for each of a
-- role's permissions would let no one give the admin role at a venue that enforces computers. As in the
-- staff migration otherwise; the staff policy still needs staff.manage from an admin console.
create or replace function private.can_grant_role(p_venue_id uuid, p_role public.staff_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select rp.permission from public.staff s join public.role_permission rp on rp.role = s.role
    where s.user_id = (select auth.uid()) and s.venue_id = p_venue_id and s.is_active
      and not exists (select 1 from public.control_state c
                      where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null)
  )
  select exists (select 1 from mine where permission = 'venue.configure')
    or not exists (select 1 from public.role_permission rp where rp.role = p_role and rp.permission not in (select permission from mine));
$$;

-- An admin console adds a computer to enrol (devices.manage): the cage or an admin console, by name, with
-- a code good for ten minutes that staff claim on that computer.
create function private.add_computer(p_venue_id uuid, p_kind public.device_kind, p_name text)
returns table (device_id uuid, code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_device_id uuid;
  v_code text;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'devices.manage') then
    raise exception 'Only staff who manage devices add a computer' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('cage', 'console') then
    raise exception 'A computer is enrolled as the cage or an admin console' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.device (venue_id, kind, name) values (p_venue_id, p_kind, trim(coalesce(p_name, ''))) returning id into v_device_id;
  -- From a strong random source, and never the same as another live code, as a tablet's pairing code.
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.computer_enrolment e
                          where e.code_hash = private.pairing_hash(v_code) and e.claimed_at is null and e.expires_at > now());
  end loop;
  insert into public.computer_enrolment (venue_id, device_id, code_hash, expires_at, created_by_staff_id)
  values (p_venue_id, v_device_id, private.pairing_hash(v_code), v_expires_at, private.current_staff_id(p_venue_id));
  perform private.audit(p_venue_id, 'device.enrolment_started', 'device', v_device_id::text, null, jsonb_build_object('expires_at', v_expires_at));
  return query select v_device_id, v_code, v_expires_at;
end;
$$;

-- On the computer itself, staff at the venue claim its code with the hash of the token the browser now
-- keeps: from the venue's networks when it has them. A wrong, used or expired code gives null and counts
-- against the staff member: five in ten minutes stop them for ten minutes (RVMAX). 42501 not staff here,
-- or off the networks.
create function private.claim_computer(p_venue_id uuid, p_code text, p_token_hash text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid := private.current_staff_id(p_venue_id);
  v_client text;
  v_enrolment public.computer_enrolment;
begin
  if v_staff_id is null or (private.enforces_computers(p_venue_id) and not private.on_staff_network(p_venue_id)) then
    raise exception 'Only staff at the venue, on its networks, enrol a computer' using errcode = '42501';
  end if;
  v_client := 'computer:' || v_staff_id;
  delete from private.device_pairing_miss m where m.missed_at < now() - interval '1 day';
  if (select count(*) from private.device_pairing_miss m where m.client = v_client and m.missed_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many wrong codes: wait ten minutes' using errcode = 'RVMAX';
  end if;
  select * into v_enrolment from public.computer_enrolment e
  where e.venue_id = p_venue_id and e.code_hash = private.pairing_hash(coalesce(p_code, '')) and e.claimed_at is null and e.expires_at > now()
  for update;
  if v_enrolment.id is null then
    -- Returned, not raised, so the miss is kept.
    insert into private.device_pairing_miss (client) values (v_client);
    return null;
  end if;
  update public.device d set token_hash = p_token_hash where d.id = v_enrolment.device_id and d.revoked_at is null;
  if not found then
    return null;
  end if;
  update public.computer_enrolment e set claimed_at = now() where e.id = v_enrolment.id;
  perform private.audit(p_venue_id, 'device.enrolled', 'device', v_enrolment.device_id::text, null, null);
  return v_enrolment.device_id;
end;
$$;

create function public.add_computer(p_venue_id uuid, p_kind public.device_kind, p_name text)
returns table (device_id uuid, code text, expires_at timestamptz)
language sql volatile security invoker set search_path = ''
as $$ select * from private.add_computer(p_venue_id, p_kind, p_name); $$;
create function public.claim_computer(p_venue_id uuid, p_code text, p_token_hash text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.claim_computer(p_venue_id, p_code, p_token_hash); $$;

-- Networks are saved only from an enrolled admin console on one of them, so whoever saves them cannot
-- shut every admin out (an owner can still clear them in the SQL editor, decision 0110). Clearing them
-- needs nothing more than venue.configure. RVNET otherwise.
create function private.guard_staff_networks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.staff_ip_allowlist is distinct from old.staff_ip_allowlist and cardinality(new.staff_ip_allowlist) > 0
     and (select auth.uid()) is not null
     and not exists (select 1 from public.venue v where v.id = new.venue_id and v.is_practice)
     and not (private.request_ip() <<= any (new.staff_ip_allowlist)
              and (private.request_computer(new.venue_id)).kind is not distinct from 'console') then
    raise exception 'Save the networks from an enrolled admin console on one of them' using errcode = 'RVNET';
  end if;
  return new;
end;
$$;

create trigger venue_config_guard_staff_networks before update on public.venue_config
  for each row execute function private.guard_staff_networks();

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
revoke execute on function private.add_computer(uuid, public.device_kind, text), public.add_computer(uuid, public.device_kind, text),
  private.claim_computer(uuid, text, text), public.claim_computer(uuid, text, text), private.guard_staff_networks() from public, anon;
grant execute on function private.add_computer(uuid, public.device_kind, text), public.add_computer(uuid, public.device_kind, text),
  private.claim_computer(uuid, text, text), public.claim_computer(uuid, text, text) to authenticated;
