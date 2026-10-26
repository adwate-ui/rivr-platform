-- Invoices: a night's rake invoice is dated the night it covers (#422; the owner's answer to #398, point 2), and
-- every tax invoice carries its SAC code, the place of supply and an authorised signatory (#423; the owner's
-- answer to #412, point 2). Decision 0194.
--
-- Dated the night: the consolidated rake invoice for a business night is issued the morning after (07:00 IST),
-- but dated and numbered as of the night (06:00 IST when it began): the night of 31 March is in March's GST
-- return and the old financial year's series. The rate in force when the night began still applies (#398, 1).
-- A night invoiced after its month's GSTR-1 is due (the 11th of the next month) is dated when issued (#471).
--
-- SAC, place of supply, signatory: venue configuration holds the SAC code of each series (S, club services;
-- A, the Academy), from the club's CA, and the authorised signatory's name and designation. A tax invoice
-- stores them as they stood when it was issued, with the place of supply: the venue's state, or the buyer's
-- for IGST. A tax invoice is refused without its series' SAC code, as without the venue's GSTIN.
--
-- Tournament fees (#469; the owner's answer to #465, "like the nightly rake"): a night's rake invoice covers
-- the night's tournament entry fees with its rake, GST taken out at the rate in force when the night began.

alter table public.venue_config
  add column sac_club_services text check (sac_club_services ~ '^[0-9]{4}([0-9]{2})?$'),
  add column sac_academy text check (sac_academy ~ '^[0-9]{4}([0-9]{2})?$'),
  add column signatory_name text check (length(btrim(signatory_name)) between 1 and 100),
  add column signatory_designation text check (length(btrim(signatory_designation)) between 1 and 100);
comment on column public.venue_config.sac_club_services is 'The SAC code on the club services series (S) of tax invoices, from the CA (#423).';
comment on column public.venue_config.sac_academy is 'The SAC code on the Academy series (A) of tax invoices, from the CA (#423).';
comment on column public.venue_config.signatory_name is 'The authorised signatory every tax invoice names (#423).';
-- The super admin's view of the whole row gains the columns.
create or replace view public.venue_config_detail
with (security_invoker = true)
as
select * from private.venue_config_detail_rows();

alter table public.invoice
  add column sac_code text,
  add column place_of_supply text,
  add column signatory_name text,
  add column signatory_designation text;

-- A GST state code's state, as an invoice names its place of supply: `06` is Haryana.
create function private.gst_state_name(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select s.name from (values
    ('01', 'Jammu and Kashmir'), ('02', 'Himachal Pradesh'), ('03', 'Punjab'), ('04', 'Chandigarh'), ('05', 'Uttarakhand'),
    ('06', 'Haryana'), ('07', 'Delhi'), ('08', 'Rajasthan'), ('09', 'Uttar Pradesh'), ('10', 'Bihar'), ('11', 'Sikkim'),
    ('12', 'Arunachal Pradesh'), ('13', 'Nagaland'), ('14', 'Manipur'), ('15', 'Mizoram'), ('16', 'Tripura'), ('17', 'Meghalaya'),
    ('18', 'Assam'), ('19', 'West Bengal'), ('20', 'Jharkhand'), ('21', 'Odisha'), ('22', 'Chhattisgarh'), ('23', 'Madhya Pradesh'),
    ('24', 'Gujarat'), ('26', 'Dadra and Nagar Haveli and Daman and Diu'), ('27', 'Maharashtra'), ('29', 'Karnataka'), ('30', 'Goa'),
    ('31', 'Lakshadweep'), ('32', 'Kerala'), ('33', 'Tamil Nadu'), ('34', 'Puducherry'), ('35', 'Andaman and Nicobar Islands'),
    ('36', 'Telangana'), ('37', 'Andhra Pradesh'), ('38', 'Ladakh'), ('97', 'Other Territory')
  ) as s (code, name)
  where s.code = p_code;
$$;

-- As before (20261020123000_igst.sql), with the day an invoice is dated (now, unless given), and the SAC code,
-- place of supply and signatory stored with it.
drop function private.issue_invoice(uuid, text, text, bigint, integer, text, uuid, text, text);
create function private.issue_invoice(
  p_venue_id uuid,
  p_series_code text,
  p_source text,
  p_inclusive_paise bigint,
  p_rate_basis_points integer,
  p_description text,
  p_member_id uuid default null,
  p_buyer_name text default null,
  p_buyer_gstin text default null,
  p_issued_at timestamptz default null
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
  v_sac text;
  v_inter_state boolean;
  v_place text;
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
  v_sac := case p_series_code when 'S' then v_config.sac_club_services when 'A' then v_config.sac_academy end;
  if not v_is_practice and v_config.gstin is null then
    raise exception 'A tax invoice needs the venue''s GSTIN in its configuration' using errcode = 'RVGST';
  end if;
  if not v_is_practice and v_sac is null then
    raise exception 'A tax invoice needs its series'' SAC code in the venue''s configuration' using errcode = 'RVGST';
  end if;

  -- The place of supply: the buyer's state when it differs from the venue's (IGST), else the venue's.
  v_inter_state := coalesce(left(p_buyer_gstin, 2) <> left(v_config.gstin, 2), false);
  v_place := private.gst_state_name(case when v_inter_state then left(p_buyer_gstin, 2) else left(v_config.gstin, 2) end);
  if not v_is_practice and v_place is null then
    raise exception 'A tax invoice needs a place of supply: no state has the GSTIN state code %',
      case when v_inter_state then left(p_buyer_gstin, 2) else left(v_config.gstin, 2) end using errcode = 'RVGST';
  end if;

  if v_inter_state then
    select i.taxable_paise, i.igst_paise into v_taxable, v_igst from private.igst_included(p_inclusive_paise, p_rate_basis_points) i;
  else
    select g.taxable_paise, g.cgst_paise into v_taxable, v_half from private.gst_included(p_inclusive_paise, p_rate_basis_points) g;
  end if;

  v_at := coalesce(p_issued_at, clock_timestamp());
  v_year := private.financial_year(p_venue_id, v_at);
  insert into public.invoice_counter (series_id, venue_id, financial_year, last_number)
  values (v_series.id, p_venue_id, v_year, 1)
  on conflict (series_id, financial_year) do update set last_number = public.invoice_counter.last_number + 1
  returning last_number into v_sequence;

  insert into public.invoice (venue_id, series_id, financial_year, sequence, number, source, is_tax_invoice, issued_at, supplier_legal_name,
                              supplier_gstin, supplier_address, member_id, buyer_name, buyer_gstin, description, rate_basis_points,
                              taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise,
                              sac_code, place_of_supply, signatory_name, signatory_designation)
  values (p_venue_id, v_series.id, v_year, v_sequence,
          v_config.invoice_prefix || '/' || v_series.code || to_char(v_year % 100, 'FM00') || '/' || v_sequence,
          p_source, not v_is_practice, v_at, v_config.legal_name,
          -- A practice invoice never carries a GSTIN, even one set on the practice venue.
          case when v_is_practice then null else v_config.gstin end, v_config.address, p_member_id,
          coalesce(p_buyer_name, (select m.full_name from public.member m where m.id = p_member_id and m.venue_id = p_venue_id)),
          p_buyer_gstin, p_description, p_rate_basis_points, v_taxable, v_half, v_half, v_igst, p_inclusive_paise,
          case when v_is_practice then null else v_sac end, case when v_is_practice then null else v_place end,
          case when v_is_practice then null else v_config.signatory_name end,
          case when v_is_practice then null else v_config.signatory_designation end)
  returning * into v_invoice;

  perform private.emit(p_venue_id, 'invoice.issued', jsonb_build_object('invoice_id', v_invoice.id, 'number', v_invoice.number),
                       'invoice.issued:' || v_invoice.id);
  return v_invoice;
end;
$$;

revoke execute on function private.issue_invoice(uuid, text, text, bigint, integer, text, uuid, text, text, timestamptz)
  from public, anon, authenticated;

-- A business day's tournament fees (#469; the owner's answer to #465): the fees credited to the club's revenue
-- by transactions posted that day, less any reversed, as private.day_rake takes the rake.
create function private.day_tournament_fees(p_venue_id uuid, p_day date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(-sum(e.amount), 0)::bigint
  from public.ledger_entry e
  join public.ledger_account a on a.id = e.account_id
  join public.ledger_transaction t on t.id = e.transaction_id
  where a.venue_id = p_venue_id and a.code = 'venue.tournament_fees'
    and t.occurred_at >= (p_day + time '06:00') at time zone 'Asia/Kolkata'
    and t.occurred_at < (p_day + 1 + time '06:00') at time zone 'Asia/Kolkata';
$$;
revoke execute on function private.day_tournament_fees(uuid, date) from public, anon, authenticated;

-- As before (20261020131000_daily_rake_invoice.sql), dated the night it covers (06:00 IST when it began), and
-- covering the night's tournament fees with its rake (#469): a night with fees and no rake has its invoice too.
create or replace function private.issue_day_rake_invoice(p_venue_id uuid, p_day date)
returns public.invoice
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rake bigint := private.day_rake(p_venue_id, p_day);
  v_fees bigint := private.day_tournament_fees(p_venue_id, p_day);
  v_began timestamptz := (p_day + time '06:00') at time zone 'Asia/Kolkata';
  v_gst jsonb := private.setting_at(p_venue_id, 'gst.config', '', v_began);
  -- The night's month's GSTR-1 is due on the 11th of the next month. A night invoiced after that (refused until
  -- then) is dated when issued, so a filed return never changes (the owner's answer to #471).
  v_due date := (date_trunc('month', p_day) + interval '1 month')::date + 10;
begin
  if v_rake + v_fees <= 0 or v_gst ->> 'basis' is distinct from 'rake' then
    return null;
  end if;
  return private.issue_invoice(p_venue_id, 'S', 'rake:' || p_day::text, v_rake + v_fees, (v_gst ->> 'rate_basis_points')::integer,
                               'Club services: the ' || case when v_fees = 0 then 'rake' else 'rake and tournament fees' end
                                 || ' of the business day of ' || to_char(p_day, 'FMDD Mon YYYY'),
                               null, 'Unregistered customers, consolidated', null,
                               case when (now() at time zone 'Asia/Kolkata')::date <= v_due then v_began end);
end;
$$;

-- As before (20261020131000_daily_rake_invoice.sql), with the alert for a night whose rake and tournament fees
-- came to less than nothing once reversals are taken off (#469).
create or replace function private.issue_rake_invoices()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yesterday date := ((private.tonight_began(now()) - interval '1 day') at time zone 'Asia/Kolkata')::date;
  v_venue_id uuid;
  v_day date;
  v_total bigint;
begin
  for v_venue_id in select v.id from public.venue v loop
    v_total := private.day_rake(v_venue_id, v_yesterday) + private.day_tournament_fees(v_venue_id, v_yesterday);
    if v_total < 0 then
      perform private.raise_alert(v_venue_id, 'invoice.rake_negative', jsonb_build_object('day', v_yesterday, 'rake_paise', v_total));
    end if;
    for v_day in select d::date from generate_series(v_yesterday - 34, v_yesterday, interval '1 day') d loop
      begin
        perform private.issue_day_rake_invoice(v_venue_id, v_day);
      exception when others then
        perform private.raise_alert(v_venue_id, 'invoice.rake_refused', jsonb_build_object('day', v_day, 'reason', sqlerrm));
        exit;
      end;
    end loop;
  end loop;
end;
$$;

-- As before (20261020200000_academy_invoices.sql), with the SAC code, place of supply and signatory the member's
-- invoice now carries.
drop function public.my_academy_invoice(uuid);
drop function private.my_academy_invoice(uuid);
create function private.my_academy_invoice(p_booking_id uuid)
returns table (number text, is_tax_invoice boolean, issued_at timestamptz, supplier_legal_name text, supplier_gstin text,
               supplier_address text, buyer_name text, buyer_gstin text, description text, rate_basis_points integer,
               taxable_paise bigint, cgst_paise bigint, sgst_paise bigint, igst_paise bigint, total_paise bigint,
               sac_code text, place_of_supply text, signatory_name text, signatory_designation text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.number, i.is_tax_invoice, i.issued_at, i.supplier_legal_name, i.supplier_gstin, i.supplier_address, i.buyer_name,
         i.buyer_gstin, i.description, i.rate_basis_points, i.taxable_paise, i.cgst_paise, i.sgst_paise, i.igst_paise, i.total_paise,
         i.sac_code, i.place_of_supply, i.signatory_name, i.signatory_designation
  from public.academy_booking k join public.invoice i on i.id = k.invoice_id
  where k.id = p_booking_id and k.member_id in (select m.id from public.member m where m.user_id = (select auth.uid()));
$$;

create function public.my_academy_invoice(p_booking_id uuid)
returns table (number text, is_tax_invoice boolean, issued_at timestamptz, supplier_legal_name text, supplier_gstin text,
               supplier_address text, buyer_name text, buyer_gstin text, description text, rate_basis_points integer,
               taxable_paise bigint, cgst_paise bigint, sgst_paise bigint, igst_paise bigint, total_paise bigint,
               sac_code text, place_of_supply text, signatory_name text, signatory_designation text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_academy_invoice(p_booking_id); $$;

revoke execute on function private.my_academy_invoice(uuid), public.my_academy_invoice(uuid), private.gst_state_name(text) from public, anon;
grant execute on function private.my_academy_invoice(uuid), public.my_academy_invoice(uuid) to authenticated;
