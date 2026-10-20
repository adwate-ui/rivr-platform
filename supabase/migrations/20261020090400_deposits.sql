-- UPI deposits (#29; scope-v1 "Money in": UPI into the club's account with UTR capture and bank
-- reconciliation; design prompt Deposit; decision 0064). A member whose tier has balance.deposits pays
-- the club's UPI address (venue configuration) from one of their verified UPI payout accounts (#19), and
-- enters the amount and the UTR. The cage finds the UTR in the bank statement, checks the payer, and
-- types the amount the bank shows: it must be the member's (RVAMT). From the dual-control threshold up a
-- second approver approves it first (#20). Confirmed, the bank pays the member's wallet; or the cage
-- turns it down as not found. A UTR pays one thing at the venue, whichever table holds it.

create table public.deposit_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 100 = 0),
  utr text not null check (utr ~ '^[0-9]{12}$'),
  -- The member's verified UPI account the money came from, for the cage to match against the statement.
  payout_account_id uuid not null references public.payout_account (id),
  status text not null default 'waiting' check (status in ('waiting', 'received', 'not_found')),
  ledger_transaction_id uuid,
  decided_at timestamptz,
  decided_by_staff_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, idempotency_key),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((status = 'received') = (ledger_transaction_id is not null)),
  check ((status = 'waiting') = (decided_at is null))
);

comment on table public.deposit_request is 'A member''s UPI deposit with its UTR, until the cage finds it in the bank (#29).';

-- A UTR is given for one deposit, ever: one turned down stays taken, so it never pays someone else.
create unique index deposit_request_utr_idx on public.deposit_request (venue_id, utr);
create index deposit_request_member_idx on public.deposit_request (member_id, venue_id, created_at);
create index deposit_request_queue_idx on public.deposit_request (venue_id, created_at) where status = 'waiting';
create index deposit_request_account_idx on public.deposit_request (payout_account_id);
create index deposit_request_ledger_idx on public.deposit_request (ledger_transaction_id, venue_id);
create index deposit_request_decider_idx on public.deposit_request (decided_by_staff_id, venue_id);
create trigger deposit_request_touch_updated_at before update on public.deposit_request
  for each row execute function private.touch_updated_at();
create trigger deposit_request_audit after insert or update on public.deposit_request
  for each row execute function private.audit_row_change();

alter table public.deposit_request enable row level security;
grant select on public.deposit_request to authenticated;
create policy "members see their own deposits" on public.deposit_request
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "the cage and its approvers see the venue's deposits" on public.deposit_request
  for select to authenticated
  using (venue_id in (select private.venues_where('cage.transact')) or venue_id in (select private.venues_where('cage.second_approve')));

-- One UTR, one payment, across every table that records one: a buy-in by UPI, an Academy payment (or a
-- UTR the cage turned down there), a withdrawal and a deposit. Each table keeps its own UTRs unique; this
-- refuses one another table holds (RVUTR), under a lock on the UTR so two at once cannot both pass.
create function private.refuse_used_utr()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.utr is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.venue_id::text || ':' || new.utr, 0));
  if (tg_table_name <> 'cage_transaction' and exists (select 1 from public.cage_transaction c where c.venue_id = new.venue_id and c.utr = new.utr))
     or (tg_table_name <> 'academy_booking' and (exists (select 1 from public.academy_booking k where k.venue_id = new.venue_id and k.utr = new.utr)
                                                   or exists (select 1 from public.academy_utr_rejection r where r.venue_id = new.venue_id and r.utr = new.utr)))
     or (tg_table_name <> 'withdrawal_request' and exists (select 1 from public.withdrawal_request w where w.venue_id = new.venue_id and w.utr = new.utr))
     or (tg_table_name <> 'deposit_request' and exists (select 1 from public.deposit_request d where d.venue_id = new.venue_id and d.utr = new.utr)) then
    raise exception 'That UTR already paid something else at this venue' using errcode = 'RVUTR';
  end if;
  return new;
end;
$$;

create trigger cage_transaction_one_utr before insert on public.cage_transaction
  for each row execute function private.refuse_used_utr();
create trigger academy_booking_one_utr before insert or update of utr on public.academy_booking
  for each row execute function private.refuse_used_utr();
create trigger withdrawal_request_one_utr before insert or update of utr on public.withdrawal_request
  for each row execute function private.refuse_used_utr();
create trigger deposit_request_one_utr before insert on public.deposit_request
  for each row execute function private.refuse_used_utr();

-- A deposit is the second cage write under dual control (#20, decision 0064).
alter table public.second_approval drop constraint second_approval_subject_check;
alter table public.second_approval add constraint second_approval_subject_check check (subject in ('withdrawal', 'deposit'));

-- Where the signed-in member pays a deposit: the club's UPI address and its name, for a member whose
-- tier has deposits. Nothing otherwise.
create function private.deposit_details()
returns table (upi_vpa text, upi_payee_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.upi_vpa, c.upi_payee_name
  from public.member m join public.venue_config c on c.venue_id = m.venue_id
  where m.id = private.current_member_id() and private.has_feature(m.id, 'balance.deposits') and c.upi_vpa is not null;
$$;

-- The signed-in member says they paid a deposit from one of their verified UPI accounts, once per
-- request id: KYC finished (RVKYC), the account theirs, UPI, verified and in use (RVPAY), whole rupees
-- and a 12-digit UTR (22023), a UTR never given before (RVUTR), and three in a day at most, waiting or
-- turned down (RVMAX).
create function private.request_deposit(p_amount_paise bigint, p_utr text, p_payout_account_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_replay public.deposit_request;
  v_id uuid;
begin
  select * into v_member from public.member m where m.id = private.current_member_id() for update;
  if v_member.id is null or not private.has_feature(v_member.id, 'balance.deposits') then
    raise exception 'Deposits are not open to this member' using errcode = '42501';
  end if;
  select * into v_replay from public.deposit_request d where d.venue_id = v_member.venue_id and d.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> v_member.id or v_replay.amount_paise <> p_amount_paise or v_replay.utr <> p_utr then
      raise exception 'That request id was used for another deposit' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  if not private.is_kyc_complete(v_member.id) then
    raise exception 'KYC incomplete: finish it to deposit' using errcode = 'RVKYC';
  end if;
  if not exists (select 1 from public.payout_account a where a.id = p_payout_account_id and a.member_id = v_member.id and a.kind = 'upi'
                 and a.status = 'verified' and a.removed_at is null) then
    raise exception 'Not a verified UPI account of yours' using errcode = 'RVPAY';
  end if;
  if p_amount_paise is null or p_amount_paise <= 0 or p_amount_paise % 100 <> 0 or p_utr is null or p_utr !~ '^[0-9]{12}$' then
    raise exception 'Whole rupees, and the 12-digit UTR' using errcode = '22023';
  end if;
  if (select count(*) from public.deposit_request d where d.member_id = v_member.id
      and (d.status = 'waiting' or (d.status = 'not_found' and d.decided_at > now() - interval '1 day'))) >= 3 then
    raise exception 'Three deposits wait or were turned down today' using errcode = 'RVMAX';
  end if;
  insert into public.deposit_request (venue_id, member_id, amount_paise, utr, payout_account_id, idempotency_key)
  values (v_member.venue_id, v_member.id, p_amount_paise, p_utr, p_payout_account_id, p_idempotency_key)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'That UTR was already given' using errcode = 'RVUTR';
end;
$$;

-- A waiting deposit, locked, for the staff member deciding it: never their own (as a KYC check, #19),
-- and a frozen member's or venue's waits.
create function private.waiting_deposit(p_request_id uuid, p_permission text)
returns public.deposit_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.deposit_request;
begin
  select * into v_request from public.deposit_request d where d.id = p_request_id for update;
  if v_request.id is null or not private.has_permission(v_request.venue_id, p_permission) or private.is_own_kyc_check(v_request.member_id) then
    raise exception 'Not allowed to decide this deposit' using errcode = '42501';
  end if;
  perform private.assert_writable(v_request.venue_id, null, v_request.member_id);
  if v_request.status <> 'waiting' then
    raise exception 'That deposit is not waiting' using errcode = '22023';
  end if;
  return v_request;
end;
$$;

-- A second approver approves a waiting deposit, for its own amount (#20).
create function private.second_approve_deposit(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.deposit_request;
begin
  v_request := private.waiting_deposit(p_request_id, 'cage.second_approve');
  return private.record_second_approval(v_request.venue_id, 'deposit', v_request.id, v_request.amount_paise);
end;
$$;

-- The cage found the deposit's UTR in the bank statement and types the amount the bank shows: it must
-- be the member's (RVAMT); from the threshold up, a second approver other than this cashier has
-- approved it (RVAPP). The bank pays the member's wallet cash.
create function private.confirm_deposit(p_request_id uuid, p_bank_amount_paise bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.deposit_request;
  v_staff uuid;
  v_txn uuid;
begin
  v_request := private.waiting_deposit(p_request_id, 'cage.transact');
  v_staff := private.current_staff_id(v_request.venue_id);
  if p_bank_amount_paise is distinct from v_request.amount_paise then
    raise exception 'The bank shows another amount: turn it down' using errcode = 'RVAMT';
  end if;
  perform private.assert_second_approved(v_request.venue_id, 'deposit', v_request.id, v_request.amount_paise, now(), v_staff);
  v_txn := private.post_ledger_transaction(v_request.venue_id, 'deposit', 'deposit:' || v_request.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_request.venue_id
                                         and a.code = 'venue.bank' and a.member_id is null), 'amount', v_request.amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_request.member_id and a.code = 'member.cash'),
                         'amount', (-v_request.amount_paise)::text)),
    null, 'Deposit · UTR ' || v_request.utr);
  update public.deposit_request
  set status = 'received', ledger_transaction_id = v_txn, decided_at = now(), decided_by_staff_id = v_staff
  where id = v_request.id;
  perform private.emit(v_request.venue_id, 'deposit.received',
                       jsonb_build_object('deposit_request_id', v_request.id, 'member_id', v_request.member_id, 'amount_paise', v_request.amount_paise),
                       'deposit.received:' || v_request.id);
end;
$$;

-- The cage did not find the deposit in the bank, or not as the member gave it: turned down, nothing
-- moves, and its UTR stays taken.
create function private.reject_deposit(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.deposit_request;
begin
  v_request := private.waiting_deposit(p_request_id, 'cage.transact');
  update public.deposit_request
  set status = 'not_found', decided_at = now(), decided_by_staff_id = private.current_staff_id(v_request.venue_id)
  where id = v_request.id;
  perform private.emit(v_request.venue_id, 'deposit.not_found',
                       jsonb_build_object('deposit_request_id', v_request.id, 'member_id', v_request.member_id, 'utr', v_request.utr),
                       'deposit.not_found:' || v_request.id);
end;
$$;

-- The venue's deposits waiting, oldest first: whose, the UTR to find and the account it came from, and
-- whether a second approver is needed and who has approved. Not the amount the member gave: the cage
-- reads it from the bank.
create function private.waiting_deposits(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, utr text, from_vpa text, from_bank text, requested_at timestamptz,
               needs_second boolean, approved_by text[])
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, m.id, m.full_name, d.utr, a.vpa, a.bank_name, d.created_at,
         private.second_approver_needed(d.venue_id, d.amount_paise, now()),
         coalesce((select array_agg(s.full_name order by sa.approved_at, sa.id) from public.second_approval sa join public.staff s on s.id = sa.approved_by_staff_id
                   where sa.venue_id = d.venue_id and sa.subject = 'deposit' and sa.subject_id = d.id and sa.amount_paise = d.amount_paise), '{}')
  from public.deposit_request d
  join public.member m on m.id = d.member_id
  join public.payout_account a on a.id = d.payout_account_id
  where d.venue_id = p_venue_id and d.status = 'waiting'
    and (private.has_permission(p_venue_id, 'cage.transact') or private.has_permission(p_venue_id, 'cage.second_approve'))
  order by d.created_at, d.id;
$$;

revoke execute on function private.refuse_used_utr(), private.waiting_deposit(uuid, text) from public, anon, authenticated;
revoke execute on function private.deposit_details(), private.request_deposit(bigint, text, uuid, uuid), private.second_approve_deposit(uuid),
  private.confirm_deposit(uuid, bigint), private.reject_deposit(uuid), private.waiting_deposits(uuid) from public, anon;
grant execute on function private.deposit_details(), private.request_deposit(bigint, text, uuid, uuid), private.second_approve_deposit(uuid),
  private.confirm_deposit(uuid, bigint), private.reject_deposit(uuid), private.waiting_deposits(uuid) to authenticated;

create function public.deposit_details()
returns table (upi_vpa text, upi_payee_name text) language sql stable security invoker set search_path = ''
as $$ select * from private.deposit_details(); $$;
create function public.request_deposit(p_amount_paise bigint, p_utr text, p_payout_account_id uuid, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.request_deposit(p_amount_paise, p_utr, p_payout_account_id, p_idempotency_key); $$;
create function public.second_approve_deposit(p_request_id uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.second_approve_deposit(p_request_id); $$;
create function public.confirm_deposit(p_request_id uuid, p_bank_amount_paise bigint)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.confirm_deposit(p_request_id, p_bank_amount_paise); $$;
create function public.reject_deposit(p_request_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.reject_deposit(p_request_id); $$;
create function public.waiting_deposits(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, utr text, from_vpa text, from_bank text, requested_at timestamptz,
               needs_second boolean, approved_by text[])
language sql stable security invoker set search_path = ''
as $$ select * from private.waiting_deposits(p_venue_id); $$;

-- The signed-in member's deposits, newest first.
create function public.my_deposits()
returns table (id uuid, amount_paise bigint, utr text, status text, requested_at timestamptz, decided_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select d.id, d.amount_paise, d.utr, d.status, d.created_at, d.decided_at from public.deposit_request d
  where d.member_id = private.current_member_id() order by d.created_at desc, d.id;
$$;

revoke execute on function public.deposit_details(), public.request_deposit(bigint, text, uuid, uuid), public.second_approve_deposit(uuid),
  public.confirm_deposit(uuid, bigint), public.reject_deposit(uuid), public.waiting_deposits(uuid), public.my_deposits() from public, anon;
grant execute on function public.deposit_details(), public.request_deposit(bigint, text, uuid, uuid), public.second_approve_deposit(uuid),
  public.confirm_deposit(uuid, bigint), public.reject_deposit(uuid), public.waiting_deposits(uuid), public.my_deposits() to authenticated;

-- Balance (#18) names a deposit by its UTR.
create or replace view public.my_wallet_movement
with (security_invoker = true)
as
select e.id, t.created_at as at, t.kind, substring(a.code from 8) as account,
       case when a.kind = 'asset' then e.amount else -e.amount end as amount,
       g.name as table_name, b.reason as bonus_reason, p.bank_name, d.utr
from public.ledger_entry e
join public.ledger_account a on a.id = e.account_id
join public.ledger_transaction t on t.id = e.transaction_id
left join public.cage_transaction c on c.ledger_transaction_id = t.id
left join public.marker k on k.ledger_transaction_id = t.id
left join public.seat_session s on s.id = coalesce(c.session_id, k.session_id)
left join public.game_table g on g.id = s.table_id
left join public.bonus_grant b on b.ledger_transaction_id = t.id
left join public.withdrawal_request w on t.id in (w.hold_transaction_id, w.outcome_transaction_id)
left join public.payout_account p on p.id = w.payout_account_id
left join public.deposit_request d on d.ledger_transaction_id = t.id
where a.member_id = (select private.current_member_id()) and a.unit = 'paise';
