-- The live floor (#638; owner's feedback doc of 29 Oct): each time a table opens and closes is kept, for games history
-- (#643); and the floor changes a seated player's call time. Join requests are approved on the Waitlist (#633).

-- One run of a table: from when it opened to when it closed, and who did each; open while the table plays.
create table public.table_run (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  table_id uuid not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by_staff_id uuid,
  closed_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (opened_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (closed_by_staff_id, venue_id) references public.staff (id, venue_id),
  check (closed_at is null or closed_at >= opened_at)
);
comment on table public.table_run is 'A table from when it opened to when it closed (#638), for games history (#643).';
create unique index table_run_open_idx on public.table_run (table_id) where closed_at is null;
create index table_run_venue_idx on public.table_run (venue_id, opened_at);
create index table_run_table_idx on public.table_run (table_id, venue_id);
create index table_run_opened_by_idx on public.table_run (opened_by_staff_id, venue_id);
create index table_run_closed_by_idx on public.table_run (closed_by_staff_id, venue_id);
create trigger table_run_touch_updated_at before update on public.table_run
  for each row execute function private.touch_updated_at();

alter table public.table_run enable row level security;
-- Staff who run or read the floor read the venue's runs; rows are written only by the trigger below.
create policy table_run_staff_read on public.table_run for select to authenticated
  using (venue_id in (select private.venues_where('floor.manage')) or venue_id in (select private.venues_where('waitlist.manage'))
         or venue_id in (select private.venues_where('reports.read')));
grant select on public.table_run to authenticated;

-- A table that opens starts a run; one that closes ends it. A table made open starts one too.
create function private.record_table_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_open and (tg_op = 'INSERT' or not old.is_open) then
    insert into public.table_run (venue_id, table_id, opened_by_staff_id) values (new.venue_id, new.id, private.current_staff_id(new.venue_id));
  elsif tg_op = 'UPDATE' and old.is_open and not new.is_open then
    update public.table_run set closed_at = now(), closed_by_staff_id = private.current_staff_id(new.venue_id)
    where table_id = new.id and closed_at is null;
  end if;
  return null;
end;
$$;
create trigger game_table_run after insert or update of is_open on public.game_table
  for each row execute function private.record_table_run();
revoke execute on function private.record_table_run() from public, anon, authenticated;

-- A practice reset keeps the venue's tables as they are, so it keeps their runs with them: a table it left closed has no run
-- to bring back. As in 20261028393600 and before, with table_run.
create or replace function private.practice_reset_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['audit_log', 'staff', 'staff_credential', 'device', 'device_pairing', 'tablet_assignment', 'computer_enrolment',
               'tv_screen', 'venue_config', 'setting', 'tier', 'tier_feature', 'chip_denomination', 'table_type', 'game_table', 'table_run',
               'invoice_series', 'sop', 'sop_version', 'sop_ack', 'quiz', 'quiz_attempt', 'site_block', 'site_page', 'site_revision', 'control_state',
               'contact', 'drill', 'camera'];
$$;

-- The tables playing now have run since now.
insert into public.table_run (venue_id, table_id) select g.venue_id, g.id from public.game_table g where g.is_open;

-- The floor (waitlist.manage) sets a seated player's call time, in minutes from when they sat down, at most a day. Less
-- than they have now needs the admin's override (call_time.override), as letting a player leave early does (#79); and a
-- call time already played out is not changed, so a player who met it never comes to owe time. Refusals: 42501 not the
-- floor, or less without the override; 22023 not seated, call time played out, or the minutes out of range; RVFRZ/RVMBR.
create function private.set_seat_call_time(p_session_id uuid, p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor changes a player''s call time' using errcode = '42501';
  end if;
  if v_session.ended_at is not null or v_session.call_time_completed_at is not null
     or (v_session.call_time_minutes > 0 and private.session_call_time(v_session, now()) = 0)
     or p_minutes is null or p_minutes not between 0 and 1440 then
    raise exception 'A seated player''s call time, not yet played out, is 0 to 1,440 minutes' using errcode = '22023';
  end if;
  if p_minutes < v_session.call_time_minutes and not private.has_permission(v_session.venue_id, 'call_time.override') then
    raise exception 'Only an admin cuts a player''s call time' using errcode = '42501';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  update public.seat_session
  set call_time_minutes = p_minutes
  where id = v_session.id;
end;
$$;
create function public.set_seat_call_time(p_session_id uuid, p_minutes integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_seat_call_time(p_session_id, p_minutes); $$;

revoke execute on function private.set_seat_call_time(uuid, integer), public.set_seat_call_time(uuid, integer) from public, anon;
grant execute on function private.set_seat_call_time(uuid, integer), public.set_seat_call_time(uuid, integer) to authenticated;
