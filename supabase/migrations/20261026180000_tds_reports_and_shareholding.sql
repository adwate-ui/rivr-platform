-- TDS reports (#93; scope-v1 module 5: "withholding ledger and quarterly return extracts; certificate data
-- per player") and the shareholding register (#97; additions "Shareholding register"). Decisions 0169 and 0170.
-- * The venue's TAN joins its configuration: a TDS return and a certificate name the deductor by it.
-- * The withholding ledger gives each member's TDS over a period: withheld, and shadow while switched off.
-- * The quarterly return extract lists every deduction of an Indian financial-year quarter, with the
--   member's PAN, for whoever exports tables; each extract is audited, and the practice venue has none.
-- * Certificate data: a member's own deductions by venue and quarter, for Sessions.
-- * The register: partners and investors, and holdings in basis points that change on effective dates,
--   never above 100% on any day. Super admin only; every change audited.

insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array['shareholding.manage']) as permission;

-- Who owns the club is super admin business only, as purge and the full export are.
alter table public.role_permission drop constraint super_admin_only_permissions;
alter table public.role_permission add constraint super_admin_only_permissions check (
  role = 'super_admin'
  or permission not in ('purge.run', 'exports.full', 'control.engage', 'members.override_features', 'venue.configure', 'shareholding.manage')
);

-- ---------------------------------------------------------------------------------------------------
-- TDS (#93).

alter table public.venue_config add column tan text check (tan ~ '^[A-Z]{4}[0-9]{5}[A-Z]$');
comment on column public.venue_config.tan is 'The venue''s TAN, which its TDS returns and certificates name (#93).';
grant select (tan) on public.venue_config to authenticated;
-- The super admin's view of the whole row gains the column.
create or replace view public.venue_config_detail
with (security_invoker = true)
as
select * from private.venue_config_detail_rows();

-- The first day of the Indian financial-year quarter a moment falls in, on India's clock: April, July,
-- October or January.
create function private.tds_quarter_start(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('quarter', p_at at time zone 'Asia/Kolkata')::date;
$$;

-- The withholding ledger (#93): each member's TDS from the start of `p_from` up to the end of `p_to`
-- (India's days): the cash-outs that recorded it, what they paid, what was withheld, and what would have
-- been while TDS was switched off. The PAN shows its last four characters only. For ledger readers.
create function private.tds_ledger(p_venue_id uuid, p_from date, p_to date)
returns table (member_id uuid, full_name text, member_number bigint, pan_last4 text, cash_outs integer, paid_paise bigint,
               withheld_paise bigint, shadow_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, m.member_number, right(k.pan, 4), count(*)::integer, sum(c.amount_paise)::bigint,
         coalesce(sum(w.amount_paise) filter (where not w.is_shadow), 0)::bigint,
         coalesce(sum(w.amount_paise) filter (where w.is_shadow), 0)::bigint
  from public.tds_withholding w
  join public.cage_transaction c on c.id = w.cage_transaction_id
  join public.member m on m.id = w.member_id
  left join public.kyc_record k on k.member_id = m.id and k.venue_id = m.venue_id
  where w.venue_id = p_venue_id and private.has_permission(p_venue_id, 'ledger.read')
    and w.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and w.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
  group by m.id, m.full_name, m.member_number, k.pan
  order by coalesce(sum(w.amount_paise) filter (where not w.is_shadow), 0) desc, m.full_name;
$$;

-- @rivr/domain tdsTaxedWinnings (golden tdsReturn.json): the winnings a deduction was taxed on, the
-- period's winnings at its cash-out above the most already taxed earlier in the period, never below nothing.
create function private.tds_taxed_winnings(p_winnings_paise bigint, p_taxed_before_paise bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select greatest(0, p_winnings_paise - p_taxed_before_paise);
$$;

-- The quarterly return extract (#93): every deduction withheld in the quarter starting `p_quarter_start`,
-- with the member's full PAN (PANNOTAVBL without one, as the return expects), the section, the winnings
-- that deduction was taxed on (the amount paid or credited, by the owner's answer on #455), the rate and
-- the TDS. Earlier in the period means recorded before it: by time, and within one moment by what was
-- already recorded, which only grows. The PAN is the one the member's identity
-- check holds, a check reopened since included: the deduction was made against it. Shadow TDS was never deducted, so it is
-- not here. For staff who export tables, audited; the practice venue files no return. Refusals: 42501,
-- 22023 not a quarter's first day, or the practice venue.
create function private.tds_return_extract(p_venue_id uuid, p_quarter_start date)
returns table (deducted_at timestamptz, full_name text, pan text, section text, taxed_winnings_paise bigint, rate_basis_points integer,
               tds_paise bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'exports.table') then
    raise exception 'Only staff who export tables take the TDS return' using errcode = '42501';
  end if;
  if p_quarter_start is null or date_trunc('quarter', p_quarter_start)::date <> p_quarter_start
     or exists (select 1 from public.venue v where v.id = p_venue_id and v.is_practice) then
    raise exception 'A quarter''s first day, at a venue that files returns' using errcode = '22023';
  end if;
  perform private.audit(p_venue_id, 'export.tds_return', 'tds_withholding', p_quarter_start::text);
  return query
  select w.created_at, m.full_name, coalesce(k.pan, 'PANNOTAVBL'), w.section,
         private.tds_taxed_winnings(w.winnings_paise, coalesce((
           select max(p.winnings_paise) from public.tds_withholding p
           where p.member_id = w.member_id and p.created_at >= w.period_start and p.due_paise > 0
             and (p.created_at, p.already_paise) < (w.created_at, w.already_paise)), 0)),
         w.rate_basis_points, w.amount_paise
  from public.tds_withholding w
  join public.member m on m.id = w.member_id
  left join public.kyc_record k on k.member_id = m.id and k.venue_id = m.venue_id
  where w.venue_id = p_venue_id and not w.is_shadow and w.amount_paise > 0
    and private.tds_quarter_start(w.created_at) = p_quarter_start
  order by w.created_at, w.id;
end;
$$;

-- Certificate data (#93): the signed-in member's TDS withheld, by venue, quarter and section, with the
-- deductor's name and TAN and the last four characters of their PAN. Nothing while none was withheld, so
-- Sessions shows TDS only when it applies.
create function private.my_tds_certificates()
returns table (venue_id uuid, legal_name text, tan text, quarter_start date, section text, pan_last4 text, cash_outs integer,
               paid_paise bigint, tds_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select w.venue_id, vc.legal_name, vc.tan, private.tds_quarter_start(w.created_at), w.section, right(k.pan, 4), count(*)::integer,
         sum(c.amount_paise)::bigint, sum(w.amount_paise)::bigint
  from public.member m
  join public.tds_withholding w on w.member_id = m.id
  join public.cage_transaction c on c.id = w.cage_transaction_id
  join public.venue_config vc on vc.venue_id = w.venue_id
  left join public.kyc_record k on k.member_id = m.id and k.venue_id = m.venue_id
  where m.user_id = (select auth.uid()) and not w.is_shadow and w.amount_paise > 0
  group by w.venue_id, vc.legal_name, vc.tan, private.tds_quarter_start(w.created_at), w.section, k.pan
  order by 4 desc, 2;
$$;

-- ---------------------------------------------------------------------------------------------------
-- The shareholding register (#97).

-- A partner or an investor in the club.
create table public.shareholder (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null check (kind in ('partner', 'investor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id)
);
comment on table public.shareholder is 'A partner or an investor in the club (#97).';
create index shareholder_venue_idx on public.shareholder (venue_id);
create trigger shareholder_touch_updated_at before update on public.shareholder
  for each row execute function private.touch_updated_at();
create trigger shareholder_audit after insert or update or delete on public.shareholder
  for each row execute function private.audit_row_change();
alter table public.shareholder enable row level security;
grant select on public.shareholder to authenticated;
create policy "super admins see the shareholders" on public.shareholder
  for select to authenticated using (venue_id in (select private.venues_where('shareholding.manage')));

-- A holder's share from a day on, in basis points (10000 is the whole club), until a later day's row.
create table public.shareholding (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  shareholder_id uuid not null,
  basis_points integer not null check (basis_points between 0 and 10000),
  effective_from date not null,
  note text check (note is null or length(trim(note)) between 1 and 200),
  recorded_by_staff_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (shareholder_id, venue_id) references public.shareholder (id, venue_id),
  foreign key (recorded_by_staff_id, venue_id) references public.staff (id, venue_id),
  unique (shareholder_id, effective_from)
);
comment on table public.shareholding is 'A holder''s share in basis points from a day on (#97).';
create index shareholding_venue_idx on public.shareholding (venue_id, effective_from);
create index shareholding_staff_idx on public.shareholding (recorded_by_staff_id, venue_id);
create trigger shareholding_touch_updated_at before update on public.shareholding
  for each row execute function private.touch_updated_at();
create trigger shareholding_audit after insert or update or delete on public.shareholding
  for each row execute function private.audit_row_change();
alter table public.shareholding enable row level security;
grant select on public.shareholding to authenticated;
create policy "super admins see the holdings" on public.shareholding
  for select to authenticated using (venue_id in (select private.venues_where('shareholding.manage')));

-- What each holder holds on a day: their latest row from that day or before.
create function private.holdings_on(p_venue_id uuid, p_on date)
returns table (shareholder_id uuid, basis_points integer, effective_from date)
language sql
stable
set search_path = ''
as $$
  select distinct on (s.shareholder_id) s.shareholder_id, s.basis_points, s.effective_from
  from public.shareholding s
  where s.venue_id = p_venue_id and s.effective_from <= p_on
  order by s.shareholder_id, s.effective_from desc;
$$;

-- A super admin adds a partner or an investor. Refusals: 42501, 22023 a name or kind not allowed.
create function private.add_shareholder(p_venue_id uuid, p_name text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'shareholding.manage') then
    raise exception 'Only a super admin keeps the register' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 120 or p_kind is null or p_kind not in ('partner', 'investor') then
    raise exception 'A partner or an investor, named' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.shareholder (venue_id, name, kind) values (p_venue_id, trim(p_name), p_kind) returning id into v_id;
  return v_id;
end;
$$;

-- A super admin records what a holder holds from a day on; a second record for the same day replaces
-- the first (the audit log keeps both). Refusals: 42501, 22023 a holder not the venue's or a share not
-- 0 to 10000 basis points, RVSHR the holdings above 100% on that day or any later one.
create function private.record_holding(p_venue_id uuid, p_shareholder_id uuid, p_basis_points integer, p_effective_from date, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'shareholding.manage') then
    raise exception 'Only a super admin keeps the register' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shareholder h where h.id = p_shareholder_id and h.venue_id = p_venue_id)
     or p_basis_points is null or p_basis_points not between 0 and 10000 or p_effective_from is null
     or length(trim(coalesce(p_note, ''))) > 200 then
    raise exception 'A holder of this venue, and 0 to 10000 basis points from a day' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  perform 1 from public.shareholder h where h.venue_id = p_venue_id for update;
  insert into public.shareholding (venue_id, shareholder_id, basis_points, effective_from, note, recorded_by_staff_id)
  values (p_venue_id, p_shareholder_id, p_basis_points, p_effective_from, nullif(trim(coalesce(p_note, '')), ''),
          private.current_staff_id(p_venue_id))
  on conflict (shareholder_id, effective_from) do update
  set basis_points = excluded.basis_points, note = excluded.note, recorded_by_staff_id = excluded.recorded_by_staff_id;
  -- Every day a holding changes from this one on must still add up to 100% at most.
  if exists (
    select 1
    from (select distinct s.effective_from as day from public.shareholding s where s.venue_id = p_venue_id and s.effective_from >= p_effective_from) d
    where (select coalesce(sum(o.basis_points), 0) from private.holdings_on(p_venue_id, d.day) o) > 10000
  ) then
    raise exception 'The holdings come to more than 100%%' using errcode = 'RVSHR';
  end if;
end;
$$;

-- The register on a day: every holder, with what they held then (null before their first holding) and
-- from when. For super admins.
create function private.shareholding_register(p_venue_id uuid, p_on date)
returns table (shareholder_id uuid, name text, kind text, basis_points integer, effective_from date)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name, h.kind, o.basis_points, o.effective_from
  from public.shareholder h
  left join private.holdings_on(p_venue_id, p_on) o on o.shareholder_id = h.id
  where h.venue_id = p_venue_id and private.has_permission(p_venue_id, 'shareholding.manage')
  order by o.basis_points desc nulls last, h.name;
$$;

-- Every holding recorded, newest day first, with who recorded it. For super admins.
create function private.shareholding_history(p_venue_id uuid)
returns table (shareholder_id uuid, name text, basis_points integer, effective_from date, note text, recorded_by text, recorded_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name, s.basis_points, s.effective_from, s.note, st.full_name, s.updated_at
  from public.shareholding s
  join public.shareholder h on h.id = s.shareholder_id
  join public.staff st on st.id = s.recorded_by_staff_id
  where s.venue_id = p_venue_id and private.has_permission(p_venue_id, 'shareholding.manage')
  order by s.effective_from desc, h.name;
$$;

-- Who owns the club, and every member's full PAN in an extract, are admin-computer work where a venue
-- keeps money work to its computers (#384), as the other console powers are.
create or replace function private.computer_kind_for(p_permission text)
returns public.device_kind
language sql
immutable
set search_path = ''
as $$
  select case
    when p_permission in ('cage.transact', 'cage.second_approve', 'markers.issue', 'withdrawals.approve') then 'cage'::public.device_kind
    when p_permission in ('settings.manage', 'staff.manage', 'devices.manage', 'tiers.manage', 'venue.configure', 'control.engage',
                          'purge.run', 'exports.full', 'treasury.manage', 'shareholding.manage', 'exports.table') then 'console'::public.device_kind
  end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- What the apps call.

create function public.tds_ledger(p_venue_id uuid, p_from date, p_to date)
returns table (member_id uuid, full_name text, member_number bigint, pan_last4 text, cash_outs integer, paid_paise bigint,
               withheld_paise bigint, shadow_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tds_ledger(p_venue_id, p_from, p_to); $$;
create function public.tds_return_extract(p_venue_id uuid, p_quarter_start date)
returns table (deducted_at timestamptz, full_name text, pan text, section text, taxed_winnings_paise bigint, rate_basis_points integer,
               tds_paise bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.tds_return_extract(p_venue_id, p_quarter_start); $$;
create function public.my_tds_certificates()
returns table (venue_id uuid, legal_name text, tan text, quarter_start date, section text, pan_last4 text, cash_outs integer,
               paid_paise bigint, tds_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tds_certificates(); $$;
create function public.add_shareholder(p_venue_id uuid, p_name text, p_kind text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_shareholder(p_venue_id, p_name, p_kind); $$;
create function public.record_holding(p_venue_id uuid, p_shareholder_id uuid, p_basis_points integer, p_effective_from date, p_note text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_holding(p_venue_id, p_shareholder_id, p_basis_points, p_effective_from, p_note); $$;
create function public.shareholding_register(p_venue_id uuid, p_on date)
returns table (shareholder_id uuid, name text, kind text, basis_points integer, effective_from date)
language sql stable security invoker set search_path = ''
as $$ select * from private.shareholding_register(p_venue_id, p_on); $$;
create function public.shareholding_history(p_venue_id uuid)
returns table (shareholder_id uuid, name text, basis_points integer, effective_from date, note text, recorded_by text, recorded_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.shareholding_history(p_venue_id); $$;

revoke execute on function private.tds_quarter_start(timestamptz), private.tds_taxed_winnings(bigint, bigint), private.holdings_on(uuid, date)
  from public, anon, authenticated;
revoke execute on function private.tds_ledger(uuid, date, date), private.tds_return_extract(uuid, date), private.my_tds_certificates(),
  private.add_shareholder(uuid, text, text), private.record_holding(uuid, uuid, integer, date, text), private.shareholding_register(uuid, date),
  private.shareholding_history(uuid), public.tds_ledger(uuid, date, date), public.tds_return_extract(uuid, date), public.my_tds_certificates(),
  public.add_shareholder(uuid, text, text), public.record_holding(uuid, uuid, integer, date, text), public.shareholding_register(uuid, date),
  public.shareholding_history(uuid) from public, anon;
grant execute on function private.tds_ledger(uuid, date, date), private.tds_return_extract(uuid, date), private.my_tds_certificates(),
  private.add_shareholder(uuid, text, text), private.record_holding(uuid, uuid, integer, date, text), private.shareholding_register(uuid, date),
  private.shareholding_history(uuid), public.tds_ledger(uuid, date, date), public.tds_return_extract(uuid, date), public.my_tds_certificates(),
  public.add_shareholder(uuid, text, text), public.record_holding(uuid, uuid, integer, date, text), public.shareholding_register(uuid, date),
  public.shareholding_history(uuid) to authenticated;
