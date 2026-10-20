-- Academy fees on GST invoices (#249; the owner's answers to #217 and #412; decision 0114). The fee includes
-- GST. When the cage confirms a booking's payment, the booking gets an invoice in the Academy's own
-- series (A) at the Academy's GST rate in force (academy.gst, question #431): to the member, or to the company under its GSTIN for a corporate
-- booking, with IGST when that GSTIN is another state's (#380). The ledger splits the fee as the invoice does:
-- bank in, Academy revenue at the taxable value, GST payable at the tax. The member reads the invoice in the
-- app and saves it as a PDF. A practice booking gets a practice invoice, whose invoice.issued never leaves.

alter table public.academy_booking
  add column company_gstin text check (company_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  add column invoice_id uuid references public.invoice (id),
  add constraint academy_booking_gstin_only_corporate check (company_gstin is null or kind = 'corporate'),
  add constraint academy_booking_invoice_once_paid check (invoice_id is null or status = 'paid');
create index academy_booking_invoice_idx on public.academy_booking (invoice_id);

-- The Academy's GST rate, apart from the rake's (decision 0071): 18% for every venue until the owner sets it
-- (question #431). A venue without one confirms no Academy payment.
insert into public.setting_key (key, description, scope, value_schema) values
  ('academy.gst',
   'GST on the Academy''s fees (decision 0114): the rate in basis points (1800 is 18%), taken out of the fee, kept apart from gst.config, the rake''s, as training may be taxed differently (question 431).',
   'venue',
   '{"type":"object","properties":{"rate_basis_points":{"type":"integer","minimum":0,"maximum":10000}},"required":["rate_basis_points"],"additionalProperties":false}');

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.id, 'academy.gst', '', '{"rate_basis_points": 1800}', '-infinity', 'A placeholder until the owner sets the Academy''s GST (question #431)'
from public.venue v
on conflict (venue_id, key, subject, effective_from) do nothing;

-- A venue made later starts on the same placeholder, as it does on gst.config's.
create function private.academy_gst_placeholder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (new.id, 'academy.gst', '', '{"rate_basis_points": 1800}', '-infinity', 'A placeholder until the owner sets the Academy''s GST (question #431)');
  return null;
end;
$$;
create trigger venue_academy_gst_placeholder after insert on public.venue
  for each row execute function private.academy_gst_placeholder();

-- GST charged and owed to the government, made on first use, as the Academy fees account is.
create function private.gst_payable_account(p_venue_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.ledger_account;
begin
  insert into public.ledger_account (venue_id, code, name, kind, unit)
  values (p_venue_id, 'venue.gst_payable', 'GST payable', 'liability', 'paise')
  on conflict (venue_id, code, member_id) do nothing;
  select * into v_account from public.ledger_account a
  where a.venue_id = p_venue_id and a.code = 'venue.gst_payable' and a.member_id is null;
  if v_account.kind <> 'liability' or v_account.unit <> 'paise' or v_account.is_players_money then
    raise exception 'venue.gst_payable is not a liability account in paise' using errcode = 'P0001';
  end if;
  return v_account.id;
end;
$$;

-- As in the Academy migration, with the company's GSTIN, which goes on its invoice.
drop function public.book_academy_corporate(uuid, uuid, text, integer, uuid);
drop function private.book_academy_corporate(uuid, uuid, text, integer, uuid);
create function private.book_academy_corporate(
  p_batch_id uuid, p_member_id uuid, p_company_name text, p_seats integer, p_request_id uuid, p_company_gstin text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_gstin text := nullif(upper(trim(p_company_gstin)), '');
  v_existing public.academy_booking;
  v_fee bigint;
  v_booking_id uuid;
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'members.manage')
     or p_member_id = private.current_member_id() then
    raise exception 'Only Academy staff book for a company, never for themselves' using errcode = '42501';
  end if;
  if p_request_id is null or p_seats is null or p_seats not between 1 and 100 then
    raise exception 'A corporate booking needs its request id and 1 to 100 heads' using errcode = '22023';
  end if;
  -- A retry sent at the same moment waits here, then finds the booking the first one made.
  perform pg_advisory_xact_lock(hashtext(p_request_id::text));
  select * into v_existing from public.academy_booking k where k.venue_id = v_venue_id and k.request_id = p_request_id;
  if v_existing.id is not null then
    if (v_existing.batch_id, v_existing.member_id, v_existing.company_name, v_existing.seats, v_existing.company_gstin)
       is distinct from (p_batch_id, p_member_id, trim(p_company_name), p_seats, v_gstin) then
      raise exception 'This request id was used for another booking' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;
  perform private.assert_writable(v_venue_id, null, p_member_id);
  perform private.lock_academy_batch(p_batch_id, v_venue_id, p_seats);
  v_fee := private.academy_fee('corporate', p_seats, private.setting_at(v_venue_id, 'academy.price', '', now()));
  if v_fee is null then
    raise exception 'Academy fees are not set' using errcode = 'RVPRC';
  end if;
  insert into public.academy_booking (venue_id, is_practice, batch_id, member_id, kind, company_name, company_gstin, seats, amount, request_id)
  values (v_venue_id, (select v.is_practice from public.venue v where v.id = v_venue_id), p_batch_id, p_member_id,
          'corporate', trim(p_company_name), v_gstin, p_seats, v_fee, p_request_id)
  returning id into v_booking_id;
  return v_booking_id;
end;
$$;

create function public.book_academy_corporate(
  p_batch_id uuid, p_member_id uuid, p_company_name text, p_seats integer, p_request_id uuid, p_company_gstin text default null
) returns uuid language sql security invoker set search_path = ''
as $$ select private.book_academy_corporate(p_batch_id, p_member_id, p_company_name, p_seats, p_request_id, p_company_gstin); $$;

-- As in the turn-downs migration (20261018092700), with the invoice and the fee split by it.
create or replace function private.confirm_academy_payment(p_booking_id uuid, p_utr text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.academy_booking;
  v_invoice public.invoice;
  v_rate integer;
  v_entries jsonb;
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
  v_rate := (private.setting_at(v_booking.venue_id, 'academy.gst', '', now()) ->> 'rate_basis_points')::integer;
  if v_rate is null then
    raise exception 'The Academy''s GST rate is not set' using errcode = 'RVGST';
  end if;
  -- The Academy's own series (#378, reading 5), made on first use, as its accounts are.
  insert into public.invoice_series (venue_id, code, name) values (v_booking.venue_id, 'A', 'Academy')
  on conflict (venue_id, code) do nothing;
  v_invoice := private.issue_invoice(v_booking.venue_id, 'A', 'academy:' || v_booking.id, v_booking.amount, v_rate,
    'Poker Academy, ' || (select b.name from public.academy_batch b where b.id = v_booking.batch_id)
      || case when v_booking.seats > 1 then ', ' || v_booking.seats || ' heads' else '' end,
    v_booking.member_id, v_booking.company_name, v_booking.company_gstin);
  -- Bank in; the Academy's revenue is the taxable value, and the tax is owed, both as the invoice holds them.
  v_entries := jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                      where a.venue_id = v_booking.venue_id and a.code = 'venue.bank' and a.member_id is null),
                       'amount', v_booking.amount),
    jsonb_build_object('account_id', private.academy_account(v_booking.venue_id), 'amount', -v_invoice.taxable_paise));
  if v_invoice.total_paise > v_invoice.taxable_paise then
    v_entries := v_entries || jsonb_build_array(jsonb_build_object('account_id', private.gst_payable_account(v_booking.venue_id),
                                                                   'amount', -(v_invoice.total_paise - v_invoice.taxable_paise)));
  end if;
  v_transaction_id := private.post_ledger_transaction(
    v_booking.venue_id, 'academy_fee', 'academy.paid:' || v_booking.id, v_entries,
    null, 'Academy booking ' || v_booking.id || ', UTR ' || v_booking.utr || ', invoice ' || v_invoice.number);
  update public.academy_booking
  set status = 'paid', paid_at = now(), confirmed_by_staff_id = private.current_staff_id(v_booking.venue_id),
      ledger_transaction_id = v_transaction_id, invoice_id = v_invoice.id
  where id = v_booking.id;
  perform private.emit(v_booking.venue_id, 'academy.booked', jsonb_build_object(
    'booking_id', v_booking.id, 'member_id', v_booking.member_id, 'batch_id', v_booking.batch_id,
    'kind', v_booking.kind, 'seats', v_booking.seats, 'amount_paise', v_booking.amount), 'academy.booked:' || v_booking.id);
  return v_transaction_id;
end;
$$;

-- A paid booking's invoice, for the member who booked (or the company's contact), to read and save as a PDF.
create function private.my_academy_invoice(p_booking_id uuid)
returns table (number text, is_tax_invoice boolean, issued_at timestamptz, supplier_legal_name text, supplier_gstin text,
               supplier_address text, buyer_name text, buyer_gstin text, description text, rate_basis_points integer,
               taxable_paise bigint, cgst_paise bigint, sgst_paise bigint, igst_paise bigint, total_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select i.number, i.is_tax_invoice, i.issued_at, i.supplier_legal_name, i.supplier_gstin, i.supplier_address, i.buyer_name,
         i.buyer_gstin, i.description, i.rate_basis_points, i.taxable_paise, i.cgst_paise, i.sgst_paise, i.igst_paise, i.total_paise
  from public.academy_booking k join public.invoice i on i.id = k.invoice_id
  where k.id = p_booking_id and k.member_id in (select m.id from public.member m where m.user_id = (select auth.uid()));
$$;

create function public.my_academy_invoice(p_booking_id uuid)
returns table (number text, is_tax_invoice boolean, issued_at timestamptz, supplier_legal_name text, supplier_gstin text,
               supplier_address text, buyer_name text, buyer_gstin text, description text, rate_basis_points integer,
               taxable_paise bigint, cgst_paise bigint, sgst_paise bigint, igst_paise bigint, total_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_academy_invoice(p_booking_id); $$;

revoke execute on function private.gst_payable_account(uuid) from public, anon, authenticated;
revoke execute on function private.book_academy_corporate(uuid, uuid, text, integer, uuid, text), public.book_academy_corporate(uuid, uuid, text, integer, uuid, text),
  private.my_academy_invoice(uuid), public.my_academy_invoice(uuid) from public, anon;
grant execute on function private.book_academy_corporate(uuid, uuid, text, integer, uuid, text), public.book_academy_corporate(uuid, uuid, text, integer, uuid, text),
  private.my_academy_invoice(uuid), public.my_academy_invoice(uuid) to authenticated;

-- A member's seats, as before, and a company's booking once paid, to its contact, who opens its invoice from
-- it (#249). Unpaid, a company's booking is the staff's to settle, so it does not show.
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
  where k.member_id = private.current_member_id()
    and ((k.kind = 'individual' and (k.status <> 'cancelled' or k.turned_down_utr is not null))
         or (k.kind = 'corporate' and k.status = 'paid'))
  order by b.starts_on, b.name;
$$;
