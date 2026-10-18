-- What the player app reads for RIVR Academy (#8). Members cannot read other members' bookings, so the
-- seat count comes from academy_open_batches. A member's own bookings come from my_academy_bookings,
-- never from the table, whose staff policy would also hand the venue's bookings to a member who is
-- also staff. A UTR the cage turned down stays on the booking, so the member is told and never pays
-- twice for want of knowing.

-- The batches a member can book: open, not started on the venue's calendar, with the seats left (as
-- private.academy_seats_taken counts them) and the fee in force. Only for members whose tier has
-- Academy booking.
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

-- The last UTR the cage could not find in the bank. The trigger below keeps it for every way a UTR
-- changes: set when a claim is turned down, cleared when a UTR is given again.
alter table public.academy_booking add column turned_down_utr text check (turned_down_utr ~ '^[0-9]{12}$');

create function private.keep_turned_down_utr()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'payment_claimed' and new.status = 'awaiting_payment' then
    new.turned_down_utr := old.utr;
  elsif new.utr is not null then
    new.turned_down_utr := null;
  end if;
  return new;
end;
$$;

create trigger academy_booking_keep_turned_down_utr before update on public.academy_booking
  for each row execute function private.keep_turned_down_utr();

-- The signed-in member's own seats that are not cancelled, with their batch, also once it has closed
-- or started. A record of their money, so not gated by tier (decision 0033). A corporate booking is
-- the company's, never its contact's seat.
create function private.my_academy_bookings()
returns table (
  id uuid, batch_id uuid, batch_name text, starts_on date, ends_on date, status text, amount bigint, utr text,
  turned_down_utr text
)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, k.batch_id, b.name, b.starts_on, b.ends_on, k.status, k.amount, k.utr, k.turned_down_utr
  from public.academy_booking k join public.academy_batch b on b.id = k.batch_id
  where k.member_id = private.current_member_id() and k.kind = 'individual' and k.status <> 'cancelled'
  order by b.starts_on, b.name;
$$;

-- What the member pays and where, for their own unpaid seat. As in #218, and never a company's
-- booking, whose bill is not the contact's to pay.
create or replace function private.academy_payment_details(p_booking_id uuid)
returns table (amount bigint, upi_vpa text, upi_payee_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select k.amount, c.upi_vpa, c.upi_payee_name
  from public.academy_booking k join public.venue_config c on c.venue_id = k.venue_id
  where k.id = p_booking_id and k.member_id = private.current_member_id() and k.kind = 'individual'
    and k.status in ('awaiting_payment', 'payment_claimed')
    and private.has_feature(k.member_id, 'academy.booking');
$$;

grant execute on function private.academy_open_batches(), private.my_academy_bookings() to authenticated;

-- Signed-in callers reach them only through these invoker wrappers.
create function public.academy_open_batches()
returns table (id uuid, name text, starts_on date, ends_on date, seats_left integer, fee bigint)
language sql
security invoker
set search_path = ''
as $$
  select * from private.academy_open_batches();
$$;

create function public.my_academy_bookings()
returns table (
  id uuid, batch_id uuid, batch_name text, starts_on date, ends_on date, status text, amount bigint, utr text,
  turned_down_utr text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.my_academy_bookings();
$$;

grant execute on function public.academy_open_batches(), public.my_academy_bookings() to authenticated;
