-- Removed staff, shown apart from those still working (the owner, 8 Nov). Staff are never deleted: their login is turned
-- off (is_active), and the audit log (staff_audit) keeps who did it and when. Staff who manage staff read that here; an
-- admin has no audit.read of their own.

-- Each staff member of the venue whose login is off now: when it was last turned off, and by whom (their name at the
-- venue, or null for a change no staff login made, such as a migration). Nothing for anyone without staff.manage.
create function private.staff_removals(p_venue_id uuid)
returns table (staff_id uuid, removed_at timestamptz, removed_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (st.id) st.id, a.occurred_at,
         (select s.full_name from public.staff s where s.user_id = a.actor_user_id and s.venue_id = p_venue_id)
  from public.staff st
  join public.audit_log a on a.entity = 'staff' and a.entity_id = st.id::text and a.venue_id = p_venue_id and a.action = 'update'
   and (a.before ->> 'is_active')::boolean and not (a.after ->> 'is_active')::boolean
  where st.venue_id = p_venue_id and not st.is_active and coalesce(private.has_permission(p_venue_id, 'staff.manage'), false)
  order by st.id, a.occurred_at desc;
$$;
create function public.staff_removals(p_venue_id uuid)
returns table (staff_id uuid, removed_at timestamptz, removed_by text)
language sql stable security invoker set search_path = ''
as $$ select * from private.staff_removals(p_venue_id); $$;

revoke execute on function private.staff_removals(uuid), public.staff_removals(uuid) from public, anon;
grant execute on function private.staff_removals(uuid), public.staff_removals(uuid) to authenticated;
