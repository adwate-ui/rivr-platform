-- The Academy batches a member can book (#8): open, not started on the venue's calendar, with the seats
-- left (as private.academy_seats_taken counts them) and the fee in force. Members cannot read other
-- members' bookings, so the count comes from here. Only for members whose tier has Academy booking.
create function private.academy_open_batches()
returns table (id uuid, name text, starts_on date, ends_on date, seats_left integer, fee bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.starts_on, b.ends_on,
         greatest(b.seats - private.academy_seats_taken(b.id), 0),
         private.academy_fee('individual', 1, private.setting_at(b.venue_id, 'academy.price', '', now()))
  from public.academy_batch b join public.venue v on v.id = b.venue_id
  where b.venue_id = private.current_member_venue_id() and b.is_open
    and b.starts_on >= (now() at time zone v.time_zone)::date
    and private.has_feature(private.current_member_id(), 'academy.booking')
  order by b.starts_on, b.name;
$$;

grant execute on function private.academy_open_batches() to authenticated;

-- Signed-in callers reach it only through this invoker wrapper.
create function public.academy_open_batches()
returns table (id uuid, name text, starts_on date, ends_on date, seats_left integer, fee bigint)
language sql
security invoker
set search_path = ''
as $$
  select * from private.academy_open_batches();
$$;

grant execute on function public.academy_open_batches() to authenticated;
