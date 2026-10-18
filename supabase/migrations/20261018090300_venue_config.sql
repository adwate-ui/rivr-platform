-- Venue configuration: the legal and payment details documents and screens show
-- (additions, "Venue configuration"). Nothing in code holds these; the prototype's values
-- are placeholders. Only a super_admin (venue.configure) changes them, and every change is audited.

create table public.venue_config (
  venue_id uuid primary key references public.venue (id),
  legal_name text not null check (length(trim(legal_name)) > 0),
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  address text not null check (length(trim(address)) > 0),
  upi_payee_name text,
  upi_vpa text check (upi_vpa ~ '^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$'),
  bank_name text,
  bank_account_name text,
  bank_account_number text check (bank_account_number ~ '^[0-9]{9,18}$'),
  bank_ifsc text check (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  invoice_prefix text not null check (invoice_prefix ~ '^[A-Z0-9-]{1,10}$'),
  -- Storage path of the logo in the brand bucket.
  logo_path text,
  -- Cage and admin sessions must come from one of these networks (.claude/rules/security.md).
  staff_ip_allowlist cidr[] not null default '{}',
  -- Sentry alerts and failed outbox items notify this WhatsApp number (additions, "Alerting").
  alert_whatsapp text check (alert_whatsapp ~ '^\+91[6-9][0-9]{9}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger venue_config_touch_updated_at before update on public.venue_config
  for each row execute function private.touch_updated_at();
create trigger venue_config_audit after insert or update or delete on public.venue_config
  for each row execute function private.audit_row_change();

alter table public.venue_config enable row level security;
grant select, update on public.venue_config to authenticated;

create policy "staff read their venue's configuration" on public.venue_config
  for select to authenticated
  using (venue_id in (select private.staff_venues()));

create policy "super admins change the configuration" on public.venue_config
  for update to authenticated
  using (venue_id in (select private.venues_where('venue.configure')))
  with check (venue_id in (select private.venues_where('venue.configure')));
