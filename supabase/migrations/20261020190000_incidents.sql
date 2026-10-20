-- Points of contact, the incident log and the drill scheduler (#53; scope-v1 module 11; decision 0113).
-- The contacts are the internal escalation matrix, vendors, Glaza, the police station, the fire service and
-- DHBVN; every staff member reads them, and SOP managers keep them. Every staff member logs an incident
-- (incidents.log) with its severity, the CCTV reference and the SOP it follows; it is kept as logged, and
-- read by whoever logged it, SOP managers and the audit. SOP managers schedule drills a quarter apart and
-- mark them held.

create type public.contact_kind as enum ('escalation', 'vendor', 'glaza', 'police', 'fire', 'electricity');
create type public.incident_severity as enum ('low', 'medium', 'high', 'critical');

create table public.contact (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  kind public.contact_kind not null,
  -- The escalation matrix's order: who is called first, then next.
  position smallint not null default 1 check (position between 1 and 99),
  name text not null check (length(trim(name)) between 1 and 120),
  -- What they are to the club: `Duty manager`, `Sector 65 police station`.
  role text not null default '' check (length(role) <= 120),
  phone text not null check (phone ~ '^\+?[0-9][0-9 ]{2,19}$'),
  notes text not null default '' check (length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_venue_idx on public.contact (venue_id, kind, position);
create trigger contact_touch_updated_at before update on public.contact for each row execute function private.touch_updated_at();
create trigger contact_audit after insert or update or delete on public.contact for each row execute function private.audit_row_change();
alter table public.contact enable row level security;
grant select, insert, update, delete on public.contact to authenticated;
create policy "staff read their venue's contacts" on public.contact
  for select to authenticated using (venue_id in (select private.staff_venues()));
create policy "SOP managers add contacts" on public.contact
  for insert to authenticated with check (venue_id in (select private.venues_where('sops.manage')));
create policy "SOP managers change contacts" on public.contact
  for update to authenticated using (venue_id in (select private.venues_where('sops.manage')))
  with check (venue_id in (select private.venues_where('sops.manage')));
create policy "SOP managers remove contacts" on public.contact
  for delete to authenticated using (venue_id in (select private.venues_where('sops.manage')));

create table public.incident (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  occurred_at timestamptz not null default now(),
  severity public.incident_severity not null,
  summary text not null check (length(trim(summary)) between 3 and 2000),
  -- The camera and the time to look at, when a camera saw it.
  cctv_reference text check (cctv_reference is null or length(trim(cctv_reference)) between 1 and 200),
  sop_id uuid,
  -- Who logged it: the caller, never a value sent.
  logged_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sop_id, venue_id) references public.sop (id, venue_id),
  foreign key (logged_by_staff_id, venue_id) references public.staff (id, venue_id)
);
create index incident_venue_idx on public.incident (venue_id, occurred_at desc);
create index incident_sop_idx on public.incident (sop_id, venue_id);
create index incident_logger_idx on public.incident (logged_by_staff_id, venue_id);
create trigger incident_touch_updated_at before update on public.incident for each row execute function private.touch_updated_at();
create trigger incident_audit after insert or update or delete on public.incident for each row execute function private.audit_row_change();

-- An incident is logged by whoever is signed in, and kept as logged: a correction is a new incident. Logging
-- goes on while the venue is frozen, which is when incidents happen.
create function private.guard_incident()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'An incident is kept as logged: log a new one to correct it' using errcode = '22023';
  end if;
  -- When it was logged is the database's; when it happened may be earlier, never later.
  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'An incident is logged after it happens' using errcode = '22023';
  end if;
  new.logged_by_staff_id := private.current_staff_id(new.venue_id);
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;
create trigger incident_guard before insert or update or delete on public.incident for each row execute function private.guard_incident();
create trigger incident_no_truncate before truncate on public.incident for each statement execute function private.refuse_change();

-- incident.logged goes out for each one (the practice venue's never leave: claim_outbox_deliveries).
create function private.emit_incident_logged()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.emit(new.venue_id, 'incident.logged',
    jsonb_build_object('incident_id', new.id, 'severity', new.severity, 'occurred_at', new.occurred_at), 'incident.logged:' || new.id);
  return null;
end;
$$;
create trigger incident_logged after insert on public.incident for each row execute function private.emit_incident_logged();

alter table public.incident enable row level security;
grant select on public.incident to authenticated;
grant insert (venue_id, occurred_at, severity, summary, cctv_reference, sop_id) on public.incident to authenticated;
create policy "staff read the incidents they logged, SOP managers and the audit every one" on public.incident
  for select to authenticated
  using (logged_by_staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid()))
         or venue_id in (select private.venues_where('sops.manage')) or venue_id in (select private.venues_where('audit.read')));
create policy "staff log incidents" on public.incident
  for insert to authenticated with check (venue_id in (select private.venues_where('incidents.log')));

create table public.drill (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  title text not null check (length(trim(title)) between 1 and 120),
  sop_id uuid,
  scheduled_on date not null,
  held_on date,
  notes text not null default '' check (length(notes) <= 500),
  scheduled_by_staff_id uuid,
  held_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sop_id, venue_id) references public.sop (id, venue_id),
  foreign key (scheduled_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (held_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((held_on is null) = (held_by_staff_id is null))
);
create index drill_venue_idx on public.drill (venue_id, scheduled_on);
create index drill_sop_idx on public.drill (sop_id, venue_id);
create index drill_scheduler_idx on public.drill (scheduled_by_staff_id, venue_id);
create index drill_holder_idx on public.drill (held_by_staff_id, venue_id);
create trigger drill_touch_updated_at before update on public.drill for each row execute function private.touch_updated_at();
create trigger drill_audit after insert or update or delete on public.drill for each row execute function private.audit_row_change();
alter table public.drill enable row level security;
grant select on public.drill to authenticated;
create policy "staff read their venue's drills" on public.drill
  for select to authenticated using (venue_id in (select private.staff_venues()));

-- SOP managers schedule a drill four times, a quarter apart from the first date, with the SOP it rehearses.
-- 42501 otherwise; the venue frozen is RVFRZ.
create function private.schedule_drills(p_venue_id uuid, p_title text, p_first_on date, p_sop_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'sops.manage') then
    raise exception 'Only SOP managers schedule drills' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.drill (venue_id, title, sop_id, scheduled_on, scheduled_by_staff_id)
  select p_venue_id, trim(coalesce(p_title, '')), p_sop_id, (p_first_on + make_interval(months => 3 * q))::date, private.current_staff_id(p_venue_id)
  from generate_series(0, 3) as q;
  return 4;
end;
$$;

-- SOP managers mark a drill held, today, with what was learned. Marking it again is RVDUP.
create function private.hold_drill(p_drill_id uuid, p_notes text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_drill public.drill;
begin
  select * into v_drill from public.drill d where d.id = p_drill_id for update;
  if v_drill.id is null or not private.has_permission(v_drill.venue_id, 'sops.manage') then
    raise exception 'Only SOP managers mark a drill held' using errcode = '42501';
  end if;
  if v_drill.held_on is not null then
    raise exception 'That drill is already marked held' using errcode = 'RVDUP';
  end if;
  if v_drill.scheduled_on > private.today_ist() then
    raise exception 'A drill is held on or after its date' using errcode = '22023';
  end if;
  perform private.assert_writable(v_drill.venue_id);
  update public.drill d
  set held_on = private.today_ist(), held_by_staff_id = private.current_staff_id(d.venue_id), notes = trim(coalesce(p_notes, ''))
  where d.id = v_drill.id;
end;
$$;

create function public.schedule_drills(p_venue_id uuid, p_title text, p_first_on date, p_sop_id uuid default null)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.schedule_drills(p_venue_id, p_title, p_first_on, p_sop_id); $$;
create function public.hold_drill(p_drill_id uuid, p_notes text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.hold_drill(p_drill_id, p_notes); $$;

revoke execute on function private.emit_incident_logged() from public, anon, authenticated;
revoke execute on function private.guard_incident(), private.schedule_drills(uuid, text, date, uuid), private.hold_drill(uuid, text),
  public.schedule_drills(uuid, text, date, uuid), public.hold_drill(uuid, text) from public, anon;
grant execute on function private.schedule_drills(uuid, text, date, uuid), private.hold_drill(uuid, text),
  public.schedule_drills(uuid, text, date, uuid), public.hold_drill(uuid, text) to authenticated;
