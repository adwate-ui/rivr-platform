-- GST tax invoices (#23; tech plan item 20; decision 0071, question #378). gst.config holds the rate and
-- basis of the club's own supply, effective-dated; every venue starts on a placeholder until the owner
-- sets them. Invoices are numbered per venue and series without gaps, as RIVR/S26/41: the venue's
-- prefix, the series, the financial year it began in, and the next number in that year (GST rule 46:
-- at most sixteen characters, unique in a financial year). The practice venue's invoices say they are
-- not tax invoices, and nothing about them leaves (the outbox never offers its events).

insert into public.setting_key (key, description, scope, value_schema) values
  ('gst.config',
   'GST on the club''s own supply (tech plan item 20; #23, decision 0071): the rate in basis points (1800 is 18%), taken out of what is collected, and the basis it is charged on (the rake or a table fee).',
   'venue',
   '{"type":"object","properties":{"rate_basis_points":{"type":"integer","minimum":0,"maximum":10000},"basis":{"type":"string","enum":["rake","table_fee"]}},"required":["rate_basis_points","basis"],"additionalProperties":false}');

-- 18% on the rake until the owner sets GST (question #378).
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.id, 'gst.config', '', '{"rate_basis_points": 1800, "basis": "rake"}', '-infinity', 'A placeholder until the owner sets GST (#23)'
from public.venue v
on conflict (venue_id, key, subject, effective_from) do nothing;

-- A number is the prefix, a slash, the series and year (three), a slash and up to five digits: within
-- sixteen characters while the prefix has at most six.
alter table public.venue_config add constraint venue_config_invoice_prefix_fits check (char_length(invoice_prefix) <= 6);

create table public.invoice_series (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  code text not null check (code ~ '^[A-Z]$'),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, code),
  unique (id, venue_id)
);

comment on table public.invoice_series is 'A venue''s invoice series, each numbered on its own from 1 every financial year.';

create trigger invoice_series_touch_updated_at before update on public.invoice_series
  for each row execute function private.touch_updated_at();

-- The last number a series used in a financial year. Numbering locks this row, so no two invoices share
-- a number, and an issue that fails takes its number back with it: no gaps.
create table public.invoice_counter (
  series_id uuid not null,
  venue_id uuid not null,
  financial_year integer not null check (financial_year between 2000 and 2999),
  last_number integer not null check (last_number between 1 and 99999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (series_id, financial_year),
  foreign key (series_id, venue_id) references public.invoice_series (id, venue_id)
);

comment on table public.invoice_counter is 'The last invoice number each series used in each financial year.';

create index invoice_counter_venue_id_idx on public.invoice_counter (venue_id);
create trigger invoice_counter_touch_updated_at before update on public.invoice_counter
  for each row execute function private.touch_updated_at();

create table public.invoice (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  series_id uuid not null,
  financial_year integer not null,
  sequence integer not null check (sequence between 1 and 99999),
  number text not null check (char_length(number) <= 16 and number ~ '^[A-Z0-9-]{1,6}/[A-Z][0-9]{2}/[1-9][0-9]{0,4}$'),
  -- What it was issued for, as the issuing feature names it: one invoice per source.
  source text not null check (char_length(source) between 1 and 200),
  -- False at the practice venue: a training invoice, never a tax invoice.
  is_tax_invoice boolean not null,
  issued_at timestamptz not null default now(),
  -- The supplier as the venue's configuration stood when issued.
  supplier_legal_name text not null,
  supplier_gstin text,
  supplier_address text not null,
  member_id uuid,
  buyer_name text not null check (char_length(buyer_name) between 1 and 200),
  -- A company buying under its GSTIN.
  buyer_gstin text check (buyer_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  description text not null check (char_length(description) between 1 and 200),
  rate_basis_points integer not null check (rate_basis_points between 0 and 10000),
  taxable_paise bigint not null check (taxable_paise >= 0),
  cgst_paise bigint not null check (cgst_paise >= 0),
  sgst_paise bigint not null check (sgst_paise = cgst_paise),
  total_paise bigint not null check (total_paise = taxable_paise + cgst_paise + sgst_paise),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, number),
  unique (series_id, financial_year, sequence),
  unique (venue_id, source),
  foreign key (series_id, venue_id) references public.invoice_series (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  check (not is_tax_invoice or supplier_gstin is not null)
);

comment on table public.invoice is 'GST tax invoices, numbered per venue and series without gaps; never changed once issued.';

create index invoice_member_id_idx on public.invoice (member_id);
create trigger invoice_append_only before update or delete on public.invoice
  for each row execute function private.refuse_change();
create trigger invoice_no_truncate before truncate on public.invoice
  for each statement execute function private.refuse_change();
create trigger invoice_audit after insert on public.invoice
  for each row execute function private.audit_row_change();

alter table public.invoice_series enable row level security;
alter table public.invoice_counter enable row level security;
alter table public.invoice enable row level security;
-- Reads only: invoices are issued by the features that sell, through private.issue_invoice. Nobody reads
-- the counters.
grant select on public.invoice_series, public.invoice to authenticated;

create policy "ledger staff see the venue's invoice series" on public.invoice_series
  for select to authenticated
  using (venue_id in (select private.venues_where('ledger.read')));

create policy "members see their invoices; ledger staff see the venue's" on public.invoice
  for select to authenticated
  using (member_id = (select private.current_member_id()) or venue_id in (select private.venues_where('ledger.read')));

-- Every venue has series S for the club's own supply (the rake or a table fee).
insert into public.invoice_series (venue_id, code, name)
select v.id, 'S', 'Club services' from public.venue v
on conflict (venue_id, code) do nothing;

-- @rivr/domain gstIncluded in SQL, proved on the same golden file (packages/testing/golden/gst.json,
-- 024_golden_twins): each half of the tax rounded to the nearest paisa, a half up; taxable is the rest.
-- No row for a negative amount or a rate outside 0 to 10,000, which the issuer refuses first.
create function private.gst_included(p_inclusive bigint, p_rate integer)
returns table (taxable_paise bigint, cgst_paise bigint, sgst_paise bigint)
language sql
immutable
set search_path = ''
as $$
  select p_inclusive - 2 * h.half, h.half, h.half
  from (select (p_inclusive * p_rate + (10000 + p_rate)) / (2 * (10000 + p_rate)) as half) h
  where p_inclusive >= 0 and p_rate between 0 and 10000;
$$;

-- The financial year a moment falls in on the venue's clock, by the year it began: 2026 runs from
-- 1 April 2026 to 31 March 2027.
create function private.financial_year(p_venue_id uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (extract(year from l.at) - case when extract(month from l.at) < 4 then 1 else 0 end)::integer
  from (select p_at at time zone v.time_zone as at from public.venue v where v.id = p_venue_id) l;
$$;

-- Issues an invoice in one of a venue's series for an amount that includes GST at the given rate (the
-- caller reads the rate in force for what it sells), numbered next in the series for this financial
-- year. The buyer is the member, by name, unless a buyer is named (a company, with its GSTIN). Once per
-- source: issuing again for the same source with the same details gives the same invoice and uses no
-- number; with other details it is refused. Issues in a series wait for one another, so numbers follow
-- the time of issue. Only CGST and SGST for now: a buyer registered in another state, who is charged
-- IGST (owner, #378), is refused until that is built (#380).
create function private.issue_invoice(
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
  if left(p_buyer_gstin, 2) <> left(v_config.gstin, 2) then
    raise exception 'A buyer registered in another state is charged IGST, which is not built yet' using errcode = 'RVGST';
  end if;

  v_at := clock_timestamp();
  v_year := private.financial_year(p_venue_id, v_at);
  insert into public.invoice_counter (series_id, venue_id, financial_year, last_number)
  values (v_series.id, p_venue_id, v_year, 1)
  on conflict (series_id, financial_year) do update set last_number = public.invoice_counter.last_number + 1
  returning last_number into v_sequence;

  insert into public.invoice (venue_id, series_id, financial_year, sequence, number, source, is_tax_invoice, issued_at, supplier_legal_name,
                              supplier_gstin, supplier_address, member_id, buyer_name, buyer_gstin, description, rate_basis_points,
                              taxable_paise, cgst_paise, sgst_paise, total_paise)
  select p_venue_id, v_series.id, v_year, v_sequence,
         v_config.invoice_prefix || '/' || v_series.code || to_char(v_year % 100, 'FM00') || '/' || v_sequence,
         p_source, not v_is_practice, v_at, v_config.legal_name,
         -- A practice invoice never carries a GSTIN, even one set on the practice venue.
         case when v_is_practice then null else v_config.gstin end, v_config.address, p_member_id,
         coalesce(p_buyer_name, (select m.full_name from public.member m where m.id = p_member_id and m.venue_id = p_venue_id)),
         p_buyer_gstin, p_description, p_rate_basis_points, g.taxable_paise, g.cgst_paise, g.sgst_paise, p_inclusive_paise
  from private.gst_included(p_inclusive_paise, p_rate_basis_points) g
  returning * into v_invoice;

  perform private.emit(p_venue_id, 'invoice.issued', jsonb_build_object('invoice_id', v_invoice.id, 'number', v_invoice.number),
                       'invoice.issued:' || v_invoice.id);
  return v_invoice;
end;
$$;

revoke execute on function private.gst_included(bigint, integer), private.financial_year(uuid, timestamptz),
  private.issue_invoice(uuid, text, text, bigint, integer, text, uuid, text, text)
  from public, anon, authenticated;

-- A new venue gets the placeholder and series S too: #22's bootstrap with two lines more.
create or replace function private.bootstrap_venue(
  p_venue_id uuid,
  p_name text,
  p_slug text,
  p_is_practice boolean,
  p_legal_name text,
  p_address text,
  p_invoice_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_tier_id uuid;
begin
  if exists (select 1 from public.venue v where v.id = p_venue_id) then
    return p_venue_id;
  end if;

  insert into public.venue (id, name, slug, is_practice) values (p_venue_id, p_name, p_slug, p_is_practice);
  insert into public.venue_config (venue_id, legal_name, address, invoice_prefix)
  values (p_venue_id, p_legal_name, p_address, p_invoice_prefix);
  insert into public.invoice_series (venue_id, code, name) values (p_venue_id, 'S', 'Club services');

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1), (p_venue_id, 'Academy graduate', 2),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tds.config', '',
          '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
          '-infinity', 'Switched off until the owner sets TDS (#22)');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'gst.config', '', '{"rate_basis_points": 1800, "basis": "rake"}', '-infinity', 'A placeholder until the owner sets GST (#23)');

  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, true, 'locked', '-infinity'
  from public.tier t cross join public.feature f
  where t.venue_id = p_venue_id and f.is_gateable;

  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money) values
    (p_venue_id, 'venue.cash_drawer', 'Cash drawer', 'asset', 'paise', false),
    (p_venue_id, 'venue.bank', 'Bank and UPI', 'asset', 'paise', false),
    (p_venue_id, 'venue.chips_outstanding', 'Chips in play', 'liability', 'paise', true),
    (p_venue_id, 'venue.rake', 'Rake', 'revenue', 'paise', false),
    (p_venue_id, 'venue.jackpot.main', 'Bad-beat jackpot', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.season', 'Season jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.freeroll', 'Freeroll jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.bonus_expense', 'Bonus issued', 'expense', 'paise', false),
    (p_venue_id, 'venue.high_hand_expense', 'High hands paid', 'expense', 'paise', false),
    (p_venue_id, 'venue.withdrawals_pending', 'Withdrawals waiting to be paid', 'liability', 'paise', true),
    (p_venue_id, 'venue.tds_payable', 'TDS withheld, to be paid to the government', 'liability', 'paise', false),
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  return p_venue_id;
end;
$$;
