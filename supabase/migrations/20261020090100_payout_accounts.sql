-- Payout accounts (#19; scope-v1 module 5, "withdrawal requests from the app to verified payout
-- accounts"; design prompt: Arjun's "HDFC Bank, UPI verified"). A member adds a UPI address or a bank
-- account; it is unusable until a cashier verifies it at the cage (or turns it down, with a reason),
-- and every change is audited. The member and the venue's cage staff see it; no one else, and no other
-- venue. A member keeps at most three in use (RVMAX) and may remove one. Provider-based verification
-- comes later, through an adapter.

create table public.payout_account (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  kind text not null check (kind in ('upi', 'bank')),
  -- The bank the money lands in, as the member names it: "HDFC Bank".
  bank_name text not null check (length(btrim(bank_name)) between 2 and 60),
  vpa text check (vpa ~ '^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$'),
  account_number text check (account_number ~ '^[0-9]{9,18}$'),
  ifsc text check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  holder_name text check (length(btrim(holder_name)) between 2 and 100),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  decided_at timestamptz,
  decided_by_staff_id uuid,
  reject_reason text check (length(btrim(reject_reason)) between 3 and 200),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((kind = 'upi') = (vpa is not null)),
  check ((kind = 'bank') = (account_number is not null and ifsc is not null and holder_name is not null)),
  check ((status = 'pending') = (decided_at is null) and (decided_at is null) = (decided_by_staff_id is null)),
  check ((status = 'rejected') = (reject_reason is not null))
);

comment on table public.payout_account is 'A member''s UPI address or bank account for withdrawals, usable once a cashier verifies it (#19).';

-- One of each in use per member.
create unique index payout_account_vpa_idx on public.payout_account (member_id, vpa) where removed_at is null and vpa is not null;
create unique index payout_account_bank_idx on public.payout_account (member_id, ifsc, account_number) where removed_at is null and account_number is not null;
create index payout_account_member_idx on public.payout_account (member_id, venue_id);
create index payout_account_waiting_idx on public.payout_account (venue_id, created_at) where status = 'pending' and removed_at is null;
create index payout_account_decider_idx on public.payout_account (decided_by_staff_id, venue_id);
create trigger payout_account_touch_updated_at before update on public.payout_account
  for each row execute function private.touch_updated_at();
-- The audit log is append-only, read by more than the cage (an investor's audit.read) and outlives an
-- erasure request, so it records how an account moved, never its number, IFSC, holder or address.
create function private.audit_payout_account_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe text[] := array['id', 'member_id', 'kind', 'bank_name', 'status', 'decided_at', 'decided_by_staff_id', 'reject_reason', 'removed_at'];
begin
  perform private.audit(
    new.venue_id, lower(tg_op), 'payout_account', new.id::text,
    case when tg_op = 'UPDATE' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(old)) as e (k, v) where k = any (safe)) end,
    (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(new)) as e (k, v) where k = any (safe))
  );
  return null;
end;
$$;

create trigger payout_account_audit after insert or update on public.payout_account
  for each row execute function private.audit_payout_account_change();

alter table public.payout_account enable row level security;
grant select on public.payout_account to authenticated;
create policy "members see their own payout accounts" on public.payout_account
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "the cage sees the venue's payout accounts" on public.payout_account
  for select to authenticated using (venue_id in (select private.venues_where('cage.transact')));

-- The signed-in member adds a UPI address or a bank account, waiting for the cage.
create function private.add_payout_account(p_kind text, p_bank_name text, p_vpa text default null, p_account_number text default null,
                                           p_ifsc text default null, p_holder_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_id uuid;
begin
  select * into v_member from public.member m where m.id = private.current_member_id() for update;
  if v_member.id is null then
    raise exception 'Only a member adds a payout account' using errcode = '42501';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  if (select count(*) from public.payout_account a where a.member_id = v_member.id and a.removed_at is null and a.status <> 'rejected') >= 3 then
    raise exception 'Three payout accounts at most' using errcode = 'RVMAX';
  end if;
  insert into public.payout_account (venue_id, member_id, kind, bank_name, vpa, account_number, ifsc, holder_name)
  values (v_member.venue_id, v_member.id, p_kind, btrim(p_bank_name),
          case when p_kind = 'upi' then lower(btrim(p_vpa)) end,
          case when p_kind = 'bank' then btrim(p_account_number) end,
          case when p_kind = 'bank' then upper(btrim(p_ifsc)) end,
          case when p_kind = 'bank' then btrim(p_holder_name) end)
  returning id into v_id;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'A UPI address, or a bank account number, IFSC and holder''s name, with the bank''s name' using errcode = '22023';
end;
$$;

-- The member removes one of theirs: it is kept, for the record, and can no longer be paid to.
create function private.remove_payout_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_writable(m.venue_id, null, m.id) from public.member m where m.id = private.current_member_id();
  update public.payout_account a set removed_at = now()
  where a.id = p_account_id and a.member_id = private.current_member_id() and a.removed_at is null;
  if not found then
    raise exception 'Not one of your payout accounts' using errcode = '22023';
  end if;
end;
$$;

-- A cashier verifies a waiting account, or turns it down with a reason (shown to the member). Only a
-- verified account not removed is usable for a withdrawal (#21).
create function private.decide_payout_account(p_account_id uuid, p_is_verified boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.payout_account;
begin
  select * into v_account from public.payout_account a where a.id = p_account_id for update;
  -- Never one's own, as with a KYC check: a cashier who is also a member verifies none of theirs.
  if v_account.id is null or not private.has_permission(v_account.venue_id, 'cage.transact') or private.is_own_kyc_check(v_account.member_id) then
    raise exception 'Only the cage verifies payout accounts, and never its own' using errcode = '42501';
  end if;
  perform private.assert_writable(v_account.venue_id, null, v_account.member_id);
  if v_account.status <> 'pending' or v_account.removed_at is not null then
    raise exception 'That account is not waiting' using errcode = '22023';
  end if;
  if not p_is_verified and length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'Say why it is turned down' using errcode = '22023';
  end if;
  update public.payout_account
  set status = case when p_is_verified then 'verified' else 'rejected' end, decided_at = now(),
      decided_by_staff_id = private.current_staff_id(v_account.venue_id), reject_reason = case when p_is_verified then null else btrim(p_reason) end
  where id = p_account_id;
end;
$$;

-- The venue's accounts waiting for the cage, oldest first, with whose they are.
create function private.payout_accounts_to_verify(p_venue_id uuid)
returns table (account_id uuid, member_id uuid, full_name text, phone text, kind text, bank_name text, vpa text, account_number text,
               ifsc text, holder_name text, added_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, m.id, m.full_name, m.phone, a.kind, a.bank_name, a.vpa, a.account_number, a.ifsc, a.holder_name, a.created_at
  from public.payout_account a
  join public.member m on m.id = a.member_id
  where a.venue_id = p_venue_id and a.status = 'pending' and a.removed_at is null and private.has_permission(p_venue_id, 'cage.transact')
  order by a.created_at, a.id;
$$;

revoke execute on function private.add_payout_account(text, text, text, text, text, text), private.remove_payout_account(uuid),
  private.decide_payout_account(uuid, boolean, text), private.payout_accounts_to_verify(uuid) from public, anon;
grant execute on function private.add_payout_account(text, text, text, text, text, text), private.remove_payout_account(uuid),
  private.decide_payout_account(uuid, boolean, text), private.payout_accounts_to_verify(uuid) to authenticated;

create function public.add_payout_account(p_kind text, p_bank_name text, p_vpa text default null, p_account_number text default null,
                                          p_ifsc text default null, p_holder_name text default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_payout_account(p_kind, p_bank_name, p_vpa, p_account_number, p_ifsc, p_holder_name); $$;
create function public.remove_payout_account(p_account_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.remove_payout_account(p_account_id); $$;
create function public.decide_payout_account(p_account_id uuid, p_is_verified boolean, p_reason text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.decide_payout_account(p_account_id, p_is_verified, p_reason); $$;
create function public.payout_accounts_to_verify(p_venue_id uuid)
returns table (account_id uuid, member_id uuid, full_name text, phone text, kind text, bank_name text, vpa text, account_number text,
               ifsc text, holder_name text, added_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.payout_accounts_to_verify(p_venue_id); $$;

revoke execute on function public.add_payout_account(text, text, text, text, text, text), public.remove_payout_account(uuid),
  public.decide_payout_account(uuid, boolean, text), public.payout_accounts_to_verify(uuid) from public, anon;
grant execute on function public.add_payout_account(text, text, text, text, text, text), public.remove_payout_account(uuid),
  public.decide_payout_account(uuid, boolean, text), public.payout_accounts_to_verify(uuid) to authenticated;

-- The signed-in member's payout accounts in use, oldest first.
create function public.my_payout_accounts()
returns table (id uuid, kind text, bank_name text, vpa text, account_number text, ifsc text, holder_name text, status text, reject_reason text)
language sql stable security invoker set search_path = ''
as $$
  select a.id, a.kind, a.bank_name, a.vpa, a.account_number, a.ifsc, a.holder_name, a.status, a.reject_reason
  from public.payout_account a
  where a.member_id = private.current_member_id() and a.removed_at is null
  order by a.created_at, a.id;
$$;
revoke execute on function public.my_payout_accounts() from public, anon;
grant execute on function public.my_payout_accounts() to authenticated;