-- The kill switch (features-2026-10-14.md, "Kill switch"): five levels, each a row here, checked
-- inside the database functions that write so a cached client cannot bypass it. Lane A owns the
-- console control and the engage and release functions; every lane's write functions call
-- private.assert_writable().

create type public.control_level as enum (
  'venue_freeze',   -- every money movement, seating and hand write refused; reads continue
  'feature_kill',   -- one feature switched off
  'messaging_stop', -- outbound WhatsApp and social posts halt; queued items hold
  'member_freeze',  -- one member cannot transact or join a waitlist
  'access_revoke'   -- a staff member's sessions end, or a device must re-enrol
);

create type public.killable_feature as enum (
  'withdrawals', 'credit', 'kyc_signup', 'marketing_sends', 'social_publishing', 'promotions', 'tournament_registration'
);

create table public.control_state (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  level public.control_level not null,
  feature public.killable_feature,
  member_id uuid,
  staff_id uuid references public.staff (id),
  device_id uuid references public.device (id),
  reason text not null check (length(trim(reason)) > 0),
  engaged_at timestamptz not null default now(),
  engaged_by_staff_id uuid references public.staff (id),
  released_at timestamptz,
  released_by_staff_id uuid references public.staff (id),
  release_reason text,
  -- A venue freeze is released by two different super admins.
  release_second_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  constraint target_matches_level check (
    (level = 'feature_kill') = (feature is not null)
    and (level = 'member_freeze') = (member_id is not null)
    and (level = 'access_revoke') = (staff_id is not null or device_id is not null)
  ),
  constraint release_needs_reason check (
    released_at is null or (released_by_staff_id is not null and length(trim(coalesce(release_reason, ''))) > 0)
  ),
  constraint venue_freeze_release_needs_two check (
    level <> 'venue_freeze' or released_at is null
    or (release_second_staff_id is not null and release_second_staff_id <> released_by_staff_id)
  )
);

-- At most one active row per level and target.
create unique index control_state_one_active_idx on public.control_state
  (venue_id, level, feature, member_id, staff_id, device_id) nulls not distinct
  where released_at is null;
create index control_state_member_idx on public.control_state (member_id, venue_id);
create index control_state_staff_idx on public.control_state (staff_id);
create index control_state_device_idx on public.control_state (device_id);
create index control_state_engaged_by_idx on public.control_state (engaged_by_staff_id);
create index control_state_released_by_idx on public.control_state (released_by_staff_id);
create index control_state_second_idx on public.control_state (release_second_staff_id);

-- A row is engaged once and released once; nothing else about it changes.
create function private.control_state_release_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.released_at is not null then
    raise exception 'control % is already released', old.id using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - array['released_at', 'released_by_staff_id', 'release_reason', 'release_second_staff_id', 'updated_at'])
     <> (to_jsonb(old) - array['released_at', 'released_by_staff_id', 'release_reason', 'release_second_staff_id', 'updated_at']) then
    raise exception 'only the release of a control can change' using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger control_state_release_only before update on public.control_state
  for each row execute function private.control_state_release_only();
create trigger control_state_no_delete before delete on public.control_state
  for each row execute function private.refuse_change();
create trigger control_state_no_truncate before truncate on public.control_state
  for each statement execute function private.refuse_change();
create trigger control_state_audit after insert or update on public.control_state
  for each row execute function private.audit_row_change();

-- Refuses the write when the venue is frozen, the feature is killed or the member is frozen.
-- Every write function calls it first. The SQLSTATE tells the app which message to show:
--   RVFRZ venue frozen, RVKIL feature switched off, RVMBR member frozen.
create function private.assert_writable(
  p_venue_id uuid,
  p_feature public.killable_feature default null,
  p_member_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.control_state c
             where c.venue_id = p_venue_id and c.level = 'venue_freeze' and c.released_at is null) then
    raise exception 'venue_frozen' using errcode = 'RVFRZ';
  end if;
  if p_feature is not null and exists (
    select 1 from public.control_state c
    where c.venue_id = p_venue_id and c.level = 'feature_kill' and c.feature = p_feature and c.released_at is null) then
    raise exception 'feature_switched_off: %', p_feature using errcode = 'RVKIL';
  end if;
  if p_member_id is not null and exists (
    select 1 from public.control_state c
    where c.venue_id = p_venue_id and c.level = 'member_freeze' and c.member_id = p_member_id and c.released_at is null) then
    raise exception 'member_frozen' using errcode = 'RVMBR';
  end if;
end;
$$;

-- Access revoke ends a staff member's or a device's access at once (features, "Kill switch").
-- The access helpers from the staff migration are redefined here, now that control_state
-- exists, to ignore anyone with an engaged revoke. Every policy and write check goes through them.
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
                    where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null);
$$;

create or replace function private.staff_venues()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.venue_id from public.staff s
  where s.user_id = (select auth.uid()) and s.is_active
    and not exists (select 1 from public.control_state c
                    where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null);
$$;

create or replace function private.current_staff_id(p_venue_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff s
  where s.user_id = (select auth.uid()) and s.venue_id = p_venue_id and s.is_active
    and not exists (select 1 from public.control_state c
                    where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null);
$$;

create or replace function private.current_device_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id from public.device d
  where d.auth_user_id = (select auth.uid()) and d.revoked_at is null
    and not exists (select 1 from public.control_state c
                    where c.level = 'access_revoke' and c.device_id = d.id and c.released_at is null);
$$;

-- True while outbound messages for the venue must hold.
create function private.is_messaging_stopped(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.control_state c
                 where c.venue_id = p_venue_id and c.level = 'messaging_stop' and c.released_at is null);
$$;

grant execute on function private.assert_writable(uuid, public.killable_feature, uuid),
  private.is_messaging_stopped(uuid) to authenticated, service_role;

alter table public.control_state enable row level security;

-- Everyone signed in at the venue sees that a control is engaged (for the banner), but the
-- reason and who engaged it are for staff only: those columns are not granted to clients and
-- are read through control_state_detail.
grant select (id, venue_id, level, feature, member_id, staff_id, device_id, engaged_at, released_at, created_at, updated_at)
  on public.control_state to authenticated;

create policy "staff and devices see the venue's controls" on public.control_state
  for select to authenticated
  using (
    venue_id in (select private.staff_venues())
    or venue_id in (select d.venue_id from public.device d where d.id = (select private.current_device_id()))
  );

create policy "members see venue-wide controls and their own freeze" on public.control_state
  for select to authenticated
  using (
    venue_id = (select private.current_member_venue_id())
    and (level in ('venue_freeze', 'feature_kill') or member_id = (select private.current_member_id()))
  );

-- Full rows, reasons included, for the venue's staff.
create function private.control_state_detail_rows()
returns setof public.control_state
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from public.control_state c where c.venue_id in (select private.staff_venues());
$$;

grant execute on function private.control_state_detail_rows() to authenticated;

create view public.control_state_detail
with (security_invoker = true)
as
select * from private.control_state_detail_rows();

grant select on public.control_state_detail to authenticated;

-- The website and link-in-bio show the club closed during a venue freeze. Not the practice venue.
create function private.public_venue_status_rows()
returns table (venue_id uuid, is_frozen boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, exists (select 1 from public.control_state c
                       where c.venue_id = v.id and c.level = 'venue_freeze' and c.released_at is null)
  from public.venue v
  where not v.is_practice;
$$;

grant execute on function private.public_venue_status_rows() to anon, authenticated;

create view public.public_venue_status
with (security_invoker = true)
as
select venue_id, is_frozen from private.public_venue_status_rows();

grant select on public.public_venue_status to anon, authenticated;

alter publication supabase_realtime add table public.control_state;
