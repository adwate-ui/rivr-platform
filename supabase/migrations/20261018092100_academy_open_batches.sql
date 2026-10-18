-- The Academy batches a member can book (#8): open, not started on the venue's calendar, with the seats
-- left and the fee in force. Members cannot read other members' bookings, so the count comes from here.
create function private.academy_open_batches()
returns table (id uuid, name text, starts_on date, ends_on date, seats_left integer, fee bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.starts_on, b.ends_on,
         (b.seats - coalesce((select sum(k.seats) from public.academy_booking k
                              where k.batch_id = b.id and k.status <> 'cancelled'), 0))::integer,
         private.academy_price(b.venue_id, 'individual')
  from public.academy_batch b join public.venue v on v.id = b.venue_id
  where b.venue_id = private.current_member_venue_id() and b.is_open
    and b.starts_on >= (now() at time zone v.time_zone)::date
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
