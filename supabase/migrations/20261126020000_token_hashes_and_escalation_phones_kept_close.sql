-- Two reads every staff sign-in still had (#1015; guest relations were shut out by 20261118101100):
--
-- A device's token hash. No app reads it: the cage computer and the tablets are matched by functions that run as their
-- owner. Signed-in callers now read every device column but the hash, row by row as the policies allow.
--
-- The escalation matrix: the owner's and managers' own mobile numbers. No screen or function reads the contacts any more;
-- those who keep them, super admins and admins (`sops.manage`), still read every row. Every other role still reads the
-- police, the fire service, the electricity board, Glaza and the vendors, as before.

revoke select on public.device from authenticated;
grant select (id, venue_id, kind, name, auth_user_id, enrolled_at, enrolled_by_staff_id, revoked_at, revoked_reason, last_seen_at, created_at, updated_at)
  on public.device to authenticated;

alter policy "staff read their venue's contacts" on public.contact
  using ((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues))
         and (kind <> 'escalation' or venue_id in (select private.venues_where('sops.manage'))));
