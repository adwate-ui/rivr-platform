-- The bank's name for a member's UPI address (#503; question #496 item 2, the owner's answer of 27 Oct; decision 0241).
-- When a KYC-verified member adds a UPI address, the payout-name-check function asks the payouts provider whose it is
-- (Cashfree's VPA check, through @rivr/adapters; the practice venue's fake answers with the member's own name), and the
-- cage sees that name beside the member's KYC name before verifying the account. Staff decide; nothing is refused
-- for a mismatch. Only the cage reads the bank's name, never the member: it is not a way to look up whose an address is.

alter table public.payout_account
  -- The account holder's name as the bank gives it, or null until asked.
  add column bank_holder_name text check (bank_holder_name is null or length(btrim(bank_holder_name)) between 1 and 200),
  -- found: the bank named its holder; no_name: the bank knows the address but gave no name; not_found: it knows none.
  add column name_check text check (name_check is null or name_check in ('found', 'no_name', 'not_found')),
  add column name_checked_at timestamptz,
  add check ((name_check is null) = (name_checked_at is null)),
  add check ((name_check = 'found') = (bank_holder_name is not null));

-- A member reads their own accounts, as before, but not what the bank said of them.
revoke select on public.payout_account from authenticated;
grant select (id, venue_id, member_id, kind, bank_name, vpa, account_number, ifsc, holder_name, status, decided_at, decided_by_staff_id,
              reject_reason, removed_at, created_at, updated_at) on public.payout_account to authenticated;

-- The function's own bookkeeping, apart from the account (so asking writes no audit row): tries and the last claim.
create table private.payout_name_check_claim (
  account_id uuid primary key references public.payout_account (id) on delete cascade,
  attempts integer not null default 0,
  claimed_at timestamptz not null default now()
);
alter table private.payout_name_check_claim enable row level security;
revoke all on private.payout_name_check_claim from public, anon, authenticated;

-- The UPI addresses waiting for their name, for the payout-name-check function (service role): pending, in use, of a
-- KYC-verified member, at a venue not frozen, not yet answered, tried fewer than five times, each try twice as long
-- after the last (2, 4, 8, 16 minutes), so a short outage does not use them up. A member whose addresses were asked
-- about six times in a day waits: each check is billed, and adding and removing addresses must not run up the bill.
-- The practice venue's always; a real venue's only once the function can ask Cashfree (p_with_provider), so a venue
-- without its keys spends no tries. The member's name goes only to the practice venue's fake, which answers with it.
-- Each is claimed as it is given.
create function private.claim_payout_name_checks(p_with_provider boolean)
returns table (account_id uuid, vpa text, full_name text, is_practice boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select a.id, a.vpa, case when v.is_practice then m.full_name end as full_name, v.is_practice
    from public.payout_account a
    join public.member m on m.id = a.member_id
    join public.venue v on v.id = a.venue_id
    left join private.payout_name_check_claim c on c.account_id = a.id
    where a.kind = 'upi' and a.status = 'pending' and a.removed_at is null and a.name_checked_at is null
      and (v.is_practice or p_with_provider)
      and exists (select 1 from public.kyc_record k where k.member_id = a.member_id and k.status = 'verified')
      and not exists (select 1 from public.control_state f where f.venue_id = a.venue_id and f.level = 'venue_freeze' and f.released_at is null)
      and coalesce(c.attempts, 0) < 5
      and (c.claimed_at is null or c.claimed_at < now() - interval '1 minute' * power(2, c.attempts))
      and (select count(*) from private.payout_name_check_claim mc join public.payout_account ma on ma.id = mc.account_id
           where ma.member_id = a.member_id and mc.claimed_at > now() - interval '1 day') < 6
    order by a.created_at
    limit 50
  ),
  claimed as (
    insert into private.payout_name_check_claim as c (account_id, attempts, claimed_at)
    select due.id, 1, now() from due
    on conflict on constraint payout_name_check_claim_pkey do update set attempts = c.attempts + 1, claimed_at = now()
    returning c.account_id
  )
  select due.id, due.vpa, due.full_name, due.is_practice from due join claimed on claimed.account_id = due.id;
end;
$$;

-- The provider's answer for one address: its holder's name, that it gave none, or that it knows no such address.
create function private.record_payout_name_check(p_account_id uuid, p_outcome text, p_holder_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome is null or p_outcome not in ('found', 'no_name', 'not_found')
     or (p_outcome = 'found') <> (length(btrim(coalesce(p_holder_name, ''))) > 0) then
    raise exception 'found with a name, no_name or not_found' using errcode = '22023';
  end if;
  update public.payout_account a
  set name_check = p_outcome, bank_holder_name = case when p_outcome = 'found' then left(btrim(p_holder_name), 200) end, name_checked_at = now()
  where a.id = p_account_id and a.name_checked_at is null;
end;
$$;

-- As before (20261020090100_payout_accounts.sql), with what the bank said of each, once known.
drop function public.payout_accounts_to_verify(uuid);
drop function private.payout_accounts_to_verify(uuid);
create function private.payout_accounts_to_verify(p_venue_id uuid)
returns table (account_id uuid, member_id uuid, full_name text, phone text, kind text, bank_name text, vpa text, account_number text,
               ifsc text, holder_name text, added_at timestamptz, name_check text, bank_holder_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, m.id, m.full_name, m.phone, a.kind, a.bank_name, a.vpa, a.account_number, a.ifsc, a.holder_name, a.created_at,
         a.name_check, a.bank_holder_name
  from public.payout_account a
  join public.member m on m.id = a.member_id
  where a.venue_id = p_venue_id and a.status = 'pending' and a.removed_at is null and private.has_permission(p_venue_id, 'cage.transact')
  order by a.created_at, a.id;
$$;
create function public.payout_accounts_to_verify(p_venue_id uuid)
returns table (account_id uuid, member_id uuid, full_name text, phone text, kind text, bank_name text, vpa text, account_number text,
               ifsc text, holder_name text, added_at timestamptz, name_check text, bank_holder_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.payout_accounts_to_verify(p_venue_id); $$;

create function public.claim_payout_name_checks(p_with_provider boolean)
returns table (account_id uuid, vpa text, full_name text, is_practice boolean)
language sql volatile security invoker set search_path = ''
as $$ select * from private.claim_payout_name_checks(p_with_provider); $$;
create function public.record_payout_name_check(p_account_id uuid, p_outcome text, p_holder_name text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_payout_name_check(p_account_id, p_outcome, p_holder_name); $$;

revoke execute on function private.payout_accounts_to_verify(uuid), public.payout_accounts_to_verify(uuid) from public, anon;
grant execute on function private.payout_accounts_to_verify(uuid), public.payout_accounts_to_verify(uuid) to authenticated;
revoke execute on function private.claim_payout_name_checks(boolean), private.record_payout_name_check(uuid, text, text),
  public.claim_payout_name_checks(boolean), public.record_payout_name_check(uuid, text, text) from public, anon, authenticated;
grant execute on function private.claim_payout_name_checks(boolean), private.record_payout_name_check(uuid, text, text),
  public.claim_payout_name_checks(boolean), public.record_payout_name_check(uuid, text, text) to service_role;

-- A member's export (#498) lists every column; the export's list becomes a table, so a later column is one row more.
create table private.member_export_column (
  table_name text not null,
  column_name text not null,
  kind text not null check (kind in ('owed', 'note', 'other', 'withheld')),
  primary key (table_name, column_name)
);
insert into private.member_export_column (table_name, column_name, kind) select table_name, column_name, kind from private.member_export_columns();
insert into private.member_export_column (table_name, column_name, kind) values
  ('payout_account', 'bank_holder_name', 'owed'), ('payout_account', 'name_check', 'owed'), ('payout_account', 'name_checked_at', 'owed');
create or replace function private.member_export_columns()
returns table (table_name text, column_name text, kind text)
language sql
stable
set search_path = ''
as $$
  select c.table_name, c.column_name, c.kind from private.member_export_column c;
$$;
alter table private.member_export_column enable row level security;
revoke all on private.member_export_column from public, anon, authenticated;

select private.schedule_outbox_consumer('payout-name-check', '* * * * *');
