-- Onboarding checklists (#107; scope-v1 module 10: "onboarding checklist per hire linked to SOP
-- acknowledgements"; decision 0212). A hire's checklist is the SOPs whose version in force asks their
-- role, and an item ticks when the hire acknowledges that version. Nothing new is stored, and nothing of
-- lane B's is read but through its contract (docs/contracts/lane-b.md): the SOP library gives each SOP's
-- version in force, and its acknowledgements the active staff that version asks, with when each did. A
-- new version asks again, so its item reopens until the hire acknowledges it, the library's own rule (the
-- safest reading, question #483).

-- Each active staff member's checklist at a venue, for staff who manage staff (42501 otherwise): every
-- SOP in force that asks their role, its version, and when they acknowledged that version.
create function private.onboarding_checklists(p_venue_id uuid)
returns table (staff_id uuid, sop_id uuid, title text, version_id uuid, version integer, acknowledged_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'staff.manage') then
    raise exception 'Only staff managers at the venue see onboarding checklists' using errcode = '42501';
  end if;
  return query
  -- Materialized, so an SOP whose first day is still to come (no version in force, on no checklist yet)
  -- is left out before its acknowledgements are asked for.
  with in_force as materialized (
    select l.sop_id, l.title, l.version_id, l.version from public.sop_library(p_venue_id) l where l.version_id is not null
  )
  select a.staff_id, f.sop_id, f.title, f.version_id, f.version, a.acknowledged_at
  from in_force f
  cross join lateral public.sop_acknowledgements(f.version_id) a
  order by a.full_name, a.staff_id, f.title;
end;
$$;

create function public.onboarding_checklists(p_venue_id uuid)
returns table (staff_id uuid, sop_id uuid, title text, version_id uuid, version integer, acknowledged_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.onboarding_checklists(p_venue_id); $$;

revoke execute on function private.onboarding_checklists(uuid), public.onboarding_checklists(uuid) from public, anon;
grant execute on function private.onboarding_checklists(uuid), public.onboarding_checklists(uuid) to authenticated;
