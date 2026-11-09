-- Devices says whether each TV is on and what it shows (audit F-083), so a TV reports in every minute. A report is not a
-- change anyone made: on device or tv_screen, both audited, it would write an audit row a minute for each TV, so it has a
-- table of its own, kept by no audit trigger. A practice reset clears it; a TV reports in again within a minute.

create table public.tv_heartbeat (
  device_id uuid primary key,
  venue_id uuid not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (device_id, venue_id) references public.device (id, venue_id)
);

comment on table public.tv_heartbeat is 'When each TV last reported in (audit F-083). Not audited: it changes every minute.';

create index tv_heartbeat_device_venue_idx on public.tv_heartbeat (device_id, venue_id);
create index tv_heartbeat_venue_idx on public.tv_heartbeat (venue_id);
create trigger tv_heartbeat_touch_updated_at before update on public.tv_heartbeat
  for each row execute function private.touch_updated_at();

alter table public.tv_heartbeat enable row level security;
grant select on public.tv_heartbeat to authenticated;
create policy "staff see when the venue's TVs last reported in" on public.tv_heartbeat
  for select to authenticated
  using (venue_id in (select private.staff_venues()));

-- Only a TV's own session reports in, and only for itself: private.current_device_id() is null for anyone else, and for a
-- TV that has been unpaired or cut off.
create function private.tv_report_in()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.tv_heartbeat (device_id, venue_id)
  select d.id, d.venue_id from public.device d
  where d.id = (select private.current_device_id()) and d.kind = 'tv'
  on conflict (device_id) do update set last_seen_at = now();
$$;

create function public.tv_report_in()
returns void
language sql security invoker set search_path = ''
as $$ select private.tv_report_in(); $$;

revoke execute on function private.tv_report_in() from public, anon, authenticated;
grant execute on function private.tv_report_in() to authenticated;
revoke execute on function public.tv_report_in() from public, anon;
grant execute on function public.tv_report_in() to authenticated;

-- To a purge a report is a log: a row a TV moves every minute cannot be one of the tables checked for changes since the
-- archive, or a purge would be refused while any TV is on. Its rows are still deleted (decision 0563).
create or replace function private.live_purge_logs()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['alert', 'mis_report', 'outbox_delivery', 'outbox_event', 'tv_heartbeat'];
$$;
