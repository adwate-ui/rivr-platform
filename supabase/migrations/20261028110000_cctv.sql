-- CCTV references (#122; tech plan item 17; decision 0238). The venue's cameras, each on the recorder's channel and
-- watching a table, the cage or elsewhere. A hand carries its table's camera, a cage transaction the cage's, and an
-- incident the camera its logger chose; each with its own moment (played_at, created_at, occurred_at). The
-- cctv-playback Edge Function turns a reference into the recorder's playback link through @rivr/adapters.

create table public.camera (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(trim(name)) between 1 and 80),
  -- The recorder's own name for the camera's feed, as its playback link takes it.
  channel text not null check (channel ~ '^[A-Za-z0-9_.:-]{1,40}$' and channel !~ '^[.]+$'),
  table_id uuid,
  is_cage boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  check (not (is_cage and table_id is not null))
);
comment on table public.camera is 'A CCTV camera (#122): its recorder channel, and the table or cage it watches, if any.';
create unique index camera_name_idx on public.camera (venue_id, lower(name)) where is_active;
create unique index camera_table_idx on public.camera (table_id) where is_active and table_id is not null;
create unique index camera_cage_idx on public.camera (venue_id) where is_active and is_cage;

create trigger camera_touch_updated_at before update on public.camera
  for each row execute function private.touch_updated_at();
create trigger camera_audit after insert or update or delete on public.camera
  for each row execute function private.audit_row_change();

alter table public.camera enable row level security;
grant select on public.camera to authenticated;
create policy "staff see their venue's cameras" on public.camera
  for select to authenticated using (venue_id in (select private.staff_venues()));

alter table public.hand add column camera_id uuid;
alter table public.hand add foreign key (camera_id, venue_id) references public.camera (id, venue_id);
alter table public.cage_transaction add column camera_id uuid;
alter table public.cage_transaction add foreign key (camera_id, venue_id) references public.camera (id, venue_id);
alter table public.incident add column camera_id uuid;
alter table public.incident add foreign key (camera_id, venue_id) references public.camera (id, venue_id);
create index hand_camera_idx on public.hand (camera_id, venue_id) where camera_id is not null;
create index cage_transaction_camera_idx on public.cage_transaction (camera_id, venue_id) where camera_id is not null;
create index incident_camera_idx on public.incident (camera_id, venue_id) where camera_id is not null;
grant insert (camera_id) on public.incident to authenticated;

-- A hand is filmed by its table's camera, a cage transaction by the cage's: whichever is active as it is written (a
-- tablet's offline hands, as they sync). A purge or practice reset replays rows as captured, cameras included.
create function private.set_hand_camera()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(private.purging(new.venue_id), false) then
    return new;
  end if;
  new.camera_id := (select c.id from public.camera c where c.table_id = new.table_id and c.is_active);
  return new;
end;
$$;

create function private.set_cage_camera()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(private.purging(new.venue_id), false) then
    return new;
  end if;
  new.camera_id := (select c.id from public.camera c where c.venue_id = new.venue_id and c.is_cage and c.is_active);
  return new;
end;
$$;

create trigger hand_camera before insert on public.hand
  for each row execute function private.set_hand_camera();
create trigger cage_transaction_camera before insert on public.cage_transaction
  for each row execute function private.set_cage_camera();

-- Adds a camera (no `p_camera_id`), or changes or retires one, for staff who manage devices: over a table (`p_table_id`),
-- on the cage, or neither. A table or the cage has one active camera. A camera keeps its channel: what it filmed is
-- found by it, so a new channel is a new camera. Refusals: 42501; 22023 a name, channel or place that is not valid, or
-- a changed channel; 23505 a name, table or cage already taken.
create function private.save_camera(p_venue_id uuid, p_name text, p_channel text, p_is_cage boolean, p_is_active boolean,
                                    p_camera_id uuid default null, p_table_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'devices.manage') then
    raise exception 'Only staff who manage devices keep the cameras' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if p_camera_id is null then
    insert into public.camera (venue_id, name, channel, table_id, is_cage, is_active)
    values (p_venue_id, btrim(p_name), btrim(p_channel), p_table_id, coalesce(p_is_cage, false), coalesce(p_is_active, true))
    returning id into v_id;
  else
    update public.camera set name = btrim(p_name), table_id = p_table_id,
      is_cage = coalesce(p_is_cage, false), is_active = coalesce(p_is_active, true)
    where id = p_camera_id and venue_id = p_venue_id and channel = btrim(p_channel)
    returning id into v_id;
    if v_id is null then
      raise exception 'No such camera here, or its channel changed' using errcode = '22023';
    end if;
  end if;
  return v_id;
exception
  when check_violation or not_null_violation or foreign_key_violation then
    raise exception 'A name, a channel of letters and digits, and a table of this venue or the cage' using errcode = '22023';
end;
$$;

-- The venue's cameras, active first, with the table each watches.
create function private.cameras(p_venue_id uuid)
returns table (camera_id uuid, name text, channel text, table_id uuid, table_name text, is_cage boolean, is_active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.channel, c.table_id, g.name, c.is_cage, c.is_active
  from public.camera c left join public.game_table g on g.id = c.table_id
  where c.venue_id = p_venue_id and p_venue_id in (select private.staff_venues())
  order by c.is_active desc, c.is_cage desc, g.position nulls last, c.name;
$$;

-- The camera and moment of a hand, cage transaction or incident, if a camera saw it: the recorder channel, the
-- camera's name, the moment, and whether the venue is the practice one. It runs as the caller, so it answers only
-- for a row the caller may read.
create function public.cctv_reference(p_kind text, p_id uuid)
returns table (channel text, camera_name text, at timestamptz, is_practice boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.channel, c.name, r.at, v.is_practice
  from (
    select h.camera_id, h.played_at as at, h.venue_id from public.hand h where p_kind = 'hand' and h.id = p_id
    union all
    select t.camera_id, t.created_at, t.venue_id from public.cage_transaction t where p_kind = 'cage_transaction' and t.id = p_id
    union all
    select i.camera_id, i.occurred_at, i.venue_id from public.incident i where p_kind = 'incident' and i.id = p_id
  ) r
  join public.camera c on c.id = r.camera_id
  join public.venue v on v.id = r.venue_id;
$$;

create function public.save_camera(p_venue_id uuid, p_name text, p_channel text, p_is_cage boolean, p_is_active boolean,
                                   p_camera_id uuid default null, p_table_id uuid default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_camera(p_venue_id, p_name, p_channel, p_is_cage, p_is_active, p_camera_id, p_table_id); $$;
create function public.cameras(p_venue_id uuid)
returns table (camera_id uuid, name text, channel text, table_id uuid, table_name text, is_cage boolean, is_active boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.cameras(p_venue_id); $$;

revoke execute on function private.set_hand_camera(), private.set_cage_camera() from public, anon, authenticated;
revoke execute on function private.save_camera(uuid, text, text, boolean, boolean, uuid, uuid), private.cameras(uuid),
  public.save_camera(uuid, text, text, boolean, boolean, uuid, uuid), public.cameras(uuid), public.cctv_reference(text, uuid)
  from public, anon;
grant execute on function private.save_camera(uuid, text, text, boolean, boolean, uuid, uuid), private.cameras(uuid),
  public.save_camera(uuid, text, text, boolean, boolean, uuid, uuid), public.cameras(uuid), public.cctv_reference(text, uuid)
  to authenticated;

-- As before (20261021130000_practice_reset.sql), with the cameras: venue setup, like the tables and devices.
create or replace function private.practice_reset_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['audit_log', 'staff', 'staff_credential', 'device', 'device_pairing', 'tablet_assignment', 'computer_enrolment',
               'tv_screen', 'venue_config', 'setting', 'tier', 'tier_feature', 'chip_denomination', 'table_type', 'game_table',
               'invoice_series', 'sop', 'sop_version', 'sop_ack', 'quiz', 'quiz_attempt', 'site_block', 'site_page', 'control_state',
               'contact', 'drill', 'camera'];
$$;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
