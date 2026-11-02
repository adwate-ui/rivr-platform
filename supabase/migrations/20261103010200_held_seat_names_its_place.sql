-- A seat held for a waitlist call names its place (decision 0302; the workflow audit of 2 Nov), so the live floor seats
-- the member there in one press, as the waitlist does.

-- As 20261019091800_seat_sessions.sql made it, with the waitlist place the seat is held for.
drop function public.held_seats(uuid);
drop function private.held_seats(uuid);
create function private.held_seats(p_venue_id uuid)
returns table (table_id uuid, seat integer, full_name text, hold_until timestamptz, entry_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select e.call_table_id, e.call_seat, m.full_name, e.hold_until, e.id
  from public.waitlist_entry e
  join public.member m on m.id = e.member_id
  where e.venue_id = p_venue_id and e.status = 'waiting' and e.called_at is not null
    and private.has_permission(p_venue_id, 'members.read')
  order by e.call_table_id, e.call_seat;
$$;
create function public.held_seats(p_venue_id uuid)
returns table (table_id uuid, seat integer, full_name text, hold_until timestamptz, entry_id uuid)
language sql stable security invoker set search_path = ''
as $$ select * from private.held_seats(p_venue_id); $$;

revoke execute on function private.held_seats(uuid), public.held_seats(uuid) from public, anon;
grant execute on function private.held_seats(uuid), public.held_seats(uuid) to authenticated;
