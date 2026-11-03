-- The console's density (console v3, phase 1; decision 0442): each staff member's own choice of row height, comfortable
-- (42 px) or compact (34 px), kept in the database so it follows them to any computer at the club. One row per staff
-- record, so the club and the practice venue each hold the staff member's own; the console writes them together. Staff
-- read and write only their own rows, and nothing else reads them: no outbox event, nothing leaves the database.

create table public.staff_preference (
  staff_id uuid primary key references public.staff (id) on delete cascade,
  venue_id uuid not null references public.venue (id),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_preference is 'A staff member''s own console settings, such as the density of its rows.';

create index staff_preference_venue_id_idx on public.staff_preference (venue_id);
create trigger staff_preference_touch_updated_at before update on public.staff_preference
  for each row execute function private.touch_updated_at();

alter table public.staff_preference enable row level security;
-- No delete: a staff member changes their choice, and their row goes with their staff record.
grant select, insert, update on public.staff_preference to authenticated;

-- Their own row, at a venue where they are active staff: current_staff_id is the caller's record there, so a row can never
-- name another person's record, nor a venue other than its record's.
create policy "staff read their own preferences" on public.staff_preference
  for select to authenticated
  using (staff_id = private.current_staff_id(venue_id));

create policy "staff add their own preferences" on public.staff_preference
  for insert to authenticated
  with check (staff_id = private.current_staff_id(venue_id));

create policy "staff change their own preferences" on public.staff_preference
  for update to authenticated
  using (staff_id = private.current_staff_id(venue_id))
  with check (staff_id = private.current_staff_id(venue_id));
