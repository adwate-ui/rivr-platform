-- Withdrawal methods (#475; decision 0231; the owner's answers of 26 Oct). The cage pays each withdrawal one
-- of three ways: cash at the counter, from the drawer in an open shift; through Cashfree, from the Cashfree payout
-- balance; or by UPI outside the system with the UTR typed in, from the bank, as before. A Cashfree payout is made
-- by the withdrawal-payout function: the withdrawal waits as `paying` until Cashfree says sent, when it is paid
-- from the Cashfree payout balance, or failed, when it waits for the cage again with the failure shown. A payout
-- Cashfree reverses after it was sent goes back the same way, its posting undone.

-- The Cashfree payout balance: a payment account like the drawer and the bank, which treasury tops up from the
-- bank with a transfer between accounts (#94).
alter table public.payment_account drop constraint payment_account_kind_check;
alter table public.payment_account add constraint payment_account_kind_check check (kind in ('cash_drawer', 'upi', 'bank', 'cashfree'));
create or replace function private.payment_account_for_ledger_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The practice reset reloads a venue's payment accounts with its ledger accounts: those stand.
  insert into public.payment_account (venue_id, kind, name, ledger_account_id)
  values (new.venue_id, case new.code when 'venue.cash_drawer' then 'cash_drawer' when 'venue.cashfree' then 'cashfree' else 'bank' end,
          new.name, new.id)
  on conflict (ledger_account_id) do nothing;
  return null;
end;
$$;
drop trigger ledger_account_payment_account on public.ledger_account;
create trigger ledger_account_payment_account after insert on public.ledger_account
  for each row when (new.member_id is null and new.code in ('venue.cash_drawer', 'venue.bank', 'venue.cashfree'))
  execute function private.payment_account_for_ledger_account();

-- As before (20261027000200_website_comes_with_the_venue.sql), with the Cashfree payout balance.
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
    (p_venue_id, 'venue.tournament_pool', 'Tournament prize pools', 'liability', 'paise', true),
    (p_venue_id, 'venue.tournament_fees', 'Tournament fees', 'revenue', 'paise', false),
    (p_venue_id, 'venue.tournament_overlay', 'Tournament overlay', 'expense', 'paise', false),
    (p_venue_id, 'venue.cashfree', 'Cashfree payout balance', 'asset', 'paise', false),
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  if p_is_practice then
    perform private.add_certification_quizzes(p_venue_id);
  end if;

  perform private.add_training_sops(p_venue_id);
  perform private.add_promotion_templates(p_venue_id);
  if not p_is_practice and not exists (select 1 from public.venue v where not v.is_practice and v.id <> p_venue_id) then
    perform private.add_website(p_venue_id);
  end if;

  return p_venue_id;
end;
$$;

insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money)
select v.id, 'venue.cashfree', 'Cashfree payout balance', 'asset', 'paise', false
from public.venue v
where not exists (select 1 from public.ledger_account a where a.venue_id = v.id and a.code = 'venue.cashfree' and a.member_id is null);

-- How a withdrawal was paid, and its Cashfree payout: a fresh key for each attempt, Cashfree's transfer id, and
-- why the last attempt failed.
alter table public.withdrawal_request
  add column method text check (method in ('upi_manual', 'cash', 'cashfree')),
  add column payout_key uuid,
  add column payout_id text check (length(payout_id) <= 80),
  add column payout_failure text check (length(payout_failure) <= 200),
  add column payout_attempted_at timestamptz;
update public.withdrawal_request set method = 'upi_manual' where status = 'sent';
alter table public.withdrawal_request drop constraint withdrawal_request_status_check;
alter table public.withdrawal_request add constraint withdrawal_request_status_check check (status in ('waiting', 'paying', 'sent', 'declined'));
alter table public.withdrawal_request drop constraint withdrawal_request_check;
alter table public.withdrawal_request add constraint withdrawal_request_paid_check check (
  (status = 'sent' and method = 'upi_manual' and utr is not null)
  or (status = 'sent' and method = 'cash' and utr is null)
  or (status = 'sent' and method = 'cashfree' and payout_key is not null)
  or (status = 'paying' and method = 'cashfree' and payout_key is not null and utr is null)
  or (status in ('waiting', 'declined') and method is null and utr is null)
);
alter table public.withdrawal_request drop constraint withdrawal_request_check2;
alter table public.withdrawal_request add constraint withdrawal_request_decided_check check (
  (status = 'waiting') = (decided_at is null) and (status in ('waiting', 'paying')) = (outcome_transaction_id is null)
);
drop index public.withdrawal_request_waiting_idx;
create unique index withdrawal_request_waiting_idx on public.withdrawal_request (member_id) where status in ('waiting', 'paying');
create index withdrawal_request_payout_idx on public.withdrawal_request (venue_id, status) where method = 'cashfree';

-- What every way of paying checks: the account still verified and in use, and the second approval.
create function private.assert_payable(p_request public.withdrawal_request, p_staff uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.payout_account a where a.id = p_request.payout_account_id and a.status = 'verified' and a.removed_at is null) then
    raise exception 'The payout account is no longer verified and in use: decline it' using errcode = 'RVPAY';
  end if;
  perform private.assert_second_approved(p_request.venue_id, 'withdrawal', p_request.id, p_request.amount_paise, now(), p_staff);
end;
$$;

-- The withdrawal paid out of one of the venue's accounts: the money held for it leaves that account.
create function private.post_withdrawal_paid(p_request public.withdrawal_request, p_account_code text, p_key text, p_memo text,
                                             p_feature public.killable_feature default 'withdrawals')
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.post_ledger_transaction(p_request.venue_id, 'withdrawal_paid', p_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_request.venue_id
                                         and a.code = 'venue.withdrawals_pending' and a.member_id is null), 'amount', p_request.amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_request.venue_id
                                         and a.code = p_account_code and a.member_id is null), 'amount', (-p_request.amount_paise)::text)),
    p_feature, p_memo);
$$;

create function private.mark_withdrawal_sent(p_request public.withdrawal_request, p_txn uuid, p_staff uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.withdrawal_request
  set status = 'sent', decided_at = coalesce(decided_at, now()), decided_by_staff_id = coalesce(decided_by_staff_id, p_staff),
      outcome_transaction_id = p_txn, payout_failure = null
  where id = p_request.id;
  perform private.emit(p_request.venue_id, 'withdrawal.sent',
                       jsonb_build_object('withdrawal_request_id', p_request.id, 'member_id', p_request.member_id,
                                          'amount_paise', p_request.amount_paise, 'utr', p_request.utr, 'method', p_request.method),
                       'withdrawal.sent:' || p_request.id || ':' || coalesce(p_txn::text, ''));
end;
$$;

-- As before (20261020090300_withdrawals.sql): paid by UPI outside the system, its UTR typed in, from the bank.
create or replace function private.send_withdrawal(p_request_id uuid, p_utr text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_request;
  v_staff uuid;
begin
  v_request := private.waiting_withdrawal(p_request_id, 'withdrawals.approve', 'withdrawals');
  v_staff := private.current_staff_id(v_request.venue_id);
  if p_utr is null or p_utr !~ '^[0-9]{12}$' then
    raise exception 'A 12-digit UTR' using errcode = '22023';
  end if;
  if exists (select 1 from public.withdrawal_request w where w.venue_id = v_request.venue_id and w.utr = p_utr) then
    raise exception 'That UTR already paid another withdrawal' using errcode = 'RVUTR';
  end if;
  perform private.assert_payable(v_request, v_staff);
  update public.withdrawal_request set method = 'upi_manual', utr = p_utr, status = 'sent', decided_at = now(), decided_by_staff_id = v_staff,
    outcome_transaction_id = private.post_withdrawal_paid(v_request, 'venue.bank', 'withdrawal_paid:' || v_request.id, 'Withdrawal sent · UTR ' || p_utr)
  where id = v_request.id
  returning * into v_request;
  perform private.mark_withdrawal_sent(v_request, v_request.outcome_transaction_id, v_staff);
end;
$$;

-- Paid in cash at the counter, from the drawer: a cashier (cage.transact) who approves withdrawals, in an open
-- shift (the shift guard on the drawer).
create function private.pay_withdrawal_in_cash(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_request;
  v_staff uuid;
begin
  v_request := private.waiting_withdrawal(p_request_id, 'withdrawals.approve', 'withdrawals');
  if not private.has_permission(v_request.venue_id, 'cage.transact') then
    raise exception 'Cash is paid at the cage' using errcode = '42501';
  end if;
  v_staff := private.current_staff_id(v_request.venue_id);
  perform private.assert_payable(v_request, v_staff);
  update public.withdrawal_request set method = 'cash', status = 'sent', decided_at = now(), decided_by_staff_id = v_staff,
    outcome_transaction_id = private.post_withdrawal_paid(v_request, 'venue.cash_drawer', 'withdrawal_paid:' || v_request.id, 'Withdrawal paid in cash')
  where id = v_request.id
  returning * into v_request;
  perform private.mark_withdrawal_sent(v_request, v_request.outcome_transaction_id, v_staff);
end;
$$;

-- Paid through Cashfree, to a UPI address: the withdrawal waits as paying, with a fresh key, until the
-- withdrawal-payout function hears from Cashfree.
create function private.pay_withdrawal_through_cashfree(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_request;
  v_staff uuid;
begin
  v_request := private.waiting_withdrawal(p_request_id, 'withdrawals.approve', 'withdrawals');
  v_staff := private.current_staff_id(v_request.venue_id);
  perform private.assert_payable(v_request, v_staff);
  if not exists (select 1 from public.payout_account a where a.id = v_request.payout_account_id and a.kind = 'upi') then
    raise exception 'Cashfree pays UPI addresses only: pay this one another way' using errcode = 'RVPAY';
  end if;
  update public.withdrawal_request
  set status = 'paying', method = 'cashfree', payout_key = gen_random_uuid(), payout_id = null, payout_failure = null,
      decided_at = now(), decided_by_staff_id = v_staff
  where id = v_request.id;
end;
$$;

-- When each Cashfree payout is next asked about: a run claims the payouts due, so two runs never ask about one
-- at once. Paying ones are asked again in two minutes, sent ones (which Cashfree may still reverse) in thirty.
create table private.withdrawal_payout_check (
  withdrawal_request_id uuid primary key references public.withdrawal_request (id) on delete cascade,
  next_check_at timestamptz not null default now()
);
alter table private.withdrawal_payout_check enable row level security;
revoke all on private.withdrawal_payout_check from public, anon, authenticated;

-- Whether money may go out for a withdrawal now: the venue, the member and withdrawals not stopped.
create function private.may_pay_out(p_venue_id uuid, p_member_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_writable(p_venue_id, 'withdrawals', p_member_id);
  return true;
exception when others then
  return false;
end;
$$;

-- A Cashfree payout in trouble (service role): one the function could not record, or one paying half an hour or
-- more. The owner hears, at most once in six hours for each.
create function private.note_withdrawal_payout_trouble(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select w.venue_id from public.withdrawal_request w where w.id = p_request_id);
begin
  if v_venue_id is not null and not exists (
    select 1 from public.alert a
    where a.venue_id = v_venue_id and a.kind = 'withdrawal.payout_stuck' and a.detail ->> 'withdrawal_request_id' = p_request_id::text
      and a.raised_at > now() - interval '6 hours') then
    perform private.raise_alert(v_venue_id, 'withdrawal.payout_stuck', jsonb_build_object('withdrawal_request_id', p_request_id));
  end if;
end;
$$;

-- The payout function is about to send (service role): true, and from now a transfer may exist for this attempt,
-- only if money may still go out and the account is still verified and in use, checked now, not at the claim.
create function private.begin_withdrawal_payout(p_request_id uuid, p_payout_key uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.withdrawal_request w set payout_attempted_at = coalesce(w.payout_attempted_at, now())
  where w.id = p_request_id and w.status = 'paying' and w.payout_key = p_payout_key
    and private.may_pay_out(w.venue_id, w.member_id)
    and exists (select 1 from public.payout_account a where a.id = w.payout_account_id and a.status = 'verified' and a.removed_at is null)
  returning true;
$$;

-- The Cashfree payouts due a look (service role), claimed: those paying, and those sent less than thirty days
-- ago at a real venue, which Cashfree may still reverse. With each, whether money may go out now and whether
-- its payout account is still verified and in use.
create function private.claim_withdrawal_payouts()
returns table (withdrawal_request_id uuid, venue_id uuid, is_practice boolean, status text, payout_key uuid, payout_id text,
               vpa text, holder_name text, amount_paise bigint, may_pay boolean, account_ok boolean, attempted boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- A payout paying half an hour or more: the owner hears, at most every six hours.
  perform private.note_withdrawal_payout_trouble(w.id)
  from public.withdrawal_request w
  where w.method = 'cashfree' and w.status = 'paying' and w.decided_at < now() - interval '30 minutes';
  return query
  with due as (
    select w.id, w.status
    from public.withdrawal_request w
    join public.venue v on v.id = w.venue_id
    left join private.withdrawal_payout_check c on c.withdrawal_request_id = w.id
    where w.method = 'cashfree'
      and (w.status = 'paying'
           or (w.status = 'sent' and not v.is_practice
               and (select t.occurred_at from public.ledger_transaction t where t.id = w.outcome_transaction_id) > now() - interval '30 days'))
      and (c.next_check_at is null or c.next_check_at <= now())
    order by w.decided_at
    limit 50
    for update of w skip locked
  ), claimed as (
    insert into private.withdrawal_payout_check as c (withdrawal_request_id, next_check_at)
    select d.id, now() + case when d.status = 'sent' then interval '30 minutes' else interval '2 minutes' end from due d
    on conflict (withdrawal_request_id) do update set next_check_at = excluded.next_check_at
    returning c.withdrawal_request_id
  )
  select w.id, w.venue_id, v.is_practice, w.status, w.payout_key, w.payout_id, a.vpa, coalesce(a.holder_name, m.full_name), w.amount_paise,
         private.may_pay_out(w.venue_id, w.member_id), a.status = 'verified' and a.removed_at is null, w.payout_attempted_at is not null
  from claimed c
  join public.withdrawal_request w on w.id = c.withdrawal_request_id
  join public.venue v on v.id = w.venue_id
  join public.payout_account a on a.id = w.payout_account_id
  join public.member m on m.id = w.member_id;
end;
$$;

-- What Cashfree said of an attempt (service role): sent, paid from the Cashfree payout balance; failed, back to
-- the cage; pending, its transfer id kept. A stale attempt (the withdrawal moved on) changes nothing. Reversed:
-- a sent payout undone, its posting reversed, and back to the cage.
create function private.record_withdrawal_payout(p_request_id uuid, p_payout_key uuid, p_status text, p_payout_id text, p_utr text,
                                                 p_failure text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_request;
begin
  select * into v_request from public.withdrawal_request w where w.id = p_request_id for update;
  if v_request.id is null or v_request.method is distinct from 'cashfree' or v_request.payout_key is distinct from p_payout_key then
    if p_status = 'sent' and v_request.id is not null then
      perform private.raise_alert(v_request.venue_id, 'withdrawal.payout_orphaned', jsonb_build_object('withdrawal_request_id', v_request.id));
    end if;
    return 'stale';
  end if;
  if v_request.status = 'paying' and p_status = 'sent' then
    update public.withdrawal_request set status = 'sent', payout_id = p_payout_id,
      utr = case when p_utr ~ '^[0-9]{12}$' and not exists (select 1 from public.withdrawal_request o where o.venue_id = v_request.venue_id and o.utr = p_utr)
                 then p_utr end,
      -- Money Cashfree has paid is recorded whatever the kill switch says; a freeze holds it until released, when
      -- the next ask records it.
      outcome_transaction_id = private.post_withdrawal_paid(v_request, 'venue.cashfree', 'withdrawal_payout:' || p_payout_key,
                                                            'Withdrawal paid through Cashfree', null)
    where id = v_request.id
    returning * into v_request;
    perform private.mark_withdrawal_sent(v_request, v_request.outcome_transaction_id, null);
    return 'sent';
  elsif v_request.status = 'paying' and p_status = 'failed' then
    update public.withdrawal_request set status = 'waiting', method = null, payout_key = null, payout_id = p_payout_id, payout_attempted_at = null,
      payout_failure = left(coalesce(p_failure, 'Cashfree did not pay it'), 200), decided_at = null, decided_by_staff_id = null
    where id = v_request.id;
    return 'failed';
  elsif v_request.status = 'paying' then
    update public.withdrawal_request set payout_id = coalesce(p_payout_id, payout_id) where id = v_request.id;
    return 'pending';
  elsif v_request.status = 'sent' and p_status = 'failed' then
    perform private.reverse_ledger_transaction(v_request.outcome_transaction_id, 'withdrawal_payout_reversed:' || p_payout_key,
                                               'Cashfree reversed the payout');
    update public.withdrawal_request set status = 'waiting', method = null, payout_key = null, utr = null, outcome_transaction_id = null,
      payout_attempted_at = null,
      payout_failure = 'Cashfree reversed the payout after it was sent', decided_at = null, decided_by_staff_id = null
    where id = v_request.id;
    return 'reversed';
  end if;
  return 'unchanged';
end;
$$;

create function public.pay_withdrawal_in_cash(p_request_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.pay_withdrawal_in_cash(p_request_id); $$;
create function public.pay_withdrawal_through_cashfree(p_request_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.pay_withdrawal_through_cashfree(p_request_id); $$;

revoke execute on function private.assert_payable(public.withdrawal_request, uuid),
  private.post_withdrawal_paid(public.withdrawal_request, text, text, text, public.killable_feature), private.mark_withdrawal_sent(public.withdrawal_request, uuid, uuid),
  private.claim_withdrawal_payouts(), private.may_pay_out(uuid, uuid), private.record_withdrawal_payout(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function private.claim_withdrawal_payouts(), private.record_withdrawal_payout(uuid, uuid, text, text, text, text)
  to service_role;

-- What the withdrawal-payout function calls through the API: the service role only.
create function public.claim_withdrawal_payouts()
returns table (withdrawal_request_id uuid, venue_id uuid, is_practice boolean, status text, payout_key uuid, payout_id text,
               vpa text, holder_name text, amount_paise bigint, may_pay boolean, account_ok boolean, attempted boolean)
language sql volatile security invoker set search_path = ''
as $$ select * from private.claim_withdrawal_payouts(); $$;
create function public.record_withdrawal_payout(p_request_id uuid, p_payout_key uuid, p_status text, p_payout_id text, p_utr text, p_failure text)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.record_withdrawal_payout(p_request_id, p_payout_key, p_status, p_payout_id, p_utr, p_failure); $$;
create function public.begin_withdrawal_payout(p_request_id uuid, p_payout_key uuid)
returns boolean language sql volatile security invoker set search_path = ''
as $$ select private.begin_withdrawal_payout(p_request_id, p_payout_key); $$;
create function public.note_withdrawal_payout_trouble(p_request_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.note_withdrawal_payout_trouble(p_request_id); $$;
revoke execute on function public.claim_withdrawal_payouts(), public.record_withdrawal_payout(uuid, uuid, text, text, text, text),
  public.begin_withdrawal_payout(uuid, uuid), public.note_withdrawal_payout_trouble(uuid),
  private.begin_withdrawal_payout(uuid, uuid), private.note_withdrawal_payout_trouble(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_withdrawal_payouts(), public.record_withdrawal_payout(uuid, uuid, text, text, text, text),
  public.begin_withdrawal_payout(uuid, uuid), public.note_withdrawal_payout_trouble(uuid),
  private.begin_withdrawal_payout(uuid, uuid), private.note_withdrawal_payout_trouble(uuid) to service_role;
revoke execute on function private.pay_withdrawal_in_cash(uuid), private.pay_withdrawal_through_cashfree(uuid),
  public.pay_withdrawal_in_cash(uuid), public.pay_withdrawal_through_cashfree(uuid) from public, anon;
grant execute on function private.pay_withdrawal_in_cash(uuid), private.pay_withdrawal_through_cashfree(uuid),
  public.pay_withdrawal_in_cash(uuid), public.pay_withdrawal_through_cashfree(uuid) to authenticated;

-- As before (20261020090500_kyc_at_the_cage.sql), with those paying through Cashfree, each one's state, and why
-- its last Cashfree payout failed.
drop function public.waiting_withdrawals(uuid);
drop function private.waiting_withdrawals(uuid);
create function private.waiting_withdrawals(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, photo_path text, amount_paise bigint, kind text, bank_name text, vpa text,
               account_number text, ifsc text, holder_name text, requested_at timestamptz, needs_second boolean, approved_by text[],
               status text, payout_failure text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, m.id, m.full_name, (select k.photo_path from public.kyc_record k where k.member_id = m.id), w.amount_paise, a.kind, a.bank_name,
         case when private.has_permission(p_venue_id, 'withdrawals.approve') then a.vpa else '••••@' || split_part(a.vpa, '@', 2) end,
         case when private.has_permission(p_venue_id, 'withdrawals.approve') then a.account_number else '••••' || right(a.account_number, 4) end,
         a.ifsc, a.holder_name, w.created_at,
         private.second_approver_needed(w.venue_id, w.amount_paise, now()),
         coalesce((select array_agg(s.full_name order by sa.approved_at, sa.id) from public.second_approval sa join public.staff s on s.id = sa.approved_by_staff_id
                   where sa.venue_id = w.venue_id and sa.subject = 'withdrawal' and sa.subject_id = w.id and sa.amount_paise = w.amount_paise), '{}'),
         w.status, w.payout_failure
  from public.withdrawal_request w
  join public.member m on m.id = w.member_id
  join public.payout_account a on a.id = w.payout_account_id
  where w.venue_id = p_venue_id and w.status in ('waiting', 'paying')
    and (private.has_permission(p_venue_id, 'withdrawals.approve') or private.has_permission(p_venue_id, 'cage.second_approve'))
  order by w.created_at, w.id;
$$;
create function public.waiting_withdrawals(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, photo_path text, amount_paise bigint, kind text, bank_name text, vpa text,
               account_number text, ifsc text, holder_name text, requested_at timestamptz, needs_second boolean, approved_by text[],
               status text, payout_failure text)
language sql stable security invoker set search_path = ''
as $$ select * from private.waiting_withdrawals(p_venue_id); $$;
revoke execute on function private.waiting_withdrawals(uuid), public.waiting_withdrawals(uuid) from public, anon;
grant execute on function private.waiting_withdrawals(uuid), public.waiting_withdrawals(uuid) to authenticated;

-- As before (20261020090300_withdrawals.sql), a withdrawal paying through Cashfree counting as the one waiting.
create or replace function private.withdrawal_refusal(p_member public.member, p_amount_paise bigint, p_payout_account_id uuid)
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
  if exists (select 1 from public.withdrawal_request w where w.member_id = p_member.id and w.status in ('waiting', 'paying')) then
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

-- The function that pays and follows Cashfree payouts runs each minute.
select private.schedule_outbox_consumer('withdrawal-payout', '* * * * *');

-- The practice venue's seed gains its Cashfree payout balance (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
