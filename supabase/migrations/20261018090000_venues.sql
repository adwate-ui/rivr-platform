-- Venues: every record in the platform belongs to one. The practice venue is a real venue with
-- is_practice = true, used for staff training; nothing from it reaches an external system.
-- Also creates the `private` schema for helper functions the API does not expose.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Nothing is reachable by a client until a migration grants it by name. Without these lines,
-- every new function is executable by everyone (a global Postgres default that a per-schema
-- revoke cannot remove), and Supabase's defaults give anon and authenticated TRUNCATE,
-- REFERENCES and TRIGGER on every new table. Truncate ignores row-level security.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- Keeps updated_at current on every table that has one.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- The caller's IP address from the API gateway, for the audit log. Null outside an API request.
create function private.request_ip()
returns inet
language plpgsql
stable
set search_path = ''
as $$
declare
  forwarded text := split_part(
    coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
begin
  return nullif(trim(forwarded), '')::inet;
exception when invalid_text_representation then
  return null;
end;
$$;

-- The enrolled device the request came from, sent by the apps as x-rivr-device-id.
create function private.request_device_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  return nullif(current_setting('request.headers', true)::json ->> 'x-rivr-device-id', '')::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create table public.venue (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_practice boolean not null default false,
  time_zone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.venue is
  'A club room. venue.id is the venue_id every other table carries. The practice venue (is_practice) trains staff and is excluded from reports, exports, public surfaces and every external consumer.';

create trigger venue_touch_updated_at
  before update on public.venue
  for each row execute function private.touch_updated_at();

alter table public.venue enable row level security;
grant select on public.venue to authenticated;

-- Public surfaces (website, TVs, link-in-bio) read public_* views: no personal data and never
-- the practice venue. Each view is security-invoker over a security-definer function in
-- `private`, the pattern the Supabase advisors accept.
create function private.public_venue_rows()
returns table (id uuid, name text, slug text, time_zone text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.name, v.slug, v.time_zone
  from public.venue v
  where not v.is_practice;
$$;

grant execute on function private.public_venue_rows() to anon, authenticated;

create view public.public_venue
with (security_invoker = true)
as
select id, name, slug, time_zone from private.public_venue_rows();

grant select on public.public_venue to anon, authenticated;
