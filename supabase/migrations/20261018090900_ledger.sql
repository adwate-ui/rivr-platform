-- The double-entry ledger (scope-v1, "Architecture"; .claude/rules/money.md). Every rupee moves
-- through it. A balance is a sum of entries, never a stored number. Entries are immutable;
-- corrections are reversing transactions. Each transaction's entries sum to zero and use one unit:
-- points are a separate ledger and never mix with money. Amounts are integer paise (or points),
-- debits positive. Writes go only through private.post_ledger_transaction().

create type public.ledger_account_kind as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
create type public.ledger_unit as enum ('paise', 'points');

create table public.ledger_account (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  code text not null check (code ~ '^[a-z_]+(\.[a-z_]+)*$'),
  name text not null check (length(trim(name)) > 0),
  kind public.ledger_account_kind not null,
  unit public.ledger_unit not null default 'paise',
  -- Set for a member's own accounts (cash, bonus, points, receivable).
  member_id uuid,
  -- Players' money, such as member cash and jackpot pools, is never revenue.
  is_players_money boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  unique nulls not distinct (venue_id, code, member_id),
  unique (id, venue_id)
);

create index ledger_account_member_idx on public.ledger_account (member_id, venue_id);

create table public.ledger_transaction (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- What happened: buy_in, cash_out, marker_issue, hand_rake, jackpot_drop, reversal, opening_balance...
  kind text not null check (kind ~ '^[a-z_]+$'),
  -- A retried tap or a replayed offline write carries the same key and lands once.
  idempotency_key text not null check (length(idempotency_key) > 0),
  occurred_at timestamptz not null default now(),
  memo text,
  reverses_transaction_id uuid references public.ledger_transaction (id),
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, idempotency_key),
  unique (id, venue_id),
  -- A transaction is reversed at most once.
  unique (reverses_transaction_id)
);

create index ledger_transaction_occurred_idx on public.ledger_transaction (venue_id, occurred_at);

create table public.ledger_entry (
  id bigint generated always as identity primary key,
  venue_id uuid not null references public.venue (id),
  transaction_id uuid not null,
  account_id uuid not null,
  amount bigint not null check (amount <> 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (account_id, venue_id) references public.ledger_account (id, venue_id)
);

create index ledger_entry_transaction_idx on public.ledger_entry (transaction_id, venue_id);
create index ledger_entry_account_idx on public.ledger_entry (account_id, venue_id);

-- Checked when the transaction commits: at least two entries, summing to zero, in one unit.
-- Security definer so it sees every entry: under the session's row-level security a member or
-- a tablet sees only part of a transaction, and a balanced posting would look unbalanced.
create function private.assert_transaction_balanced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_row jsonb;
  txn_id uuid;
  entry_count integer;
  total numeric;
  unit_count integer;
begin
  -- A delete (purge) has only the old row; an insert has only the new one.
  if tg_op = 'DELETE' then
    changed_row := to_jsonb(old);
  else
    changed_row := to_jsonb(new);
  end if;
  -- Fires for both tables: an entry names its transaction; a transaction is its own id.
  if tg_table_name = 'ledger_entry' then
    txn_id := (changed_row ->> 'transaction_id')::uuid;
  else
    txn_id := (changed_row ->> 'id')::uuid;
  end if;
  -- Purge removed the whole transaction: nothing is left to balance.
  if not exists (select 1 from public.ledger_transaction t where t.id = txn_id) then
    return null;
  end if;
  select count(*), coalesce(sum(e.amount), 0), count(distinct a.unit)
  into entry_count, total, unit_count
  from public.ledger_entry e
  join public.ledger_account a on a.id = e.account_id
  where e.transaction_id = txn_id;
  if entry_count < 2 or total <> 0 or unit_count <> 1 then
    raise exception 'ledger transaction % is unbalanced: % entries, total %, % units', txn_id, entry_count, total, unit_count
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger ledger_entry_balanced
  after insert or delete on public.ledger_entry
  deferrable initially deferred
  for each row execute function private.assert_transaction_balanced();
create constraint trigger ledger_transaction_balanced
  after insert on public.ledger_transaction
  deferrable initially deferred
  for each row execute function private.assert_transaction_balanced();

-- The ledger is append-only. The only exception is purge, a super_admin testing tool (lane A):
-- it runs as the database owner with rivr.purge set for its own transaction, for a caller who
-- holds purge.run at the row's venue. Purge only deletes, and the balance check above makes it
-- delete whole transactions.
create function private.ledger_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('rivr.purge', true) = 'on'
     and current_user = 'postgres'
     and (session_user = 'postgres' or private.has_permission(old.venue_id, 'purge.run')) then
    return old;
  end if;
  raise exception '% is append-only; post a reversing transaction instead', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger ledger_entry_append_only before update or delete on public.ledger_entry
  for each row execute function private.ledger_append_only();
create trigger ledger_transaction_append_only before update or delete on public.ledger_transaction
  for each row execute function private.ledger_append_only();
create trigger ledger_entry_no_truncate before truncate on public.ledger_entry
  for each statement execute function private.refuse_change();
create trigger ledger_transaction_no_truncate before truncate on public.ledger_transaction
  for each statement execute function private.refuse_change();
create trigger ledger_account_touch_updated_at before update on public.ledger_account
  for each row execute function private.touch_updated_at();
create trigger ledger_account_audit after insert or update or delete on public.ledger_account
  for each row execute function private.audit_row_change();

-- Refuses lines that name another venue's account, have fewer than two entries, do not sum to
-- zero or mix points with money. The commit-time trigger checks the same for any other writer.
create function private.check_ledger_lines(p_venue_id uuid, p_lines jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  line_count integer;
  total numeric;
  unit_count integer;
  foreign_count integer;
begin
  select count(*), coalesce(sum((line ->> 'amount')::bigint), 0), count(distinct a.unit), count(*) filter (where a.id is null)
  into line_count, total, unit_count, foreign_count
  from jsonb_array_elements(p_lines) line
  left join public.ledger_account a on a.id = (line ->> 'account_id')::uuid and a.venue_id = p_venue_id;
  if foreign_count > 0 then
    raise exception 'a ledger line names an account outside venue %', p_venue_id using errcode = 'foreign_key_violation';
  end if;
  if line_count < 2 or total <> 0 or unit_count <> 1 then
    raise exception 'ledger lines must be two or more, sum to zero and use one unit (got %, total %, % units)',
      line_count, total, unit_count using errcode = 'check_violation';
  end if;
end;
$$;

-- The transaction already posted under this key, or null. A retry must repeat the original
-- exactly: a key reused for a different kind, reversal or set of lines is refused.
create function private.find_ledger_replay(
  p_venue_id uuid,
  p_idempotency_key text,
  p_kind text,
  p_lines jsonb,
  p_reverses_transaction_id uuid
)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  original public.ledger_transaction;
  posted_lines text[];
  given_lines text[];
begin
  select * into original from public.ledger_transaction t
  where t.venue_id = p_venue_id and t.idempotency_key = p_idempotency_key;
  if not found then return null; end if;

  -- Each line as 'account amount', sorted, so the order lines were sent in does not matter.
  select array_agg(e.account_id::text || ' ' || e.amount::text order by e.account_id, e.amount)
  into posted_lines
  from public.ledger_entry e where e.transaction_id = original.id;
  select array_agg(((line ->> 'account_id')::uuid)::text || ' ' || ((line ->> 'amount')::bigint)::text
                   order by (line ->> 'account_id')::uuid, (line ->> 'amount')::bigint)
  into given_lines
  from jsonb_array_elements(p_lines) line;

  if original.kind <> p_kind
     or original.reverses_transaction_id is distinct from p_reverses_transaction_id
     or posted_lines is distinct from given_lines then
    raise exception 'idempotency key % was already used for a different ledger transaction', p_idempotency_key
      using errcode = 'unique_violation';
  end if;
  return original.id;
end;
$$;

-- Posts one balanced transaction and returns its id. p_lines is a JSON array of
-- {"account_id": uuid, "amount": "<integer paise or points as a string>"}.
-- p_feature names the kill switch that stops this money movement ('withdrawals', 'credit'...);
-- pass null only when no switch covers it. It has no default so every caller decides.
-- Replaying the same idempotency key returns the first transaction and writes nothing.
create function private.post_ledger_transaction(
  p_venue_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_lines jsonb,
  p_feature public.killable_feature,
  p_memo text default null,
  p_reverses_transaction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  txn_id uuid;
begin
  txn_id := private.find_ledger_replay(p_venue_id, p_idempotency_key, p_kind, p_lines, p_reverses_transaction_id);
  if txn_id is not null then return txn_id; end if;

  perform private.assert_writable(p_venue_id, p_feature);
  perform private.check_ledger_lines(p_venue_id, p_lines);
  -- A frozen member's accounts take no postings, whichever lane writes them.
  perform private.assert_writable(p_venue_id, null, a.member_id)
  from public.ledger_account a
  where a.member_id is not null
    and a.id in (select (line ->> 'account_id')::uuid from jsonb_array_elements(p_lines) line);

  insert into public.ledger_transaction (venue_id, kind, idempotency_key, memo, reverses_transaction_id, created_by_user_id)
  values (p_venue_id, p_kind, p_idempotency_key, p_memo, p_reverses_transaction_id, (select auth.uid()))
  on conflict (venue_id, idempotency_key) do nothing
  returning id into txn_id;
  -- A concurrent call with the same key committed first: answer as a replay.
  if txn_id is null then
    return private.find_ledger_replay(p_venue_id, p_idempotency_key, p_kind, p_lines, p_reverses_transaction_id);
  end if;

  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select p_venue_id, txn_id, (line ->> 'account_id')::uuid, (line ->> 'amount')::bigint
  from jsonb_array_elements(p_lines) line;
  return txn_id;
end;
$$;

-- Posts the exact opposite of a transaction, linked to it. A transaction is reversed at most once.
-- A reversal is a staff correction, so no feature switch stops it; a venue or member freeze does.
create function private.reverse_ledger_transaction(
  p_transaction_id uuid,
  p_idempotency_key text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.ledger_transaction;
  reversal_id uuid;
begin
  select * into original from public.ledger_transaction t where t.id = p_transaction_id;
  if not found then
    raise exception 'ledger transaction % does not exist', p_transaction_id using errcode = 'no_data_found';
  end if;
  reversal_id := private.post_ledger_transaction(
    original.venue_id, 'reversal', p_idempotency_key,
    (select jsonb_agg(jsonb_build_object('account_id', e.account_id, 'amount', (-e.amount)::text))
     from public.ledger_entry e where e.transaction_id = p_transaction_id),
    null, p_reason, p_transaction_id);
  return reversal_id;
end;
$$;

grant execute on function private.post_ledger_transaction(uuid, text, text, jsonb, public.killable_feature, text, uuid),
  private.reverse_ledger_transaction(uuid, text, text) to service_role;

-- Every member gets a cash, bonus, points and receivable account when they join.
create function private.open_member_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ledger_account (venue_id, code, name, kind, unit, member_id, is_players_money) values
    (new.venue_id, 'member.cash', 'Cash balance', 'liability', 'paise', new.id, true),
    (new.venue_id, 'member.bonus', 'Bonus balance', 'liability', 'paise', new.id, false),
    (new.venue_id, 'member.points', 'Points', 'liability', 'points', new.id, false),
    (new.venue_id, 'member.receivable', 'Markers outstanding', 'asset', 'paise', new.id, false);
  return null;
end;
$$;

create trigger member_open_accounts after insert on public.member
  for each row execute function private.open_member_accounts();

-- Balances: the sum of entries. natural_balance is positive for an account's normal side
-- (assets and expenses debit, everything else credit), so a member's cash shows as a positive amount.
create view public.ledger_balance
with (security_invoker = true)
as
select a.id as account_id, a.venue_id, a.code, a.name, a.kind, a.unit, a.member_id,
       coalesce(sum(e.amount), 0)::bigint as balance,
       (coalesce(sum(e.amount), 0) * case when a.kind in ('asset', 'expense') then 1 else -1 end)::bigint as natural_balance
from public.ledger_account a
left join public.ledger_entry e on e.account_id = a.id
group by a.id;

-- Chip denominations: the smallest chip is ₹50, so every denomination is a multiple of 5000 paise.
create table public.chip_denomination (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  value_paise bigint not null check (value_paise >= 5000 and value_paise % 5000 = 0),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, value_paise)
);

create trigger chip_denomination_touch_updated_at before update on public.chip_denomination
  for each row execute function private.touch_updated_at();
create trigger chip_denomination_audit after insert or update or delete on public.chip_denomination
  for each row execute function private.audit_row_change();

alter table public.ledger_account enable row level security;
alter table public.ledger_transaction enable row level security;
alter table public.ledger_entry enable row level security;
alter table public.chip_denomination enable row level security;
grant select on public.ledger_account, public.ledger_transaction, public.ledger_entry, public.ledger_balance to authenticated;
grant select, insert, update on public.chip_denomination to authenticated;

create policy "members see their accounts; ledger staff see the venue's" on public.ledger_account
  for select to authenticated
  using (member_id = (select private.current_member_id()) or venue_id in (select private.venues_where('ledger.read')));

create policy "members see their entries; ledger staff see the venue's" on public.ledger_entry
  for select to authenticated
  using (
    venue_id in (select private.venues_where('ledger.read'))
    or account_id in (select a.id from public.ledger_account a where a.member_id = (select private.current_member_id()))
  );

-- The subquery reads ledger_entry under its own policy above, so a member matches only the
-- transactions that touch one of their accounts.
create policy "members see their transactions; ledger staff see the venue's" on public.ledger_transaction
  for select to authenticated
  using (
    venue_id in (select private.venues_where('ledger.read'))
    or id in (select e.transaction_id from public.ledger_entry e)
  );

create policy "staff and devices see the venue's chips" on public.chip_denomination
  for select to authenticated
  using (
    venue_id in (select private.staff_venues())
    or venue_id in (select d.venue_id from public.device d where d.id = (select private.current_device_id()))
  );

create policy "setting managers manage chips" on public.chip_denomination
  for insert to authenticated
  with check (venue_id in (select private.venues_where('settings.manage')));

create policy "setting managers change chips" on public.chip_denomination
  for update to authenticated
  using (venue_id in (select private.venues_where('settings.manage')))
  with check (venue_id in (select private.venues_where('settings.manage')));
