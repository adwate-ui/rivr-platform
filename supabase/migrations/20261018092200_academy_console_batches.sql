-- A venue's Academy batches as the console shows them (#8), with the seats taken counted as the
-- database counts them for bookings (private.academy_seats_taken: paid and claimed, and unpaid for 48
-- hours), so the console never counts seats its own way. For Academy staff and for the cage, which
-- needs to know what a payment is for. Batches hold no money and no personal data.
create function private.staff_academy_batches(p_venue_id uuid)
returns table (id uuid, name text, starts_on date, ends_on date, seats integer, is_open boolean, seats_taken integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.starts_on, b.ends_on, b.seats, b.is_open, private.academy_seats_taken(b.id)
  from public.academy_batch b
  where b.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'members.manage') or private.has_permission(p_venue_id, 'cage.transact'))
  order by b.starts_on, b.name;
$$;

grant execute on function private.staff_academy_batches(uuid) to authenticated;

-- Signed-in callers reach it only through this invoker wrapper.
create function public.staff_academy_batches(p_venue_id uuid)
returns table (id uuid, name text, starts_on date, ends_on date, seats integer, is_open boolean, seats_taken integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.staff_academy_batches(p_venue_id);
$$;

grant execute on function public.staff_academy_batches(uuid) to authenticated;
