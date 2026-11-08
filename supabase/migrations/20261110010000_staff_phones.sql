-- A colleague's mobile number reaches signed-in staff only through functions, for staff who manage staff (audit of
-- 8 Nov 2026: F-022; owner, 3 Nov: staff phones now). The table grant loses the phone column.

-- Every column but phone. A column added later needs its own grant; test 334 names the columns.
revoke select on public.staff from authenticated;
grant select (id, venue_id, user_id, full_name, job_title, role, is_active, created_at, updated_at) on public.staff to authenticated;

-- The active staff member with this mobile number, for the kill switch (control.engage): only the id goes back.
create function private.staff_id_for_phone(p_venue_id uuid, p_phone text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff s
  where s.venue_id = p_venue_id and s.phone = p_phone and s.is_active and private.has_permission(p_venue_id, 'control.engage')
  limit 1;
$$;

create function public.staff_id_for_phone(p_venue_id uuid, p_phone text)
returns uuid
language sql
stable
set search_path = ''
as $$ select private.staff_id_for_phone(p_venue_id, p_phone); $$;

-- The venue's staff, active first, then by name, to any of its staff (as the policy "staff see their colleagues" gives
-- the rows); each number only to staff who manage staff.
create function private.venue_staff(p_venue_id uuid)
returns table (staff_id uuid, full_name text, job_title text, role public.staff_role, phone text, is_active boolean,
               user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.job_title, s.role,
         case when private.has_permission(p_venue_id, 'staff.manage') then s.phone end,
         s.is_active, s.user_id
  from public.staff s
  where s.venue_id = p_venue_id and p_venue_id in (select private.staff_venues())
  order by s.is_active desc, s.full_name;
$$;

create function public.venue_staff(p_venue_id uuid)
returns table (staff_id uuid, full_name text, job_title text, role public.staff_role, phone text, is_active boolean,
               user_id uuid)
language sql
stable
set search_path = ''
as $$ select * from private.venue_staff(p_venue_id); $$;

revoke execute on function private.staff_id_for_phone(uuid, text), public.staff_id_for_phone(uuid, text),
  private.venue_staff(uuid), public.venue_staff(uuid) from public, anon;
grant execute on function private.staff_id_for_phone(uuid, text), public.staff_id_for_phone(uuid, text),
  private.venue_staff(uuid), public.venue_staff(uuid) to authenticated;
