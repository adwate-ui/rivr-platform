-- The website pauses for its own venue's freeze only (#609). It read every live venue's status, so a freeze on another
-- one, such as a venue being purged, which stays frozen, paused the club's site. Each venue's status now gives its
-- slug, which the site's pages carry, so the site matches its own. Neither the practice venue nor anything else changes.
drop view public.public_venue_status;
drop function private.public_venue_status_rows();

create function private.public_venue_status_rows()
returns table (venue_id uuid, venue_slug text, is_frozen boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.slug, exists (select 1 from public.control_state c
                               where c.venue_id = v.id and c.level = 'venue_freeze' and c.released_at is null)
  from public.venue v
  where not v.is_practice;
$$;

grant execute on function private.public_venue_status_rows() to anon, authenticated;

create view public.public_venue_status
with (security_invoker = true)
as
select venue_id, venue_slug, is_frozen from private.public_venue_status_rows();

grant select on public.public_venue_status to anon, authenticated;
