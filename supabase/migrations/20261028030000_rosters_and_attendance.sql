-- Rosters, shifts and attendance by job title (#106; scope-v1 module 10; decision 0236). Staff who manage staff
-- (staff.manage) roster the team a week at a time: shifts for the staff of a job title on the days chosen, from a start
-- to an end on India's clock (an end at or before the start is the next morning), or last week's roster copied. A
-- staff member's shifts never overlap. Each shift's attendance is recorded once its club day has come: present, late
-- or absent, with an optional note. Everyone sees their own shifts.

create table public.staff_shift (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  staff_id uuid not null references public.staff (id),
  -- The club day (06:00 to 06:00 IST) the shift is rostered on.
  club_day date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- The job title it is worked as, as the staff member held it when rostered.
  job_title text not null check (length(btrim(job_title)) > 0),
  created_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, starts_at),
  check (ends_at > starts_at and ends_at - starts_at <= interval '16 hours')
);
comment on table public.staff_shift is 'A rostered shift (#106): who, the club day, when, and the job title worked.';
create index staff_shift_venue_day_idx on public.staff_shift (venue_id, club_day);

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  shift_id uuid not null unique references public.staff_shift (id),
  status text not null check (status in ('present', 'late', 'absent')),
  note text check (note is null or length(btrim(note)) between 1 and 300),
  recorded_by_staff_id uuid references public.staff (id),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.staff_attendance is 'Whether a rostered shift was worked (#106): present, late or absent.';
create index staff_attendance_venue_idx on public.staff_attendance (venue_id);

create trigger staff_shift_touch_updated_at before update on public.staff_shift
  for each row execute function private.touch_updated_at();
create trigger staff_attendance_touch_updated_at before update on public.staff_attendance
  for each row execute function private.touch_updated_at();
create trigger staff_shift_audit after insert or update or delete on public.staff_shift
  for each row execute function private.audit_row_change();
-- Attendance is audited by record_attendance with its status only: a note can say why someone was absent, so it
-- stays out of the audit log, which investors read.

alter table public.staff_shift enable row level security;
alter table public.staff_attendance enable row level security;
grant select on public.staff_shift, public.staff_attendance to authenticated;
create policy "staff managers see the roster; everyone their own shifts" on public.staff_shift
  for select to authenticated using (
    private.has_permission(venue_id, 'staff.manage')
    or staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid())));
create policy "staff managers see attendance; everyone their own" on public.staff_attendance
  for select to authenticated using (
    private.has_permission(venue_id, 'staff.manage')
    or shift_id in (select h.id from public.staff_shift h join public.staff s on s.id = h.staff_id where s.user_id = (select auth.uid())));

-- Refuses anyone who does not manage staff at the venue, and a frozen venue.
create function private.assert_rosters(p_venue_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'staff.manage') then
    raise exception 'Only staff who manage staff keep the roster' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
end;
$$;

-- The club day now: 06:00 to 06:00 IST, so 02:00 belongs to the night before.
create function private.club_day_now()
returns date
language sql
stable
set search_path = ''
as $$
  select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - interval '6 hours'))::date;
$$;

-- When a shift on a club day from `p_starts` to `p_ends` (`18:00`, India's clock) begins and ends. The club day runs
-- 06:00 to 06:00, so a start before 06:00 is the next morning, and an end at or before the start is the morning after it.
create function private.shift_times(p_club_day date, p_starts text, p_ends text)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
immutable
set search_path = ''
as $$
  select (p_club_day + p_starts::time + o.small_hours) at time zone 'Asia/Kolkata',
         (p_club_day + p_ends::time + o.small_hours
          + case when p_ends::time <= p_starts::time then interval '1 day' else interval '0' end) at time zone 'Asia/Kolkata'
  from (select case when p_starts::time < time '06:00' then interval '1 day' else interval '0' end as small_hours) o;
$$;

-- Adds a shift from `p_starts` to `p_ends` for each of the staff on each of the days: the staff of one job title, or
-- any. Refusals: 42501; 22023 times not HH:MM, a shift over 16 hours, no staff or days (or over 200 staff or 14 days), a
-- day already past, or staff not active here; RVOVL a shift that would overlap one of theirs. Gives how many it added.
create function private.add_shifts(p_venue_id uuid, p_staff_ids uuid[], p_days date[], p_starts text, p_ends text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added integer;
begin
  perform private.assert_rosters(p_venue_id);
  -- One roster change at a time per venue, so two cannot both pass the overlap check.
  perform pg_advisory_xact_lock(hashtextextended('roster:' || p_venue_id::text, 0));
  if coalesce(p_starts, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_ends, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(cardinality(p_staff_ids), 0) not between 1 and 200 or coalesce(cardinality(p_days), 0) not between 1 and 14
     or exists (select 1 from unnest(p_days) d(day) where d.day is null or d.day < private.club_day_now())
     or (select t.ends_at - t.starts_at from private.shift_times(current_date, p_starts, p_ends) t) > interval '16 hours'
     or exists (select 1 from unnest(p_staff_ids) x(id)
                where not exists (select 1 from public.staff s where s.id = x.id and s.venue_id = p_venue_id and s.is_active)) then
    raise exception 'Times as HH:MM, and the venue''s active staff on some days' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_staff_ids) x(id) cross join unnest(p_days) d(day) cross join lateral private.shift_times(d.day, p_starts, p_ends) t
             join public.staff_shift h on h.staff_id = x.id and h.starts_at < t.ends_at and t.starts_at < h.ends_at) then
    raise exception 'A shift would overlap one already rostered' using errcode = 'RVOVL';
  end if;
  insert into public.staff_shift (venue_id, staff_id, club_day, starts_at, ends_at, job_title, created_by_staff_id)
  select p_venue_id, s.id, d.day, t.starts_at, t.ends_at, s.job_title, private.current_staff_id(p_venue_id)
  from unnest(p_staff_ids) x(id) join public.staff s on s.id = x.id cross join unnest(p_days) d(day)
  cross join lateral private.shift_times(d.day, p_starts, p_ends) t;
  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

-- Takes a shift off the roster, while its attendance is not recorded. Refusals: 22023 no such shift, or recorded; 42501.
create function private.remove_shift(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select h.venue_id from public.staff_shift h where h.id = p_shift_id);
begin
  if v_venue_id is null then
    raise exception 'No such shift' using errcode = '22023';
  end if;
  perform private.assert_rosters(v_venue_id);
  if exists (select 1 from public.staff_attendance a where a.shift_id = p_shift_id) then
    raise exception 'A shift whose attendance is recorded stays' using errcode = '22023';
  end if;
  delete from public.staff_shift h where h.id = p_shift_id;
end;
$$;

-- Copies the week from `p_from` (its first club day) to the week after it, `p_to`: each shift a week later, the job
-- title as the staff member holds it now, for staff still active, on days not yet past, and none that would overlap
-- one already there. Refusals: 42501; 22023 `p_to` not a week after `p_from`. Gives how many it copied.
create function private.copy_roster_week(p_venue_id uuid, p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copied integer;
begin
  perform private.assert_rosters(p_venue_id);
  perform pg_advisory_xact_lock(hashtextextended('roster:' || p_venue_id::text, 0));
  if p_from is null or p_to is distinct from p_from + 7 then
    raise exception 'A week into the week after it' using errcode = '22023';
  end if;
  insert into public.staff_shift (venue_id, staff_id, club_day, starts_at, ends_at, job_title, created_by_staff_id)
  select p_venue_id, h.staff_id, h.club_day + (p_to - p_from), h.starts_at + (p_to - p_from) * interval '1 day',
         h.ends_at + (p_to - p_from) * interval '1 day', s.job_title, private.current_staff_id(p_venue_id)
  from public.staff_shift h join public.staff s on s.id = h.staff_id and s.is_active
  where h.venue_id = p_venue_id and h.club_day >= p_from and h.club_day < p_from + 7 and h.club_day + 7 >= private.club_day_now()
    and not exists (select 1 from public.staff_shift o where o.staff_id = h.staff_id
                    and o.starts_at < h.ends_at + (p_to - p_from) * interval '1 day'
                    and h.starts_at + (p_to - p_from) * interval '1 day' < o.ends_at);
  get diagnostics v_copied = row_count;
  return v_copied;
end;
$$;

-- A week's roster from `p_week` (its first club day), by job title and name: each shift with its attendance, if
-- recorded. For staff who manage staff.
create function private.roster_week(p_venue_id uuid, p_week date)
returns table (shift_id uuid, staff_id uuid, full_name text, job_title text, club_day date, starts_at timestamptz, ends_at timestamptz,
               attendance text, note text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.staff_id, s.full_name, h.job_title, h.club_day, h.starts_at, h.ends_at, a.status, a.note
  from public.staff_shift h
  join public.staff s on s.id = h.staff_id
  left join public.staff_attendance a on a.shift_id = h.id
  where h.venue_id = p_venue_id and private.has_permission(p_venue_id, 'staff.manage')
    and h.club_day >= p_week and h.club_day < p_week + 7
  order by h.job_title, s.full_name, h.starts_at;
$$;

-- Records whether a shift was worked, once its club day has come: present, late or absent, with a note of up to 300
-- characters. A second recording corrects the first. The audit log keeps the status before and after, not the note.
-- Refusals: 22023 no such shift, a shift still to come, or no such status; 42501.
create function private.record_attendance(p_shift_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.staff_shift := (select h from public.staff_shift h where h.id = p_shift_id);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_before text := (select a.status from public.staff_attendance a where a.shift_id = p_shift_id);
  v_attendance_id uuid;
begin
  if v_shift.id is null then
    raise exception 'No such shift' using errcode = '22023';
  end if;
  perform private.assert_rosters(v_shift.venue_id);
  if v_shift.club_day > private.club_day_now()
     or p_status is null or p_status not in ('present', 'late', 'absent') or length(coalesce(v_note, '')) > 300 then
    raise exception 'A shift whose day has come, present, late or absent, and a short note' using errcode = '22023';
  end if;
  insert into public.staff_attendance (venue_id, shift_id, status, note, recorded_by_staff_id)
  values (v_shift.venue_id, p_shift_id, p_status, v_note, private.current_staff_id(v_shift.venue_id))
  on conflict (shift_id) do update set status = excluded.status, note = excluded.note,
    recorded_by_staff_id = excluded.recorded_by_staff_id, recorded_at = now()
  returning id into v_attendance_id;
  perform private.audit(v_shift.venue_id, 'staff.attendance', 'staff_attendance', v_attendance_id::text,
    case when v_before is not null then jsonb_build_object('shift_id', p_shift_id, 'status', v_before) end,
    jsonb_build_object('shift_id', p_shift_id, 'status', p_status));
end;
$$;

create function public.add_shifts(p_venue_id uuid, p_staff_ids uuid[], p_days date[], p_starts text, p_ends text)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.add_shifts(p_venue_id, p_staff_ids, p_days, p_starts, p_ends); $$;
create function public.remove_shift(p_shift_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.remove_shift(p_shift_id); $$;
create function public.copy_roster_week(p_venue_id uuid, p_from date, p_to date)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.copy_roster_week(p_venue_id, p_from, p_to); $$;
create function public.roster_week(p_venue_id uuid, p_week date)
returns table (shift_id uuid, staff_id uuid, full_name text, job_title text, club_day date, starts_at timestamptz, ends_at timestamptz,
               attendance text, note text)
language sql stable security invoker set search_path = ''
as $$ select * from private.roster_week(p_venue_id, p_week); $$;
create function public.record_attendance(p_shift_id uuid, p_status text, p_note text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_attendance(p_shift_id, p_status, p_note); $$;

revoke execute on function private.assert_rosters(uuid), private.club_day_now(), private.shift_times(date, text, text) from public, anon, authenticated;
revoke execute on function private.add_shifts(uuid, uuid[], date[], text, text), private.remove_shift(uuid), private.copy_roster_week(uuid, date, date),
  private.roster_week(uuid, date), private.record_attendance(uuid, text, text),
  public.add_shifts(uuid, uuid[], date[], text, text), public.remove_shift(uuid), public.copy_roster_week(uuid, date, date),
  public.roster_week(uuid, date), public.record_attendance(uuid, text, text)
  from public, anon;
grant execute on function private.add_shifts(uuid, uuid[], date[], text, text), private.remove_shift(uuid), private.copy_roster_week(uuid, date, date),
  private.roster_week(uuid, date), private.record_attendance(uuid, text, text),
  public.add_shifts(uuid, uuid[], date[], text, text), public.remove_shift(uuid), public.copy_roster_week(uuid, date, date),
  public.roster_week(uuid, date), public.record_attendance(uuid, text, text)
  to authenticated;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
