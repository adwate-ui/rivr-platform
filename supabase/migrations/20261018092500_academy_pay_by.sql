-- When an unpaid Academy seat stops being held (#247, the owner's answer to #220). The 48-hour hold
-- now lives in one function, read by the seat count and by the member's own bookings, which carry the
-- time the seat stops being held so the app can say "pay by". A late payer is still seated (#220).

create function private.academy_seat_hold()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '48 hours';
$$;

-- As before (20261018092000), with the hold from the one function.
create or replace function private.academy_seats_taken(p_batch_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(k.seats), 0)::integer from public.academy_booking k
  where k.batch_id = p_batch_id
    and (k.status in ('payment_claimed', 'paid')
         or (k.status = 'awaiting_payment' and k.created_at > now() - private.academy_seat_hold()));
$$;

-- The member's own bookings (20261018092100), now with hold_until: when an unpaid seat stops being
-- held, null once a UTR is given or the seat is paid.
drop function public.my_academy_bookings();
drop function private.my_academy_bookings();

create function private.my_academy_bookings()
returns table (
  id uuid, batch_id uuid, batch_name text, starts_on date, ends_on date, status text, amount bigint, utr text,
  turned_down_utr text, hold_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, k.batch_id, b.name, b.starts_on, b.ends_on, k.status, k.amount, k.utr, k.turned_down_utr,
         case when k.status = 'awaiting_payment' then k.created_at + private.academy_seat_hold() end
  from public.academy_booking k join public.academy_batch b on b.id = k.batch_id
  where k.member_id = private.current_member_id() and k.kind = 'individual' and k.status <> 'cancelled'
  order by b.starts_on, b.name;
$$;

create function public.my_academy_bookings()
returns table (
  id uuid, batch_id uuid, batch_name text, starts_on date, ends_on date, status text, amount bigint, utr text,
  turned_down_utr text, hold_until timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.my_academy_bookings();
$$;

grant execute on function private.my_academy_bookings() to authenticated;
grant execute on function public.my_academy_bookings() to authenticated;
