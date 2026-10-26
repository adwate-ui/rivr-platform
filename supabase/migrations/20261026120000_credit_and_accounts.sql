-- Credit at the cage, payment accounts and expenses (#92, #94, #95; scope-v1 module 5; additions "Expenses
-- and payment accounts"; decisions 0167 and 0168).
-- * A repayment, by cash or UPI, settles a member's open markers oldest first, as a cash-out's chips do,
--   and never more than they owe (@rivr/domain repayment). The credit report gives what each member owes
--   at any moment, by age: 0 to 7 days, 8 to 30, 31 to 60 and over 60 (@rivr/domain ageingBucket).
-- * Each payment account (the cash drawer, a UPI handle, a bank account) is a ledger account with a
--   balance; a transfer between two posts one balanced transaction; a statement lists an account's
--   entries over a period, with its balance before and after.
-- * An expense, in a category (an expense ledger account of its own), is requested with its receipt in a
--   private bucket and posts from a payment account only when a second person approves it. Through the
--   ledger it counts in the end-of-day close like every other movement of the drawer.
-- treasury.manage (admin and super_admin) sets up accounts and categories, moves money between accounts
-- and decides expenses.

insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array['treasury.manage']) as permission;

insert into public.role_permission (role, permission)
select 'admin', permission
from unnest(array['treasury.manage']) as permission;

-- ---------------------------------------------------------------------------------------------------
-- Repayment and the credit report (#92).

alter table public.cage_transaction drop constraint cage_transaction_kind_check;
alter table public.cage_transaction add constraint cage_transaction_kind_check check (kind in ('buy_in', 'cash_out', 'marker_repayment'));

-- @rivr/domain ageingBucket: whole days since issue, counted down; 0 to 7, 8 to 30, 31 to 60, over 60.
create function private.credit_age_bucket(p_issued_at timestamptz, p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when d.days <= 7 then '0_7' when d.days <= 30 then '8_30' when d.days <= 60 then '31_60' else 'over_60' end
  from (select greatest(0, floor(extract(epoch from (p_at - p_issued_at)) / 86400))::integer as days) d;
$$;

-- @rivr/domain repayment: what a repayment settles on each open marker (oldest first), or why it is
-- refused: 'not_chips', 'nothing_owed' or 'more_than_owed'.
create function private.repayment_split(p_amount_paise bigint, p_outstanding_paise bigint[])
returns table (settled_paise bigint[], refusal text)
language sql
immutable
set search_path = ''
as $$
  select case when r.refusal is null then s.settled_paise end, r.refusal
  from private.cash_out_split(p_amount_paise, p_outstanding_paise) s
  cross join lateral (select case
    when s.to_member_paise is null then 'not_chips'
    when coalesce((select sum(o) from unnest(p_outstanding_paise) o), 0) = 0 then 'nothing_owed'
    when s.to_member_paise > 0 then 'more_than_owed' end as refusal) r;
$$;

-- A cashier (cage.transact) takes a repayment of a member's markers by cash or UPI (with its 12-digit
-- UTR). The money goes into the drawer or the bank; the member's receivable comes down; each marker it
-- reaches is settled, and one paid in full is marked settled. A retried tap with the same key gives the
-- same repayment. Refusals: 42501 not a cashier, RVNOM no such member, 22023 a method that is not cash
-- or UPI with its UTR, or a key already used for something else, RVUTR a UTR already used, RVCHP not
-- whole chips, RVNOD nothing owed, RVOVR more than is owed, RVFRZ/RVMBR the venue or member frozen,
-- RVNSH no cage shift open.
create function private.repay_markers(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_utr text,
                                      p_idempotency_key uuid)
returns table (o_cage_transaction_id uuid, o_settled_paise bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- An empty UTR is none, as a cash repayment sends it.
  v_utr text := nullif(trim(p_utr), '');
  v_markers uuid[];
  v_owes bigint[];
  v_split record;
  v_txn uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier takes a repayment' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if p_method is null or p_method not in ('cash', 'upi') or (p_method = 'upi') <> (v_utr is not null)
     or (v_utr is not null and v_utr !~ '^[0-9]{12}$') or p_idempotency_key is null then
    raise exception 'A repayment is by cash, or UPI with its 12-digit UTR, with its key' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  select c.id into v_id from public.cage_transaction c where c.venue_id = p_venue_id and c.idempotency_key = p_idempotency_key;
  if v_id is not null then
    if not exists (select 1 from public.cage_transaction c where c.id = v_id and c.kind = 'marker_repayment' and c.member_id = p_member_id
                   and c.amount_paise = p_amount_paise and c.method = p_method and c.utr is not distinct from v_utr) then
      raise exception 'That key was used for something else' using errcode = '22023';
    end if;
    return query select v_id, coalesce((select sum(s.amount_paise) from public.marker_settlement s where s.cage_transaction_id = v_id), 0)::bigint;
    return;
  end if;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if exists (select 1 from public.cage_transaction c where c.venue_id = p_venue_id and c.utr = v_utr) then
    raise exception 'That UTR already paid for something else' using errcode = 'RVUTR';
  end if;
  select array_agg(k.id order by k.issued_at, k.id), array_agg(k.outstanding_paise order by k.issued_at, k.id) into v_markers, v_owes
  from (select k.id, k.issued_at, k.outstanding_paise from public.marker k
        where k.member_id = p_member_id and k.settled_at is null order by k.issued_at, k.id for update) k;
  select * into v_split from private.repayment_split(p_amount_paise, v_owes);
  if v_split.refusal = 'not_chips' then raise exception 'A repayment is whole ₹50 chips' using errcode = 'RVCHP'; end if;
  if v_split.refusal = 'nothing_owed' then raise exception 'Nothing is owed on markers' using errcode = 'RVNOD'; end if;
  if v_split.refusal = 'more_than_owed' then raise exception 'More than is owed on markers' using errcode = 'RVOVR'; end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'marker_repayment', 'marker_repayment:' || p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.member_id is null
                                          and a.code = case p_method when 'cash' then 'venue.cash_drawer' else 'venue.bank' end),
                         'amount', p_amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.receivable'),
                         'amount', (-p_amount_paise)::text)),
    null, 'Marker repayment at the cage');
  insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise, utr, ledger_transaction_id, cashier_staff_id, idempotency_key)
  values (p_venue_id, p_member_id, 'marker_repayment', p_method, p_amount_paise, v_utr, v_txn,
          private.current_staff_id(p_venue_id), p_idempotency_key)
  returning id into v_id;
  for i in 1 .. coalesce(array_length(v_split.settled_paise, 1), 0) loop
    update public.marker
    set outstanding_paise = outstanding_paise - v_split.settled_paise[i],
        settled_at = case when v_split.settled_paise[i] = v_owes[i] then now() end
    where id = v_markers[i];
    insert into public.marker_settlement (venue_id, marker_id, cage_transaction_id, amount_paise)
    values (p_venue_id, v_markers[i], v_id, v_split.settled_paise[i]);
    if v_split.settled_paise[i] = v_owes[i] then
      perform private.emit(p_venue_id, 'marker.settled',
                           jsonb_build_object('marker_id', v_markers[i], 'member_id', p_member_id, 'cage_transaction_id', v_id),
                           'marker.settled:' || v_markers[i]);
    end if;
  end loop;
  return query select v_id, p_amount_paise;
end;
$$;

-- The credit report (#92): every member who owed on markers at a moment, what they owed then by age, the
-- oldest marker's issue, and whether one was past due. What a marker owed then is its amount less what
-- was settled on it by then, so the report for any past day stands as it was. For staff who see markers.
create function private.credit_report(p_venue_id uuid, p_at timestamptz)
returns table (member_id uuid, full_name text, member_number bigint, limit_paise bigint, owed_0_7_paise bigint, owed_8_30_paise bigint,
               owed_31_60_paise bigint, owed_over_60_paise bigint, owed_paise bigint, oldest_issued_at timestamptz, is_past_due boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with owed as (
    select k.member_id, k.issued_at, k.due_at,
           k.amount_paise - coalesce((select sum(s.amount_paise) from public.marker_settlement s
                                      where s.marker_id = k.id and s.created_at <= p_at), 0) as owed_paise
    from public.marker k
    where k.venue_id = p_venue_id and k.issued_at <= p_at
      and (private.has_permission(p_venue_id, 'markers.issue') or private.has_permission(p_venue_id, 'markers.manage_limits')
           or private.has_permission(p_venue_id, 'ledger.read'))
  )
  select m.id, m.full_name, m.member_number, coalesce(l.limit_paise, 0),
         coalesce(sum(o.owed_paise) filter (where private.credit_age_bucket(o.issued_at, p_at) = '0_7'), 0)::bigint,
         coalesce(sum(o.owed_paise) filter (where private.credit_age_bucket(o.issued_at, p_at) = '8_30'), 0)::bigint,
         coalesce(sum(o.owed_paise) filter (where private.credit_age_bucket(o.issued_at, p_at) = '31_60'), 0)::bigint,
         coalesce(sum(o.owed_paise) filter (where private.credit_age_bucket(o.issued_at, p_at) = 'over_60'), 0)::bigint,
         sum(o.owed_paise)::bigint, min(o.issued_at), bool_or(o.due_at < p_at)
  from owed o
  join public.member m on m.id = o.member_id
  left join public.credit_line l on l.venue_id = m.venue_id and l.member_id = m.id
  where o.owed_paise > 0
  group by m.id, m.full_name, m.member_number, l.limit_paise
  order by sum(o.owed_paise) desc, m.full_name;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Payment accounts (#94).

-- A place the club's money is: the cash drawer, a UPI handle or a bank account, each its own ledger
-- account. The drawer and 'Bank and UPI' every venue starts with are its first two.
create table public.payment_account (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  kind text not null check (kind in ('cash_drawer', 'upi', 'bank')),
  name text not null check (length(trim(name)) between 1 and 60),
  -- The UPI handle, or the bank and the account's last four digits: what staff see, never a full number.
  details text check (details is null or length(trim(details)) between 1 and 80),
  ledger_account_id uuid not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ledger_account_id, venue_id) references public.ledger_account (id, venue_id),
  unique (id, venue_id)
);
comment on table public.payment_account is 'Where the club''s money is: the drawer, a UPI handle or a bank account, each a ledger account (#94).';
create index payment_account_venue_idx on public.payment_account (venue_id);
create trigger payment_account_touch_updated_at before update on public.payment_account
  for each row execute function private.touch_updated_at();
create trigger payment_account_audit after insert or update or delete on public.payment_account
  for each row execute function private.audit_row_change();
alter table public.payment_account enable row level security;
grant select on public.payment_account to authenticated;
create policy "staff who read the ledger see payment accounts" on public.payment_account
  for select to authenticated using (venue_id in (select private.venues_where('ledger.read')));

-- The drawer and the bank a venue has, and has from now on, are payment accounts.
insert into public.payment_account (venue_id, kind, name, ledger_account_id)
select a.venue_id, case a.code when 'venue.cash_drawer' then 'cash_drawer' else 'bank' end, a.name, a.id
from public.ledger_account a where a.member_id is null and a.code in ('venue.cash_drawer', 'venue.bank');

create function private.payment_account_for_ledger_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The practice reset reloads a venue's payment accounts with its ledger accounts: those stand.
  insert into public.payment_account (venue_id, kind, name, ledger_account_id)
  values (new.venue_id, case new.code when 'venue.cash_drawer' then 'cash_drawer' else 'bank' end, new.name, new.id)
  on conflict (ledger_account_id) do nothing;
  return null;
end;
$$;
create trigger ledger_account_payment_account after insert on public.ledger_account
  for each row when (new.member_id is null and new.code in ('venue.cash_drawer', 'venue.bank'))
  execute function private.payment_account_for_ledger_account();

-- A ledger code for a new account of its own: letters only, as ledger_account.code allows.
create function private.new_ledger_code(p_prefix text)
returns text
language sql
volatile
set search_path = ''
as $$
  select p_prefix || '.' || translate(left(replace(gen_random_uuid()::text, '-', ''), 16), '0123456789', 'ghijklmnop');
$$;

-- treasury.manage adds a UPI handle or a bank account. Refusals: 42501, 22023 a kind or name not allowed.
create function private.add_payment_account(p_venue_id uuid, p_kind text, p_name text, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'treasury.manage') then
    raise exception 'Only treasury managers add payment accounts' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('upi', 'bank') or length(trim(coalesce(p_name, ''))) not between 1 and 60
     or length(trim(coalesce(p_details, ''))) > 80 then
    raise exception 'A UPI handle or a bank account, with a name' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money)
  values (p_venue_id, private.new_ledger_code('venue.payment'), trim(p_name), 'asset', 'paise', false)
  returning id into v_account;
  insert into public.payment_account (venue_id, kind, name, details, ledger_account_id)
  values (p_venue_id, p_kind, trim(p_name), nullif(trim(coalesce(p_details, '')), ''), v_account)
  returning id into v_id;
  return v_id;
end;
$$;

-- The venue's payment accounts with their balances, for staff who read the ledger.
create function private.payment_accounts(p_venue_id uuid)
returns table (payment_account_id uuid, kind text, name text, details text, is_active boolean, balance_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kind, p.name, p.details, p.is_active, private.account_balance(p.ledger_account_id)
  from public.payment_account p
  where p.venue_id = p_venue_id and private.has_permission(p_venue_id, 'ledger.read')
  order by case p.kind when 'cash_drawer' then 0 when 'bank' then 1 else 2 end, p.name;
$$;

-- A transfer between two of a venue's payment accounts: one balanced transaction, kept with who made it.
create table public.account_transfer (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 100 = 0),
  note text check (note is null or length(trim(note)) between 1 and 200),
  ledger_transaction_id uuid not null,
  staff_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (from_account_id, venue_id) references public.payment_account (id, venue_id),
  foreign key (to_account_id, venue_id) references public.payment_account (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (staff_id, venue_id) references public.staff (id, venue_id),
  unique (venue_id, idempotency_key),
  check (from_account_id <> to_account_id)
);
comment on table public.account_transfer is 'Money moved between two payment accounts (#94).';
create index account_transfer_from_idx on public.account_transfer (from_account_id, venue_id);
create index account_transfer_to_idx on public.account_transfer (to_account_id, venue_id);
create index account_transfer_ledger_idx on public.account_transfer (ledger_transaction_id, venue_id);
create index account_transfer_staff_idx on public.account_transfer (staff_id, venue_id);
create trigger account_transfer_touch_updated_at before update on public.account_transfer
  for each row execute function private.touch_updated_at();
create trigger account_transfer_audit after insert or update or delete on public.account_transfer
  for each row execute function private.audit_row_change();
alter table public.account_transfer enable row level security;
grant select on public.account_transfer to authenticated;
create policy "staff who read the ledger see transfers" on public.account_transfer
  for select to authenticated using (venue_id in (select private.venues_where('ledger.read')));

-- treasury.manage moves money from one payment account to another, in whole rupees. A balance is only
-- what the ledger has moved (the drawer's float is counted at each shift, not posted), so no transfer is
-- refused for it (decision 0167). A retried tap with the same key gives the same transfer. Refusals:
-- 42501, 22023 the same account twice, one not the venue's or not active, or not whole rupees, RVFRZ the
-- venue frozen, RVNSH the drawer or the bank with no cage shift open.
create function private.transfer_between_accounts(p_venue_id uuid, p_from_id uuid, p_to_id uuid, p_amount_paise bigint, p_note text,
                                                  p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.payment_account;
  v_to public.payment_account;
  v_txn uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'treasury.manage') then
    raise exception 'Only treasury managers move money between accounts' using errcode = '42501';
  end if;
  select t.id into v_id from public.account_transfer t where t.venue_id = p_venue_id and t.idempotency_key = p_idempotency_key;
  if v_id is not null then
    -- A retried tap gives the same transfer; the same key with other figures is refused, never taken as done.
    if not exists (select 1 from public.account_transfer t where t.id = v_id and t.from_account_id = p_from_id and t.to_account_id = p_to_id
                   and t.amount_paise = p_amount_paise) then
      raise exception 'That key was used for another transfer' using errcode = '22023';
    end if;
    return v_id;
  end if;
  select * into v_from from public.payment_account p where p.id = p_from_id and p.venue_id = p_venue_id and p.is_active for update;
  select * into v_to from public.payment_account p where p.id = p_to_id and p.venue_id = p_venue_id and p.is_active;
  if v_from.id is null or v_to.id is null or v_from.id = v_to.id or p_amount_paise is null or p_amount_paise <= 0
     or p_amount_paise % 100 <> 0 or p_idempotency_key is null or length(trim(coalesce(p_note, ''))) > 200 then
    raise exception 'Two active accounts of this venue, and whole rupees' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  v_txn := private.post_ledger_transaction(p_venue_id, 'account_transfer', 'account_transfer:' || p_idempotency_key,
    jsonb_build_array(jsonb_build_object('account_id', v_to.ledger_account_id, 'amount', p_amount_paise::text),
                      jsonb_build_object('account_id', v_from.ledger_account_id, 'amount', (-p_amount_paise)::text)),
    null, coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Transfer from ' || v_from.name || ' to ' || v_to.name));
  insert into public.account_transfer (venue_id, from_account_id, to_account_id, amount_paise, note, ledger_transaction_id, staff_id, idempotency_key)
  values (p_venue_id, v_from.id, v_to.id, p_amount_paise, nullif(trim(coalesce(p_note, '')), ''), v_txn, private.current_staff_id(p_venue_id),
          p_idempotency_key)
  returning id into v_id;
  return v_id;
end;
$$;

-- A payment account's statement for a period (#94): its balance before the period, then each entry in
-- it, oldest first, with what happened and the balance after it. For staff who read the ledger.
create function private.account_statement(p_payment_account_id uuid, p_from timestamptz, p_to timestamptz)
returns table (occurred_at timestamptz, kind text, memo text, amount_paise bigint, balance_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with account as (
    select p.ledger_account_id from public.payment_account p
    where p.id = p_payment_account_id and private.has_permission(p.venue_id, 'ledger.read') and p_from <= p_to
  ),
  opening as (
    select coalesce(sum(e.amount), 0)::bigint as balance
    from public.ledger_entry e join public.ledger_transaction t on t.id = e.transaction_id
    where e.account_id = (select ledger_account_id from account) and t.occurred_at < p_from
  ),
  lines as (
    select t.occurred_at, t.kind, t.memo, e.amount, e.id
    from public.ledger_entry e join public.ledger_transaction t on t.id = e.transaction_id
    where e.account_id = (select ledger_account_id from account) and t.occurred_at >= p_from and t.occurred_at < p_to
  )
  select s.occurred_at, s.kind, s.memo, s.amount_paise, s.balance_paise
  from (
    select p_from as occurred_at, 'opening_balance' as kind, null::text as memo, 0::bigint as amount_paise,
           (select balance from opening) as balance_paise, 0 as part, 0::bigint as entry_id
    where exists (select 1 from account)
    union all
    select l.occurred_at, l.kind, l.memo, l.amount,
           ((select balance from opening) + sum(l.amount) over (order by l.occurred_at, l.id))::bigint, 1, l.id
    from lines l
  ) s
  order by s.part, s.occurred_at, s.entry_id;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Expenses (#95).

-- A kind of spending, with its own expense ledger account, so each category adds up in the books.
create table public.expense_category (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(trim(name)) between 1 and 60),
  ledger_account_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ledger_account_id, venue_id) references public.ledger_account (id, venue_id),
  unique (venue_id, name),
  unique (id, venue_id)
);
comment on table public.expense_category is 'A kind of spending, with its own expense ledger account (#95).';
create trigger expense_category_touch_updated_at before update on public.expense_category
  for each row execute function private.touch_updated_at();
create trigger expense_category_audit after insert or update or delete on public.expense_category
  for each row execute function private.audit_row_change();
alter table public.expense_category enable row level security;
grant select on public.expense_category to authenticated;
create policy "the cage and treasury managers see expense categories" on public.expense_category
  for select to authenticated using (venue_id in (select private.venues_where('cage.transact'))
                                     or venue_id in (select private.venues_where('treasury.manage')));

-- An expense: asked for with its receipt, then approved (and posted) or turned down by a second person.
create table public.expense (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  category_id uuid not null,
  payment_account_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 100 = 0),
  payee text not null check (length(trim(payee)) between 1 and 80),
  note text check (note is null or length(trim(note)) between 1 and 300),
  -- The receipt, in the private expense-receipts bucket: <venue_id>/<expense_id>.<jpg|png|webp>.
  receipt_path text check (receipt_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  requested_by_staff_id uuid not null,
  decided_by_staff_id uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or length(trim(decision_note)) between 1 and 200),
  ledger_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, venue_id) references public.expense_category (id, venue_id),
  foreign key (payment_account_id, venue_id) references public.payment_account (id, venue_id),
  foreign key (requested_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  -- Decided once, by someone other than who asked; posted exactly when approved.
  check ((status = 'requested') = (decided_at is null) and (decided_at is null) = (decided_by_staff_id is null)),
  check (decided_by_staff_id is distinct from requested_by_staff_id),
  check ((status = 'approved') = (ledger_transaction_id is not null))
);
comment on table public.expense is 'An expense, approved by a second person before it posts from a payment account (#95).';
create index expense_venue_status_idx on public.expense (venue_id, status, created_at);
create index expense_category_idx on public.expense (category_id, venue_id);
create index expense_account_idx on public.expense (payment_account_id, venue_id);
create index expense_requested_idx on public.expense (requested_by_staff_id, venue_id);
create index expense_decided_idx on public.expense (decided_by_staff_id, venue_id);
create index expense_ledger_idx on public.expense (ledger_transaction_id, venue_id);
create trigger expense_touch_updated_at before update on public.expense
  for each row execute function private.touch_updated_at();
create trigger expense_audit after insert or update or delete on public.expense
  for each row execute function private.audit_row_change();
alter table public.expense enable row level security;
grant select on public.expense to authenticated;
create policy "the cage and treasury managers see expenses" on public.expense
  for select to authenticated using (venue_id in (select private.venues_where('cage.transact'))
                                     or venue_id in (select private.venues_where('treasury.manage')));

-- Receipts: private, photos up to 5 MB, at <venue>/<expense>.<jpg|png|webp>. The cage and treasury
-- managers of that venue read them, and upload one only for an expense not yet asked for; nobody else,
-- and nobody changes or deletes one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create function private.may_handle_receipts(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- The folder is checked before it is read as a venue's id, so any other name is simply refused.
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then private.has_permission(split_part(p_name, '/', 1)::uuid, 'cage.transact')
                   or private.has_permission(split_part(p_name, '/', 1)::uuid, 'treasury.manage')
              else false end;
$$;
create function private.may_upload_receipt(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
              then private.may_handle_receipts(p_name)
                   and not exists (select 1 from public.expense e where e.id = split_part(split_part(p_name, '/', 2), '.', 1)::uuid)
              else false end;
$$;
create policy "the cage and treasury managers upload expense receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'expense-receipts' and (select private.may_upload_receipt(name)));
create policy "the cage and treasury managers read expense receipts" on storage.objects
  for select to authenticated using (bucket_id = 'expense-receipts' and (select private.may_handle_receipts(name)));

-- treasury.manage adds a category, with its expense ledger account. Refusals: 42501, 22023 a name not allowed or taken.
create function private.add_expense_category(p_venue_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'treasury.manage') then
    raise exception 'Only treasury managers add expense categories' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 60
     or exists (select 1 from public.expense_category c where c.venue_id = p_venue_id and lower(c.name) = lower(trim(p_name))) then
    raise exception 'A new category, named' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money)
  values (p_venue_id, private.new_ledger_code('venue.expense'), 'Expense: ' || trim(p_name), 'expense', 'paise', false)
  returning id into v_account;
  insert into public.expense_category (venue_id, name, ledger_account_id) values (p_venue_id, trim(p_name), v_account) returning id into v_id;
  return v_id;
end;
$$;

-- The cage or a treasury manager asks for an expense, with the receipt they uploaded under its id. A
-- retried tap gives the same expense. Refusals: 42501, 22023 a category or account not the venue's, an
-- amount not in whole rupees, a receipt not uploaded by them for this expense, or the id of another
-- expense, RVFRZ the venue frozen.
create function private.request_expense(p_venue_id uuid, p_expense_id uuid, p_category_id uuid, p_payment_account_id uuid,
                                        p_amount_paise bigint, p_payee text, p_note text, p_receipt_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not (private.has_permission(p_venue_id, 'cage.transact') or private.has_permission(p_venue_id, 'treasury.manage')) then
    raise exception 'Only the cage or treasury managers ask for an expense' using errcode = '42501';
  end if;
  if exists (select 1 from public.expense e where e.id = p_expense_id) then
    if not exists (select 1 from public.expense e where e.id = p_expense_id and e.venue_id = p_venue_id and e.category_id = p_category_id
                   and e.payment_account_id = p_payment_account_id and e.amount_paise = p_amount_paise and e.payee = trim(p_payee)
                   and e.requested_by_staff_id = private.current_staff_id(p_venue_id)) then
      raise exception 'That id is another expense' using errcode = '22023';
    end if;
    return p_expense_id;
  end if;
  if p_expense_id is null
     or (nullif(p_receipt_path, '') is not null
         and not exists (select 1 from storage.objects o where o.bucket_id = 'expense-receipts' and o.name = p_receipt_path
                         and o.owner_id = (select auth.uid())::text))
     or not exists (select 1 from public.expense_category c where c.id = p_category_id and c.venue_id = p_venue_id)
     or not exists (select 1 from public.payment_account p where p.id = p_payment_account_id and p.venue_id = p_venue_id and p.is_active)
     or p_amount_paise is null or p_amount_paise <= 0 or p_amount_paise % 100 <> 0 or length(trim(coalesce(p_payee, ''))) not between 1 and 80
     or length(trim(coalesce(p_note, ''))) > 300
     or (nullif(p_receipt_path, '') is not null and p_receipt_path !~ ('^' || p_venue_id || '/' || p_expense_id || '\.(jpg|png|webp)$')) then
    raise exception 'A category and an account of this venue, whole rupees, a payee, and this expense''s receipt' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.expense (id, venue_id, category_id, payment_account_id, amount_paise, payee, note, receipt_path, requested_by_staff_id)
  values (p_expense_id, p_venue_id, p_category_id, p_payment_account_id, p_amount_paise, trim(p_payee), nullif(trim(coalesce(p_note, '')), ''),
          nullif(p_receipt_path, ''), private.current_staff_id(p_venue_id));
  return p_expense_id;
end;
$$;

-- A treasury manager, not the one who asked, approves an expense (it posts from its payment account to
-- its category) or turns it down with a reason. Refusals: 42501 not a treasury manager or the one who
-- asked, 22023 decided already, or no reason to turn it down, RVFRZ the venue frozen, RVNSH the drawer or
-- the bank with no cage shift open.
create function private.decide_expense(p_expense_id uuid, p_is_approved boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expense;
  v_staff uuid;
  v_txn uuid;
begin
  select * into v_expense from public.expense e where e.id = p_expense_id for update;
  if v_expense.id is null or not private.has_permission(v_expense.venue_id, 'treasury.manage') then
    raise exception 'Only treasury managers decide expenses' using errcode = '42501';
  end if;
  v_staff := private.current_staff_id(v_expense.venue_id);
  if v_staff = v_expense.requested_by_staff_id then
    raise exception 'A second person decides an expense' using errcode = '42501';
  end if;
  if v_expense.status <> 'requested' or p_is_approved is null or length(trim(coalesce(p_note, ''))) > 200
     or (not p_is_approved and length(trim(coalesce(p_note, ''))) = 0) then
    raise exception 'An expense waiting for a decision, and a reason to turn it down' using errcode = '22023';
  end if;
  perform private.assert_writable(v_expense.venue_id);
  if p_is_approved then
    v_txn := private.post_ledger_transaction(v_expense.venue_id, 'expense', 'expense:' || v_expense.id,
      jsonb_build_array(
        jsonb_build_object('account_id', (select c.ledger_account_id from public.expense_category c where c.id = v_expense.category_id),
                           'amount', v_expense.amount_paise::text),
        jsonb_build_object('account_id', (select p.ledger_account_id from public.payment_account p where p.id = v_expense.payment_account_id),
                           'amount', (-v_expense.amount_paise)::text)),
      null, 'Expense: ' || v_expense.payee);
  end if;
  update public.expense
  set status = case when p_is_approved then 'approved' else 'rejected' end, decided_by_staff_id = v_staff, decided_at = now(),
      decision_note = nullif(trim(coalesce(p_note, '')), ''), ledger_transaction_id = v_txn
  where id = v_expense.id;
end;
$$;

-- The venue's expenses for the cage and treasury managers: those waiting first, then the last 90 days',
-- with who asked (and whether it was the one reading) and who decided.
create function private.venue_expenses(p_venue_id uuid)
returns table (expense_id uuid, category text, payment_account text, amount_paise bigint, payee text, note text, receipt_path text,
               status text, requested_by text, is_mine boolean, requested_at timestamptz, decided_by text, decided_at timestamptz,
               decision_note text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, c.name, p.name, e.amount_paise, e.payee, e.note, e.receipt_path, e.status, r.full_name,
         e.requested_by_staff_id = private.current_staff_id(p_venue_id), e.created_at, d.full_name, e.decided_at, e.decision_note
  from public.expense e
  join public.expense_category c on c.id = e.category_id
  join public.payment_account p on p.id = e.payment_account_id
  join public.staff r on r.id = e.requested_by_staff_id
  left join public.staff d on d.id = e.decided_by_staff_id
  where e.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'cage.transact') or private.has_permission(p_venue_id, 'treasury.manage'))
    and (e.status = 'requested' or e.created_at > now() - interval '90 days')
  order by e.status <> 'requested', e.created_at desc, e.id desc;
$$;

-- ---------------------------------------------------------------------------------------------------
-- The end-of-day close (#45) and the cage's computers (#384) with these in place.

-- As before, with one change: money moved into the bank from another of the club's accounts (a cash
-- deposit, say) is no receipt from a player, so the close's UPI and bank receipts leave transfers out.
-- An expense or a transfer out of the drawer lowers the cash expected, as every drawer line does.
create or replace function private.shift_expected(p_shift_id uuid)
returns table (cash_paise bigint, chips_paise bigint, receipts_paise bigint, markers_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with shift as (select * from public.cage_shift s where s.id = p_shift_id),
  moved as (
    select a.code, e.amount, t.kind
    from shift
    join public.ledger_account a on a.venue_id = shift.venue_id and a.code in ('venue.cash_drawer', 'venue.chips_outstanding', 'venue.bank')
    join public.ledger_entry e on e.account_id = a.id and e.id > shift.opened_after_entry_id
    join public.ledger_transaction t on t.id = e.transaction_id
  ),
  opening as (
    select c.id from public.chip_inventory_count c join shift on c.shift_id = shift.id order by c.counted_at, c.id limit 1
  )
  select (shift.float_paise + coalesce((select sum(m.amount) from moved m where m.code = 'venue.cash_drawer'), 0))::bigint,
         (coalesce((select sum(l.value_paise * l.quantity) from public.chip_inventory_line l join opening o on o.id = l.count_id), 0)
          + coalesce((select sum(m.amount) from moved m where m.code = 'venue.chips_outstanding'), 0))::bigint,
         coalesce((select sum(m.amount) from moved m where m.code = 'venue.bank' and m.amount > 0 and m.kind <> 'account_transfer'), 0)::bigint,
         coalesce((select sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.venue_id = shift.venue_id and a.code = 'member.receivable'), 0)::bigint
  from shift;
$$;

-- treasury.manage moves the club's money, so where a venue keeps money work to its computers, it is
-- held to the admin computer as the other console money powers are (#384).
create or replace function private.computer_kind_for(p_permission text)
returns public.device_kind
language sql
immutable
set search_path = ''
as $$
  select case
    when p_permission in ('cage.transact', 'cage.second_approve', 'markers.issue', 'withdrawals.approve') then 'cage'::public.device_kind
    when p_permission in ('settings.manage', 'staff.manage', 'devices.manage', 'tiers.manage', 'venue.configure', 'control.engage',
                          'purge.run', 'exports.full', 'treasury.manage') then 'console'::public.device_kind
  end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- What the apps call.

create function public.repay_markers(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_utr text, p_idempotency_key uuid)
returns table (o_cage_transaction_id uuid, o_settled_paise bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.repay_markers(p_venue_id, p_member_id, p_amount_paise, p_method, p_utr, p_idempotency_key); $$;
create function public.credit_report(p_venue_id uuid, p_at timestamptz)
returns table (member_id uuid, full_name text, member_number bigint, limit_paise bigint, owed_0_7_paise bigint, owed_8_30_paise bigint,
               owed_31_60_paise bigint, owed_over_60_paise bigint, owed_paise bigint, oldest_issued_at timestamptz, is_past_due boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.credit_report(p_venue_id, p_at); $$;
create function public.add_payment_account(p_venue_id uuid, p_kind text, p_name text, p_details text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_payment_account(p_venue_id, p_kind, p_name, p_details); $$;
create function public.payment_accounts(p_venue_id uuid)
returns table (payment_account_id uuid, kind text, name text, details text, is_active boolean, balance_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.payment_accounts(p_venue_id); $$;
create function public.transfer_between_accounts(p_venue_id uuid, p_from_id uuid, p_to_id uuid, p_amount_paise bigint, p_note text,
                                                 p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.transfer_between_accounts(p_venue_id, p_from_id, p_to_id, p_amount_paise, p_note, p_idempotency_key); $$;
create function public.account_statement(p_payment_account_id uuid, p_from timestamptz, p_to timestamptz)
returns table (occurred_at timestamptz, kind text, memo text, amount_paise bigint, balance_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.account_statement(p_payment_account_id, p_from, p_to); $$;
create function public.add_expense_category(p_venue_id uuid, p_name text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_expense_category(p_venue_id, p_name); $$;
create function public.request_expense(p_venue_id uuid, p_expense_id uuid, p_category_id uuid, p_payment_account_id uuid, p_amount_paise bigint,
                                       p_payee text, p_note text, p_receipt_path text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.request_expense(p_venue_id, p_expense_id, p_category_id, p_payment_account_id, p_amount_paise, p_payee, p_note, p_receipt_path); $$;
create function public.decide_expense(p_expense_id uuid, p_is_approved boolean, p_note text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.decide_expense(p_expense_id, p_is_approved, p_note); $$;
create function public.venue_expenses(p_venue_id uuid)
returns table (expense_id uuid, category text, payment_account text, amount_paise bigint, payee text, note text, receipt_path text,
               status text, requested_by text, is_mine boolean, requested_at timestamptz, decided_by text, decided_at timestamptz,
               decision_note text)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_expenses(p_venue_id); $$;

revoke execute on function private.venue_expenses(uuid), public.venue_expenses(uuid) from public, anon;
grant execute on function private.venue_expenses(uuid), public.venue_expenses(uuid) to authenticated;
revoke execute on function private.credit_age_bucket(timestamptz, timestamptz), private.repayment_split(bigint, bigint[]),
  private.payment_account_for_ledger_account(), private.new_ledger_code(text), private.may_handle_receipts(text), private.may_upload_receipt(text)
  from public, anon, authenticated;
grant execute on function private.may_handle_receipts(text), private.may_upload_receipt(text) to authenticated;
revoke execute on function private.repay_markers(uuid, uuid, bigint, text, text, uuid), private.credit_report(uuid, timestamptz),
  private.add_payment_account(uuid, text, text, text), private.payment_accounts(uuid),
  private.transfer_between_accounts(uuid, uuid, uuid, bigint, text, uuid), private.account_statement(uuid, timestamptz, timestamptz),
  private.add_expense_category(uuid, text), private.request_expense(uuid, uuid, uuid, uuid, bigint, text, text, text),
  private.decide_expense(uuid, boolean, text) from public, anon;
grant execute on function private.repay_markers(uuid, uuid, bigint, text, text, uuid), private.credit_report(uuid, timestamptz),
  private.add_payment_account(uuid, text, text, text), private.payment_accounts(uuid),
  private.transfer_between_accounts(uuid, uuid, uuid, bigint, text, uuid), private.account_statement(uuid, timestamptz, timestamptz),
  private.add_expense_category(uuid, text), private.request_expense(uuid, uuid, uuid, uuid, bigint, text, text, text),
  private.decide_expense(uuid, boolean, text) to authenticated;
revoke execute on function public.repay_markers(uuid, uuid, bigint, text, text, uuid), public.credit_report(uuid, timestamptz),
  public.add_payment_account(uuid, text, text, text), public.payment_accounts(uuid),
  public.transfer_between_accounts(uuid, uuid, uuid, bigint, text, uuid), public.account_statement(uuid, timestamptz, timestamptz),
  public.add_expense_category(uuid, text), public.request_expense(uuid, uuid, uuid, uuid, bigint, text, text, text),
  public.decide_expense(uuid, boolean, text) from public, anon;
grant execute on function public.repay_markers(uuid, uuid, bigint, text, text, uuid), public.credit_report(uuid, timestamptz),
  public.add_payment_account(uuid, text, text, text), public.payment_accounts(uuid),
  public.transfer_between_accounts(uuid, uuid, uuid, bigint, text, uuid), public.account_statement(uuid, timestamptz, timestamptz),
  public.add_expense_category(uuid, text), public.request_expense(uuid, uuid, uuid, uuid, bigint, text, text, text),
  public.decide_expense(uuid, boolean, text) to authenticated;

-- The practice venue now has its drawer and bank as payment accounts: its seed is taken again, so a
-- reset brings them back as they are (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
