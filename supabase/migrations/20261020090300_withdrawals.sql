-- Withdrawals (#21; scope-v1 module 5, "withdrawal requests from the app to verified payout accounts,
-- executed by the cage with the UTR recorded"; design prompt flow 9). A member asks to withdraw wallet
-- cash to one of their verified payout accounts (#19): the amount leaves their wallet at once, held as
-- withdrawals waiting to be paid. The cage sends it with the bank's UTR, and from the threshold up only
-- once a second approver has approved it (#20); or declines it with a reason, and the amount returns to
-- the wallet. Refused while the withdrawals feature is switched off (RVKIL) or the venue is frozen.

-- Wallet cash held for a withdrawal until the cage sends or declines it: players' money.
insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money)
select v.id, 'venue.withdrawals_pending', 'Withdrawals waiting to be paid', 'liability', 'paise', true from public.venue v
on conflict do nothing;

-- The bootstrap as #47 left it (20261019091300_high_hands.sql), with the withdrawals account for every venue created from now on.
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

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1), (p_venue_id, 'Academy graduate', 2),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');

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
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  return p_venue_id;
end;
$$;

create table public.withdrawal_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 100 = 0),
  payout_account_id uuid not null references public.payout_account (id),
  status text not null default 'waiting' check (status in ('waiting', 'sent', 'declined')),
  -- The bank's reference for the transfer the cage made.
  utr text check (utr ~ '^[0-9]{12}$'),
  decline_reason text check (length(btrim(decline_reason)) between 3 and 200),
  -- The amount held from the wallet; then its payment to the bank, or its return to the wallet.
  hold_transaction_id uuid not null,
  outcome_transaction_id uuid,
  decided_at timestamptz,
  decided_by_staff_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, idempotency_key),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (hold_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (outcome_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((status = 'sent') = (utr is not null)),
  check ((status = 'declined') = (decline_reason is not null)),
  check ((status = 'waiting') = (decided_at is null) and (decided_at is null) = (outcome_transaction_id is null))
);

comment on table public.withdrawal_request is 'A member''s withdrawal to a verified payout account: held, then sent with its UTR or declined (#21).';

-- A UTR pays one withdrawal; a member has one waiting at a time.
create unique index withdrawal_request_utr_idx on public.withdrawal_request (venue_id, utr) where utr is not null;
create unique index withdrawal_request_waiting_idx on public.withdrawal_request (member_id) where status = 'waiting';
create index withdrawal_request_member_idx on public.withdrawal_request (member_id, venue_id, created_at);
create index withdrawal_request_queue_idx on public.withdrawal_request (venue_id, created_at) where status = 'waiting';
create index withdrawal_request_account_idx on public.withdrawal_request (payout_account_id);
create index withdrawal_request_hold_idx on public.withdrawal_request (hold_transaction_id, venue_id);
create index withdrawal_request_outcome_idx on public.withdrawal_request (outcome_transaction_id, venue_id);
create index withdrawal_request_decider_idx on public.withdrawal_request (decided_by_staff_id, venue_id);
create trigger withdrawal_request_touch_updated_at before update on public.withdrawal_request
  for each row execute function private.touch_updated_at();
create trigger withdrawal_request_audit after insert or update on public.withdrawal_request
  for each row execute function private.audit_row_change();

alter table public.withdrawal_request enable row level security;
grant select on public.withdrawal_request to authenticated;
create policy "members see their own withdrawals" on public.withdrawal_request
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "the cage and its approvers see the venue's withdrawals" on public.withdrawal_request
  for select to authenticated
  using (venue_id in (select private.venues_where('withdrawals.approve')) or venue_id in (select private.venues_where('cage.second_approve')));

-- @rivr/domain withdrawalCheck in SQL, proved on the same golden file.
create function private.withdrawal_check(p_amount_paise bigint, p_cash_paise bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_amount_paise is null or p_amount_paise <= 0 or p_amount_paise % 100 <> 0 then 'not_rupees'
              when p_amount_paise > p_cash_paise then 'wallet_short'
              else 'ok' end;
$$;

-- What refuses a withdrawal request before any money moves: no finished identity check (RVKYC), a
-- payout account not the member's, not verified or removed (RVPAY), another waiting (RVPND), a
-- marker past due (RVDUE), or the amount (22023 not whole rupees, RVSHT more than the wallet).
create function private.withdrawal_refusal(p_member public.member, p_amount_paise bigint, p_payout_account_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_check text := private.withdrawal_check(p_amount_paise, private.wallet_cash(p_member.id));
begin
  if not private.is_kyc_complete(p_member.id) then
    raise exception 'KYC incomplete: finish it to withdraw' using errcode = 'RVKYC';
  end if;
  if not exists (select 1 from public.payout_account a where a.id = p_payout_account_id and a.member_id = p_member.id
                 and a.status = 'verified' and a.removed_at is null) then
    raise exception 'Not a verified payout account of yours' using errcode = 'RVPAY';
  end if;
  if exists (select 1 from public.withdrawal_request w where w.member_id = p_member.id and w.status = 'waiting') then
    raise exception 'One withdrawal is already waiting' using errcode = 'RVPND';
  end if;
  if exists (select 1 from public.marker k where k.member_id = p_member.id and k.settled_at is null and k.due_at < now()) then
    raise exception 'A marker is past due: settle it before withdrawing' using errcode = 'RVDUE';
  end if;
  if v_check <> 'ok' then
    raise exception 'Refused: %', v_check using errcode = case v_check when 'not_rupees' then '22023' else 'RVSHT' end;
  end if;
end;
$$;

-- The signed-in member asks to withdraw to one of their verified payout accounts, once per request
-- id: the amount leaves their wallet at once, held until the cage sends or declines it.
create function private.request_withdrawal(p_amount_paise bigint, p_payout_account_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_replay public.withdrawal_request;
  v_txn uuid;
  v_id uuid;
begin
  select * into v_member from public.member m where m.id = private.current_member_id() for update;
  if v_member.id is null then
    raise exception 'Only a member withdraws' using errcode = '42501';
  end if;
  select * into v_replay from public.withdrawal_request w where w.venue_id = v_member.venue_id and w.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> v_member.id or v_replay.amount_paise <> p_amount_paise or v_replay.payout_account_id <> p_payout_account_id then
      raise exception 'That request id was used for another withdrawal' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  perform private.assert_writable(v_member.venue_id, 'withdrawals', v_member.id);
  perform private.withdrawal_refusal(v_member, p_amount_paise, p_payout_account_id);
  v_txn := private.post_ledger_transaction(v_member.venue_id, 'withdrawal', 'withdrawal:' || p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_member.id and a.code = 'member.cash'),
                         'amount', p_amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_member.venue_id
                                         and a.code = 'venue.withdrawals_pending' and a.member_id is null), 'amount', (-p_amount_paise)::text)),
    'withdrawals', 'Withdrawal requested');
  insert into public.withdrawal_request (venue_id, member_id, amount_paise, payout_account_id, hold_transaction_id, idempotency_key)
  values (v_member.venue_id, v_member.id, p_amount_paise, p_payout_account_id, v_txn, p_idempotency_key)
  returning id into v_id;
  perform private.emit(v_member.venue_id, 'withdrawal.requested',
                       jsonb_build_object('withdrawal_request_id', v_id, 'member_id', v_member.id, 'amount_paise', p_amount_paise), 'withdrawal.requested:' || v_id);
  return v_id;
end;
$$;

-- A waiting withdrawal, locked, for the staff member deciding it: refused without the permission, for
-- one's own (as with a KYC check or a payout account, #19), or while the member, venue or withdrawals
-- are stopped; and when it is not waiting.
create function private.waiting_withdrawal(p_request_id uuid, p_permission text, p_feature public.killable_feature)
returns public.withdrawal_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_request;
begin
  select * into v_request from public.withdrawal_request w where w.id = p_request_id for update;
  if v_request.id is null or not private.has_permission(v_request.venue_id, p_permission) or private.is_own_kyc_check(v_request.member_id) then
    raise exception 'Not allowed to decide this withdrawal' using errcode = '42501';
  end if;
  perform private.assert_writable(v_request.venue_id, p_feature, v_request.member_id);
  if v_request.status <> 'waiting' then
    raise exception 'That withdrawal is not waiting' using errcode = '22023';
  end if;
  return v_request;
end;
$$;

-- A second approver approves a waiting withdrawal, for its own amount (#20).
create function private.second_approve_withdrawal(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_request;
begin
  v_request := private.waiting_withdrawal(p_request_id, 'cage.second_approve', 'withdrawals');
  return private.record_second_approval(v_request.venue_id, 'withdrawal', v_request.id, v_request.amount_paise);
end;
$$;

-- The cage sends a waiting withdrawal with the bank's UTR, to an account still verified and in use
-- (RVPAY): from the threshold up, only once a second approver other than this cashier has approved
-- it (RVAPP). The held amount goes to the bank.
create function private.send_withdrawal(p_request_id uuid, p_utr text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_request;
  v_staff uuid;
  v_txn uuid;
begin
  v_request := private.waiting_withdrawal(p_request_id, 'withdrawals.approve', 'withdrawals');
  v_staff := private.current_staff_id(v_request.venue_id);
  if p_utr is null or p_utr !~ '^[0-9]{12}$' then
    raise exception 'A 12-digit UTR' using errcode = '22023';
  end if;
  if exists (select 1 from public.withdrawal_request w where w.venue_id = v_request.venue_id and w.utr = p_utr) then
    raise exception 'That UTR already paid another withdrawal' using errcode = 'RVUTR';
  end if;
  if not exists (select 1 from public.payout_account a where a.id = v_request.payout_account_id and a.status = 'verified' and a.removed_at is null) then
    raise exception 'The payout account is no longer verified and in use: decline it' using errcode = 'RVPAY';
  end if;
  perform private.assert_second_approved(v_request.venue_id, 'withdrawal', v_request.id, v_request.amount_paise, now(), v_staff);
  v_txn := private.post_ledger_transaction(v_request.venue_id, 'withdrawal_paid', 'withdrawal_paid:' || v_request.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_request.venue_id
                                         and a.code = 'venue.withdrawals_pending' and a.member_id is null), 'amount', v_request.amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_request.venue_id
                                         and a.code = 'venue.bank' and a.member_id is null), 'amount', (-v_request.amount_paise)::text)),
    'withdrawals', 'Withdrawal sent · UTR ' || p_utr);
  update public.withdrawal_request
  set status = 'sent', utr = p_utr, decided_at = now(), decided_by_staff_id = v_staff, outcome_transaction_id = v_txn
  where id = v_request.id;
  perform private.emit(v_request.venue_id, 'withdrawal.sent',
                       jsonb_build_object('withdrawal_request_id', v_request.id, 'member_id', v_request.member_id,
                                          'amount_paise', v_request.amount_paise, 'utr', p_utr), 'withdrawal.sent:' || v_request.id);
end;
$$;

-- The cage declines a waiting withdrawal with a reason the member reads: the amount returns to the
-- wallet, even while withdrawals are switched off (only a frozen venue or member waits).
create function private.decline_withdrawal(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_request;
  v_txn uuid;
begin
  v_request := private.waiting_withdrawal(p_request_id, 'withdrawals.approve', null);
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'Say why it is declined' using errcode = '22023';
  end if;
  v_txn := private.post_ledger_transaction(v_request.venue_id, 'withdrawal_return', 'withdrawal_return:' || v_request.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_request.venue_id
                                         and a.code = 'venue.withdrawals_pending' and a.member_id is null), 'amount', v_request.amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_request.member_id and a.code = 'member.cash'),
                         'amount', (-v_request.amount_paise)::text)),
    null, 'Withdrawal declined, returned to cash');
  update public.withdrawal_request
  set status = 'declined', decline_reason = btrim(p_reason), decided_at = now(), decided_by_staff_id = private.current_staff_id(v_request.venue_id),
      outcome_transaction_id = v_txn
  where id = v_request.id;
  perform private.emit(v_request.venue_id, 'withdrawal.declined',
                       jsonb_build_object('withdrawal_request_id', v_request.id, 'member_id', v_request.member_id, 'amount_paise', v_request.amount_paise),
                       'withdrawal.declined:' || v_request.id);
end;
$$;
-- The venue's withdrawals waiting, oldest first: whose, how much, to which account, and whether a
-- second approver is needed and who has approved. The full account is for the cashier who pays; a
-- second approver who does not pay sees the bank, the holder and the last four digits.
create function private.waiting_withdrawals(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, amount_paise bigint, kind text, bank_name text, vpa text, account_number text,
               ifsc text, holder_name text, requested_at timestamptz, needs_second boolean, approved_by text[])
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, m.id, m.full_name, w.amount_paise, a.kind, a.bank_name,
         case when private.has_permission(p_venue_id, 'withdrawals.approve') then a.vpa else '••••@' || split_part(a.vpa, '@', 2) end,
         case when private.has_permission(p_venue_id, 'withdrawals.approve') then a.account_number else '••••' || right(a.account_number, 4) end,
         a.ifsc, a.holder_name, w.created_at,
         private.second_approver_needed(w.venue_id, w.amount_paise, now()),
         coalesce((select array_agg(s.full_name order by sa.approved_at, sa.id) from public.second_approval sa join public.staff s on s.id = sa.approved_by_staff_id
                   where sa.venue_id = w.venue_id and sa.subject = 'withdrawal' and sa.subject_id = w.id and sa.amount_paise = w.amount_paise), '{}')
  from public.withdrawal_request w
  join public.member m on m.id = w.member_id
  join public.payout_account a on a.id = w.payout_account_id
  where w.venue_id = p_venue_id and w.status = 'waiting'
    and (private.has_permission(p_venue_id, 'withdrawals.approve') or private.has_permission(p_venue_id, 'cage.second_approve'))
  order by w.created_at, w.id;
$$;

revoke execute on function private.withdrawal_check(bigint, bigint), private.withdrawal_refusal(public.member, bigint, uuid),
  private.waiting_withdrawal(uuid, text, public.killable_feature) from public, anon, authenticated;
revoke execute on function private.request_withdrawal(bigint, uuid, uuid), private.second_approve_withdrawal(uuid), private.send_withdrawal(uuid, text),
  private.decline_withdrawal(uuid, text), private.waiting_withdrawals(uuid) from public, anon;
grant execute on function private.request_withdrawal(bigint, uuid, uuid), private.second_approve_withdrawal(uuid), private.send_withdrawal(uuid, text),
  private.decline_withdrawal(uuid, text), private.waiting_withdrawals(uuid) to authenticated;

create function public.request_withdrawal(p_amount_paise bigint, p_payout_account_id uuid, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.request_withdrawal(p_amount_paise, p_payout_account_id, p_idempotency_key); $$;
create function public.second_approve_withdrawal(p_request_id uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.second_approve_withdrawal(p_request_id); $$;
create function public.send_withdrawal(p_request_id uuid, p_utr text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.send_withdrawal(p_request_id, p_utr); $$;
create function public.decline_withdrawal(p_request_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.decline_withdrawal(p_request_id, p_reason); $$;
create function public.waiting_withdrawals(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, amount_paise bigint, kind text, bank_name text, vpa text, account_number text,
               ifsc text, holder_name text, requested_at timestamptz, needs_second boolean, approved_by text[])
language sql stable security invoker set search_path = ''
as $$ select * from private.waiting_withdrawals(p_venue_id); $$;

revoke execute on function public.request_withdrawal(bigint, uuid, uuid), public.second_approve_withdrawal(uuid), public.send_withdrawal(uuid, text),
  public.decline_withdrawal(uuid, text), public.waiting_withdrawals(uuid) from public, anon;
grant execute on function public.request_withdrawal(bigint, uuid, uuid), public.second_approve_withdrawal(uuid), public.send_withdrawal(uuid, text),
  public.decline_withdrawal(uuid, text), public.waiting_withdrawals(uuid) to authenticated;

-- The signed-in member's withdrawals, newest first, with the account each went to.
create function public.my_withdrawals()
returns table (id uuid, amount_paise bigint, status text, utr text, decline_reason text, requested_at timestamptz, decided_at timestamptz,
               kind text, bank_name text)
language sql stable security invoker set search_path = ''
as $$
  select w.id, w.amount_paise, w.status, w.utr, w.decline_reason, w.created_at, w.decided_at, a.kind, a.bank_name
  from public.withdrawal_request w
  join public.payout_account a on a.id = w.payout_account_id
  where w.member_id = private.current_member_id()
  order by w.created_at desc, w.id;
$$;
revoke execute on function public.my_withdrawals() from public, anon;
grant execute on function public.my_withdrawals() to authenticated;

-- Balance (#18) names a withdrawal's account: the bank its hold, payment or return was for.
create or replace view public.my_wallet_movement
with (security_invoker = true)
as
select e.id, t.created_at as at, t.kind, substring(a.code from 8) as account,
       case when a.kind = 'asset' then e.amount else -e.amount end as amount,
       g.name as table_name, b.reason as bonus_reason, p.bank_name
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
where a.member_id = (select private.current_member_id()) and a.unit = 'paise';
