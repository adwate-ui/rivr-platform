-- Two ways someone inside the club could misuse a turned-down Academy payment (#222, from the
-- security review of #8).
-- 1. A cashier turns down a member's genuine UTR, which frees it; an accomplice gives it on their own
--    booking, and it is confirmed there. Every turn-down is now kept, with who made it, and never
--    changed. Nobody confirms a UTR they turned down on another booking, and a UTR turned down on
--    another member's booking, or where a company's booking is either side, is confirmed only by a
--    manager who also works the cage (members.manage with cage.transact: the owner and general
--    manager), who checks whose money it is.
-- 2. After the 48-hour hold a UTR is always recorded (#220), so a made-up one given again and again
--    could keep a batch over its seats. A UTR given after the hold now stays until the cage checks it,
--    and if the cage turns it down the booking is cancelled; the member still sees it, and why
--    (question #257). A UTR given within the hold works as before.

-- Every UTR the cage turned down, on which booking, and by whom.
create table public.academy_utr_rejection (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  booking_id uuid not null references public.academy_booking (id),
  utr text not null check (utr ~ '^[0-9]{12}$'),
  rejected_by_staff_id uuid not null references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.academy_utr_rejection is 'A UTR the cage could not find in the bank, on which booking, and who turned it down.';

create index academy_utr_rejection_utr_idx on public.academy_utr_rejection (venue_id, utr);
create index academy_utr_rejection_booking_id_idx on public.academy_utr_rejection (booking_id);
create index academy_utr_rejection_staff_idx on public.academy_utr_rejection (rejected_by_staff_id);

-- A turn-down is kept as made: changing or removing one would quietly allow the confirmation it
-- blocks. Purge (lane A) needs its own exception, as the ledger has.
create trigger academy_utr_rejection_append_only before update or delete on public.academy_utr_rejection
  for each row execute function private.refuse_change();
create trigger academy_utr_rejection_no_truncate before truncate on public.academy_utr_rejection
  for each statement execute function private.refuse_change();
create trigger academy_utr_rejection_audit after insert on public.academy_utr_rejection
  for each row execute function private.audit_row_change();

alter table public.academy_utr_rejection enable row level security;
grant select on public.academy_utr_rejection to authenticated;

create policy "cage staff see the venue's turned-down UTRs" on public.academy_utr_rejection
  for select to authenticated
  using (venue_id in (select private.venues_where('cage.transact')));

-- The turned-down UTR is kept on a seat the turn-down cancels too, so the member sees which one. A
-- seat staff cancel keeps none: only the cage's cancellation is shown to the member, with its UTR.
create or replace function private.keep_turned_down_utr()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'payment_claimed' and new.status in ('awaiting_payment', 'cancelled') then
    new.turned_down_utr := old.utr;
  elsif new.utr is not null or (old.status = 'awaiting_payment' and new.status = 'cancelled') then
    new.turned_down_utr := null;
  end if;
  return new;
end;
$$;

create or replace function private.reject_academy_payment(p_booking_id uuid, p_utr text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.academy_booking;
  v_lapsed boolean;
begin
  select * into v_booking from public.academy_booking k where k.id = p_booking_id for update;
  if v_booking.id is null or not private.has_permission(v_booking.venue_id, 'cage.transact')
     or v_booking.member_id = private.current_member_id() then
    raise exception 'Only the cage turns down a payment, never for its own booking' using errcode = '42501';
  end if;
  if v_booking.status <> 'payment_claimed' then
    raise exception 'This booking has no payment to turn down' using errcode = 'RVPAY';
  end if;
  if v_booking.utr is distinct from p_utr then
    raise exception 'The UTR searched for is not the one on this booking' using errcode = 'RVUTM';
  end if;
  perform private.assert_writable(v_booking.venue_id);
  insert into public.academy_utr_rejection (venue_id, booking_id, utr, rejected_by_staff_id)
  values (v_booking.venue_id, v_booking.id, v_booking.utr, private.current_staff_id(v_booking.venue_id));
  -- A UTR given after the hold gives the seat up; one given within it puts the seat back to unpaid,
  -- held as before. The same for a company's booking, whose UTR staff record.
  v_lapsed := v_booking.claimed_at > v_booking.created_at + private.academy_seat_hold();
  update public.academy_booking
  set status = case when v_lapsed then 'cancelled' else 'awaiting_payment' end,
      utr = null, claimed_at = null, recorded_by_staff_id = null
  where id = v_booking.id;
end;
$$;

create or replace function private.confirm_academy_payment(p_booking_id uuid, p_utr text)
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
  if v_booking.id is null or not private.has_permission(v_booking.venue_id, 'cage.transact')
     or v_booking.member_id = private.current_member_id() then
    raise exception 'Only the cage confirms a payment, never for its own booking' using errcode = '42501';
  end if;
  if v_booking.status = 'paid' then return v_booking.ledger_transaction_id; end if;
  if v_booking.recorded_by_staff_id = private.current_staff_id(v_booking.venue_id) then
    raise exception 'A payment is confirmed by someone other than the staff who recorded it' using errcode = '42501';
  end if;
  -- A UTR turned down on another booking: never confirmed by whoever turned it down (any of their
  -- staff records, at any venue), and, if that booking was another member's or either is a company's
  -- (whose contact is not the payer), only by a manager who checks whose money it is (cashiers do not
  -- manage members).
  if exists (select 1 from public.academy_utr_rejection r join public.academy_booking k on k.id = r.booking_id
             where r.utr = p_utr and r.booking_id <> v_booking.id and k.is_practice = v_booking.is_practice
               and (r.rejected_by_staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid()))
                    or ((k.member_id <> v_booking.member_id or k.kind = 'corporate' or v_booking.kind = 'corporate')
                        and not private.has_permission(v_booking.venue_id, 'members.manage')))) then
    raise exception 'A UTR turned down on another booking is confirmed by someone else, and by a manager if another member''s'
      using errcode = '42501';
  end if;
  if v_booking.status <> 'payment_claimed' then
    raise exception 'This booking has no payment to confirm' using errcode = 'RVPAY';
  end if;
  if v_booking.utr is distinct from p_utr then
    raise exception 'The UTR found in the bank is not the one on this booking' using errcode = 'RVUTM';
  end if;
  perform private.assert_writable(v_booking.venue_id, null, v_booking.member_id);
  v_transaction_id := private.post_ledger_transaction(
    v_booking.venue_id, 'academy_fee', 'academy.paid:' || v_booking.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                        where a.venue_id = v_booking.venue_id and a.code = 'venue.bank' and a.member_id is null),
                         'amount', v_booking.amount),
      jsonb_build_object('account_id', private.academy_account(v_booking.venue_id), 'amount', -v_booking.amount)),
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

-- After the hold, a UTR given stays until the cage checks it: changing it again and again would keep
-- the seat however many the cage turns down (#222).
create or replace function private.claim_academy_payment(p_booking_id uuid, p_utr text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.academy_booking;
begin
  if p_utr is null or p_utr !~ '^[0-9]{12}$' then
    raise exception 'A UTR is 12 digits' using errcode = '22023';
  end if;
  select * into v_booking from public.academy_booking k
  where k.id = p_booking_id and k.member_id = private.current_member_id() and k.kind = 'individual'
    and k.status in ('awaiting_payment', 'payment_claimed')
  for update;
  if v_booking.id is null or not private.has_feature(v_booking.member_id, 'academy.booking') then
    raise exception 'No unpaid booking of yours' using errcode = '42501';
  end if;
  if v_booking.status = 'payment_claimed' and v_booking.created_at + private.academy_seat_hold() <= now() then
    raise exception 'After the hold, a UTR given stays until the cage checks it' using errcode = 'RVLCK';
  end if;
  perform private.assert_writable(v_booking.venue_id, null, v_booking.member_id);
  begin
    update public.academy_booking set status = 'payment_claimed', utr = p_utr, claimed_at = now(), recorded_by_staff_id = null
    where id = v_booking.id;
  exception when unique_violation then
    raise exception 'This UTR was already given for another booking' using errcode = 'RVUTR';
  end;
end;
$$;

-- A member's seats, and a seat the cage cancelled when it turned down a UTR after the hold, so the
-- member sees what happened to it.
create or replace function private.my_academy_bookings()
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
  where k.member_id = private.current_member_id() and k.kind = 'individual'
    and (k.status <> 'cancelled' or k.turned_down_utr is not null)
  order by b.starts_on, b.name;
$$;
