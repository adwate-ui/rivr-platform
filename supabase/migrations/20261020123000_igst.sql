-- IGST for a buyer registered in another state (#380; the owner's answer to #378, point 6; decision 0102).
-- An invoice to a buyer whose GSTIN's state code (its first two digits) differs from the venue's carries
-- IGST at the full rate, taken out of the amount and rounded once to the nearest paisa, a half up, with
-- the taxable value the rest; no CGST or SGST. Members without a GSTIN and buyers from the venue's own
-- state keep CGST and SGST, as #23. #23's refusal of other-state buyers goes.

-- @rivr/domain igstIncluded in SQL, proved on the same golden file (packages/testing/golden/gst.json,
-- 024_golden_twins). No row for a negative amount or a rate outside 0 to 10,000, which the issuer refuses first.
create function private.igst_included(p_inclusive bigint, p_rate integer)
returns table (taxable_paise bigint, igst_paise bigint)
language sql
immutable
set search_path = ''
as $$
  select p_inclusive - t.igst, t.igst
  from (select (2 * p_inclusive * p_rate + (10000 + p_rate)) / (2 * (10000 + p_rate)) as igst) t
  where p_inclusive >= 0 and p_rate between 0 and 10000;
$$;

revoke execute on function private.igst_included(bigint, integer) from public, anon, authenticated;

-- Invoices issued so far are all CGST and SGST, so theirs is nothing. invoice_check1 is #23's
-- total = taxable + CGST + SGST, named by Postgres.
alter table public.invoice add column igst_paise bigint not null default 0 check (igst_paise >= 0);
alter table public.invoice drop constraint invoice_check1;
alter table public.invoice add constraint invoice_total_adds_up
  check (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise);
alter table public.invoice add constraint invoice_one_kind_of_gst check (igst_paise = 0 or cgst_paise = 0);

-- As #23's (20261020091300_gst_invoices.sql), with IGST for a buyer from another state in place of the refusal.
-- The states are compared only where both GSTINs are known; a member buys without one, so locally.
create or replace function private.issue_invoice(
  p_venue_id uuid,
  p_series_code text,
  p_source text,
  p_inclusive_paise bigint,
  p_rate_basis_points integer,
  p_description text,
  p_member_id uuid default null,
  p_buyer_name text default null,
  p_buyer_gstin text default null
)
returns public.invoice
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoice;
  v_config public.venue_config;
  v_series public.invoice_series;
  v_is_practice boolean;
  v_at timestamptz;
  v_year integer;
  v_sequence integer;
  v_taxable bigint;
  v_half bigint := 0;
  v_igst bigint := 0;
begin
  select * into v_series from public.invoice_series s where s.venue_id = p_venue_id and s.code = p_series_code;
  if v_series.id is null then
    raise exception 'No invoice series % at this venue', p_series_code using errcode = '22023';
  end if;
  -- Held until the caller commits: the next issue in the series sees this one, its number and its source.
  perform pg_advisory_xact_lock(hashtextextended('invoice_series:' || v_series.id::text, 0));

  select * into v_invoice from public.invoice i where i.venue_id = p_venue_id and i.source = p_source;
  if found then
    if (v_invoice.series_id, v_invoice.total_paise, v_invoice.rate_basis_points, v_invoice.member_id, v_invoice.buyer_gstin)
       is distinct from (v_series.id, p_inclusive_paise, p_rate_basis_points, p_member_id, p_buyer_gstin)
       or (p_buyer_name is not null and p_buyer_name <> v_invoice.buyer_name) then
      raise exception 'That source has an invoice with other details' using errcode = '22023';
    end if;
    return v_invoice;
  end if;
  select v.is_practice into v_is_practice from public.venue v where v.id = p_venue_id;
  select * into v_config from public.venue_config c where c.venue_id = p_venue_id;
  if coalesce(p_inclusive_paise < 0 or p_rate_basis_points not between 0 and 10000, true) then
    raise exception 'An invoice is for nothing or more, at a rate of 0 to 10,000 basis points' using errcode = '22023';
  end if;
  if not v_is_practice and v_config.gstin is null then
    raise exception 'A tax invoice needs the venue''s GSTIN in its configuration' using errcode = 'RVGST';
  end if;

  if coalesce(left(p_buyer_gstin, 2) <> left(v_config.gstin, 2), false) then
    select i.taxable_paise, i.igst_paise into v_taxable, v_igst from private.igst_included(p_inclusive_paise, p_rate_basis_points) i;
  else
    select g.taxable_paise, g.cgst_paise into v_taxable, v_half from private.gst_included(p_inclusive_paise, p_rate_basis_points) g;
  end if;

  v_at := clock_timestamp();
  v_year := private.financial_year(p_venue_id, v_at);
  insert into public.invoice_counter (series_id, venue_id, financial_year, last_number)
  values (v_series.id, p_venue_id, v_year, 1)
  on conflict (series_id, financial_year) do update set last_number = public.invoice_counter.last_number + 1
  returning last_number into v_sequence;

  insert into public.invoice (venue_id, series_id, financial_year, sequence, number, source, is_tax_invoice, issued_at, supplier_legal_name,
                              supplier_gstin, supplier_address, member_id, buyer_name, buyer_gstin, description, rate_basis_points,
                              taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise)
  values (p_venue_id, v_series.id, v_year, v_sequence,
          v_config.invoice_prefix || '/' || v_series.code || to_char(v_year % 100, 'FM00') || '/' || v_sequence,
          p_source, not v_is_practice, v_at, v_config.legal_name,
          -- A practice invoice never carries a GSTIN, even one set on the practice venue.
          case when v_is_practice then null else v_config.gstin end, v_config.address, p_member_id,
          coalesce(p_buyer_name, (select m.full_name from public.member m where m.id = p_member_id and m.venue_id = p_venue_id)),
          p_buyer_gstin, p_description, p_rate_basis_points, v_taxable, v_half, v_half, v_igst, p_inclusive_paise)
  returning * into v_invoice;

  perform private.emit(p_venue_id, 'invoice.issued', jsonb_build_object('invoice_id', v_invoice.id, 'number', v_invoice.number),
                       'invoice.issued:' || v_invoice.id);
  return v_invoice;
end;
$$;

revoke execute on function private.issue_invoice(uuid, text, text, bigint, integer, text, uuid, text, text)
  from public, anon, authenticated;
