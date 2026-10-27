-- The bank's name for a member's UPI address (#503; question #496 item 2, the owner's answer of 27 Oct; decision 0241).
-- When a member adds a UPI address, the payout-name-check function asks the payouts provider whose it is (Cashfree's
-- VPA check, through @rivr/adapters; the practice venue's fake answers with the member's own name), and the cage sees
-- that name beside the member's KYC name before verifying the account. Staff decide; nothing is refused for a mismatch.

alter table public.payout_account
  -- The account holder's name as the bank gives it, or null until asked.
  add column bank_holder_name text check (bank_holder_name is null or length(btrim(bank_holder_name)) between 1 and 200),
  -- found: the bank named its holder; not_found: the bank knows no such address.
  add column name_check text check (name_check is null or name_check in ('found', 'not_found')),
  add column name_checked_at timestamptz,
  add column name_check_attempts integer not null default 0,
  add column name_check_claimed_at timestamptz,
  add check ((name_check is null) = (name_checked_at is null)),
  add check (name_check = 'found' or bank_holder_name is null);

-- The UPI addresses waiting for their name, for the payout-name-check function (service role): pending, in use, not
-- yet answered, tried fewer than five times, and not claimed in the last two minutes. Each is claimed as it is given.
create function private.claim_payout_name_checks()
returns table (account_id uuid, vpa text, full_name text, is_practice boolean)
language sql
volatile
security definer
set search_path = ''
as $$
  with due as (
    select a.id from public.payout_account a
    where a.kind = 'upi' and a.status = 'pending' and a.removed_at is null and a.name_checked_at is null and a.name_check_attempts < 5
      and (a.name_check_claimed_at is null or a.name_check_claimed_at < now() - interval '2 minutes')
    order by a.created_at
    limit 50
    for update skip locked
  ),
  claimed as (
    update public.payout_account a set name_check_claimed_at = now(), name_check_attempts = a.name_check_attempts + 1
    from due where a.id = due.id
    returning a.id, a.vpa, a.member_id, a.venue_id
  )
  select c.id, c.vpa, m.full_name, v.is_practice
  from claimed c join public.member m on m.id = c.member_id join public.venue v on v.id = c.venue_id;
$$;

-- The provider's answer for one address: its holder's name, or that it knows no such address.
create function private.record_payout_name_check(p_account_id uuid, p_outcome text, p_holder_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome not in ('found', 'not_found') or (p_outcome = 'found') <> (length(btrim(coalesce(p_holder_name, ''))) > 0) then
    raise exception 'found with a name, or not_found' using errcode = '22023';
  end if;
  update public.payout_account a
  set name_check = p_outcome, bank_holder_name = case when p_outcome = 'found' then btrim(p_holder_name) end, name_checked_at = now()
  where a.id = p_account_id and a.name_checked_at is null;
end;
$$;

-- As before (20261020090100_payout_accounts.sql), with the bank's name for each, once known.
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

create function public.claim_payout_name_checks()
returns table (account_id uuid, vpa text, full_name text, is_practice boolean)
language sql volatile security invoker set search_path = ''
as $$ select * from private.claim_payout_name_checks(); $$;
create function public.record_payout_name_check(p_account_id uuid, p_outcome text, p_holder_name text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_payout_name_check(p_account_id, p_outcome, p_holder_name); $$;

revoke execute on function private.payout_accounts_to_verify(uuid), public.payout_accounts_to_verify(uuid) from public, anon;
grant execute on function private.payout_accounts_to_verify(uuid), public.payout_accounts_to_verify(uuid) to authenticated;
revoke execute on function private.claim_payout_name_checks(), private.record_payout_name_check(uuid, text, text),
  public.claim_payout_name_checks(), public.record_payout_name_check(uuid, text, text) from public, anon, authenticated;
grant execute on function private.claim_payout_name_checks(), private.record_payout_name_check(uuid, text, text),
  public.claim_payout_name_checks(), public.record_payout_name_check(uuid, text, text) to service_role;

select private.schedule_outbox_consumer('payout-name-check', '* * * * *');
