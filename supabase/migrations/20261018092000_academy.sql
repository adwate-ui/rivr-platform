-- RIVR Academy batches, bookings and their UPI payments (#8; scope-v1 module 15). A member books a
-- seat in an open batch at the venue's individual fee; staff book a company's heads at the corporate
-- fee per head. The player pays the club's UPI and enters the UTR; a cashier confirms it against the
-- bank, and only then is the money in the ledger (bank in, Academy fees) and academy.booked emitted.
-- Fees come from the academy.price setting, in paise. Whether they include GST is question #217.

-- The club's UPI check could never run: Postgres allows at most 255 repeats, and it asked for 256.
-- Academy fees are paid to this address, so it is the first one stored.
alter table public.venue_config
  drop constraint venue_config_upi_vpa_check,
  add constraint venue_config_upi_vpa_check check (upi_vpa ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$');

insert into public.setting_key (key, description, scope, value_schema) values
  ('academy.price',
   'Academy fees in paise: one seat, and per head in a corporate booking (scope-v1 module 15).',
   'venue',
   '{"type":"object","properties":{"individual_paise":{"type":"integer","minimum":1,"maximum":10000000},"corporate_per_head_paise":{"type":"integer","minimum":1,"maximum":10000000}},"required":["individual_paise","corporate_per_head_paise"],"additionalProperties":false}');

create table public.academy_batch (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(trim(name)) between 1 and 100),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  seats integer not null check (seats between 1 and 500),
  -- Open for booking until staff close it.
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id)
);

comment on table public.academy_batch is 'An Academy batch: its dates and seats.';

create table public.academy_booking (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  batch_id uuid not null,
  -- The member who booked, or for a corporate booking the company's contact.
  member_id uuid not null,
  kind text not null check (kind in ('individual', 'corporate')),
  company_name text check (length(trim(company_name)) between 1 and 200),
  seats integer not null check (seats between 1 and 100),
  -- In paise, fixed when booked from the academy.price setting then in force.
  amount bigint not null check (amount > 0),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'payment_claimed', 'paid', 'cancelled')),
  -- The UPI transaction reference the payer gave.
  utr text check (utr ~ '^[0-9]{12}$'),
  claimed_at timestamptz,
  paid_at timestamptz,
  confirmed_by_staff_id uuid references public.staff (id),
  ledger_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, venue_id) references public.academy_batch (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  check ((kind = 'individual') = (company_name is null)),
  check (kind = 'corporate' or seats = 1),
  check (status not in ('payment_claimed', 'paid') or utr is not null),
  check ((status = 'paid') = (paid_at is not null and confirmed_by_staff_id is not null and ledger_transaction_id is not null))
);

comment on table public.academy_booking is 'A booking for an Academy batch and the UPI payment for it.';

create index academy_batch_venue_id_idx on public.academy_batch (venue_id, starts_on);
create index academy_booking_venue_id_idx on public.academy_booking (venue_id, status);
create index academy_booking_batch_id_idx on public.academy_booking (batch_id, venue_id);
create index academy_booking_member_id_idx on public.academy_booking (member_id, venue_id);
create index academy_booking_confirmed_by_idx on public.academy_booking (confirmed_by_staff_id);
create index academy_booking_ledger_transaction_idx on public.academy_booking (ledger_transaction_id, venue_id);
-- One UTR pays one booking; one live seat per member per batch.
create unique index academy_booking_utr_key on public.academy_booking (venue_id, utr) where utr is not null;
create unique index academy_booking_one_seat_key on public.academy_booking (batch_id, member_id)
  where kind = 'individual' and status <> 'cancelled';

create trigger academy_batch_touch_updated_at before update on public.academy_batch
  for each row execute function private.touch_updated_at();
create trigger academy_batch_audit after insert or update or delete on public.academy_batch
  for each row execute function private.audit_row_change();
create trigger academy_booking_touch_updated_at before update on public.academy_booking
  for each row execute function private.touch_updated_at();
create trigger academy_booking_audit after insert or update or delete on public.academy_booking
  for each row execute function private.audit_row_change();

alter table public.academy_batch enable row level security;
alter table public.academy_booking enable row level security;
-- Reads only: every write goes through the functions below.
grant select on public.academy_batch, public.academy_booking to authenticated;

create policy "members see their venue's open batches" on public.academy_batch
  for select to authenticated
  using (is_open and venue_id = (select private.current_member_venue_id()));

create policy "academy staff see the venue's batches" on public.academy_batch
  for select to authenticated
  using (venue_id in (select private.venues_where('members.manage')));

create policy "members see their own bookings" on public.academy_booking
  for select to authenticated
  using (member_id = (select private.current_member_id()));

create policy "academy and cage staff see the venue's bookings" on public.academy_booking
  for select to authenticated
  using (venue_id in (select private.venues_where('members.manage'))
         or venue_id in (select private.venues_where('cage.transact')));

-- The fee in force at the venue for a kind of booking, per seat, in paise; null when none is set.
create function private.academy_price(p_venue_id uuid, p_kind text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (private.setting_at(p_venue_id, 'academy.price', '', now())
          -> case when p_kind = 'corporate' then 'corporate_per_head_paise' else 'individual_paise' end)::bigint;
$$;

-- A batch locked for a booking: open, not started on the venue's calendar, with enough seats left.
create function private.lock_academy_batch(p_batch_id uuid, p_venue_id uuid, p_seats integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.academy_batch b join public.venue v on v.id = b.venue_id
  where b.id = p_batch_id and b.venue_id = p_venue_id and b.is_open
    and b.starts_on >= (now() at time zone v.time_zone)::date
  for update of b;
  if not found then
    raise exception 'This batch is not open for booking' using errcode = 'RVBAT';
  end if;
  if (select b.seats - coalesce(sum(k.seats) filter (where k.status <> 'cancelled'), 0)
      from public.academy_batch b left join public.academy_booking k on k.batch_id = b.id
      where b.id = p_batch_id group by b.seats) < p_seats then
    raise exception 'This batch is full' using errcode = 'RVFUL';
  end if;
end;
$$;

-- The signed-in member books a seat in an open batch, at the individual fee. Booking again returns
-- the same booking. Gated by the academy.booking feature.
create function private.book_academy(p_batch_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
  v_booking_id uuid;
  v_price bigint;
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'academy.booking') then
    raise exception 'Academy booking is not open to this member' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, null, v_member_id);
  select k.id into v_booking_id from public.academy_booking k
  where k.batch_id = p_batch_id and k.member_id = v_member_id and k.kind = 'individual' and k.status <> 'cancelled';
  if v_booking_id is not null then return v_booking_id; end if;
  perform private.lock_academy_batch(p_batch_id, v_venue_id, 1);
  v_price := private.academy_price(v_venue_id, 'individual');
  if v_price is null then
    raise exception 'Academy fees are not set' using errcode = 'RVPRC';
  end if;
  insert into public.academy_booking (venue_id, batch_id, member_id, kind, seats, amount)
  values (v_venue_id, p_batch_id, v_member_id, 'individual', 1, v_price)
  returning id into v_booking_id;
  return v_booking_id;
end;
$$;

-- What the member pays and where: the amount and the club's UPI, for their own unpaid booking.
create function private.academy_payment_details(p_booking_id uuid)
returns table (amount bigint, upi_vpa text, upi_payee_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select k.amount, c.upi_vpa, c.upi_payee_name
  from public.academy_booking k join public.venue_config c on c.venue_id = k.venue_id
  where k.id = p_booking_id and k.member_id = private.current_member_id()
    and k.status in ('awaiting_payment', 'payment_claimed');
$$;

-- The member says they paid, with the UPI reference; they may correct it until a cashier confirms.
create function private.claim_academy_payment(p_booking_id uuid, p_utr text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_utr !~ '^[0-9]{12}$' then
    raise exception 'A UTR is 12 digits' using errcode = '22023';
  end if;
  update public.academy_booking k
  set status = 'payment_claimed', utr = p_utr, claimed_at = now()
  where k.id = p_booking_id and k.member_id = private.current_member_id()
    and k.status in ('awaiting_payment', 'payment_claimed');
  if not found then
    raise exception 'No unpaid booking of yours' using errcode = '42501';
  end if;
end;
$$;

-- A cashier saw the UPI payment in the bank: the booking is paid, the ledger takes the money (bank
-- in, Academy fees), and academy.booked goes out. Confirming twice changes nothing.
create function private.confirm_academy_payment(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.academy_booking;
  v_transaction_id uuid;
begin
  select * into v_booking from public.academy_booking k where k.id = p_booking_id for update;
  if v_booking.id is null or not private.has_permission(v_booking.venue_id, 'cage.transact') then
    raise exception 'Only the cage confirms a payment' using errcode = '42501';
  end if;
  if v_booking.status = 'paid' then return v_booking.ledger_transaction_id; end if;
  if v_booking.status <> 'payment_claimed' then
    raise exception 'This booking has no payment to confirm' using errcode = 'RVPAY';
  end if;
  insert into public.ledger_account (venue_id, code, name, kind, unit)
  values (v_booking.venue_id, 'venue.academy', 'Academy fees', 'revenue', 'paise')
  on conflict (venue_id, code, member_id) do nothing;
  v_transaction_id := private.post_ledger_transaction(
    v_booking.venue_id, 'academy_fee', 'academy.paid:' || v_booking.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                        where a.venue_id = v_booking.venue_id and a.code = 'venue.bank' and a.member_id is null),
                         'amount', v_booking.amount),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                        where a.venue_id = v_booking.venue_id and a.code = 'venue.academy' and a.member_id is null),
                         'amount', -v_booking.amount)),
    null, 'Academy booking ' || v_booking.id || ', UTR ' || v_booking.utr);
  update public.academy_booking
  set status = 'paid', paid_at = now(), confirmed_by_staff_id = private.current_staff_id(v_booking.venue_id),
      ledger_transaction_id = v_transaction_id
  where id = v_booking.id;
  perform private.emit(v_booking.venue_id, 'academy.booked', jsonb_build_object(
    'booking_id', v_booking.id, 'member_id', v_booking.member_id, 'batch_id', v_booking.batch_id,
    'kind', v_booking.kind, 'seats', v_booking.seats, 'amount_paise', v_booking.amount), 'academy.booked:' || v_booking.id);
  return v_transaction_id;
end;
$$;

-- Staff open a batch.
create function private.create_academy_batch(p_venue_id uuid, p_name text, p_starts_on date, p_ends_on date, p_seats integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
begin
  if not private.has_permission(p_venue_id, 'members.manage') then
    raise exception 'Only Academy staff open a batch' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.academy_batch (venue_id, name, starts_on, ends_on, seats)
  values (p_venue_id, trim(p_name), p_starts_on, p_ends_on, p_seats)
  returning id into v_batch_id;
  return v_batch_id;
end;
$$;

-- Staff book a company's heads at the corporate fee per head, under a member as the contact, with
-- the UTR when the company has already paid.
create function private.book_academy_corporate(p_batch_id uuid, p_member_id uuid, p_company_name text, p_seats integer, p_utr text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_price bigint;
  v_booking_id uuid;
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'members.manage') then
    raise exception 'Only Academy staff book for a company' using errcode = '42501';
  end if;
  if p_utr is not null and p_utr !~ '^[0-9]{12}$' then
    raise exception 'A UTR is 12 digits' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id);
  perform private.lock_academy_batch(p_batch_id, v_venue_id, p_seats);
  v_price := private.academy_price(v_venue_id, 'corporate');
  if v_price is null then
    raise exception 'Academy fees are not set' using errcode = 'RVPRC';
  end if;
  insert into public.academy_booking (venue_id, batch_id, member_id, kind, company_name, seats, amount, status, utr, claimed_at)
  values (v_venue_id, p_batch_id, p_member_id, 'corporate', trim(p_company_name), p_seats, v_price * p_seats,
          case when p_utr is null then 'awaiting_payment' else 'payment_claimed' end, p_utr,
          case when p_utr is null then null else now() end)
  returning id into v_booking_id;
  return v_booking_id;
end;
$$;

grant execute on function private.book_academy(uuid), private.academy_payment_details(uuid),
  private.claim_academy_payment(uuid, text), private.confirm_academy_payment(uuid),
  private.create_academy_batch(uuid, text, date, date, integer),
  private.book_academy_corporate(uuid, uuid, text, integer, text)
  to authenticated;

-- Signed-in callers reach the functions above only through these invoker wrappers.
create function public.book_academy(p_batch_id uuid) returns uuid language sql security invoker set search_path = ''
as $$ select private.book_academy(p_batch_id); $$;
create function public.academy_payment_details(p_booking_id uuid)
returns table (amount bigint, upi_vpa text, upi_payee_name text) language sql security invoker set search_path = ''
as $$ select * from private.academy_payment_details(p_booking_id); $$;
create function public.claim_academy_payment(p_booking_id uuid, p_utr text) returns void language sql security invoker set search_path = ''
as $$ select private.claim_academy_payment(p_booking_id, p_utr); $$;
create function public.confirm_academy_payment(p_booking_id uuid) returns uuid language sql security invoker set search_path = ''
as $$ select private.confirm_academy_payment(p_booking_id); $$;
create function public.create_academy_batch(p_venue_id uuid, p_name text, p_starts_on date, p_ends_on date, p_seats integer)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_academy_batch(p_venue_id, p_name, p_starts_on, p_ends_on, p_seats); $$;
create function public.book_academy_corporate(p_batch_id uuid, p_member_id uuid, p_company_name text, p_seats integer, p_utr text default null)
returns uuid language sql security invoker set search_path = ''
as $$ select private.book_academy_corporate(p_batch_id, p_member_id, p_company_name, p_seats, p_utr); $$;

grant execute on function public.book_academy(uuid), public.academy_payment_details(uuid),
  public.claim_academy_payment(uuid, text), public.confirm_academy_payment(uuid),
  public.create_academy_batch(uuid, text, date, date, integer),
  public.book_academy_corporate(uuid, uuid, text, integer, text)
  to authenticated;
