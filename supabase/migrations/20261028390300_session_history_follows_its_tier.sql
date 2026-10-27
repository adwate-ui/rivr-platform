-- Session history follows its tier switch (#504; #496 item 5, the owner's answer of 27 Oct). A member reads their own
-- past visits and seats, their buy-ins and cash-outs, settled markers and what cash-outs settled only with
-- sessions.history in their tier. What is open now is not history and stays readable whatever the tier: tonight's
-- visit and seat, and a marker still owed, which the wallet shows (#75). TDS stays readable too, as a member is owed
-- the certificate whatever their tier (decision 0169). The gate is the signed-in member's, read once a query. Balance
-- still names each movement's table (below).
drop policy "members see their own visits" on public.visit;
create policy "members see their own visits, past ones with session history" on public.visit
  for select to authenticated
  using (member_id = (select private.current_member_id()) and (closed_at is null or (select private.has_feature((select private.current_member_id()), 'sessions.history'))));

drop policy "members see their own seat sessions" on public.seat_session;
create policy "members see their own seat sessions, past ones with session history" on public.seat_session
  for select to authenticated
  using (member_id = (select private.current_member_id()) and (ended_at is null or (select private.has_feature((select private.current_member_id()), 'sessions.history'))));

drop policy "members see their own cage transactions" on public.cage_transaction;
create policy "members with session history see their own cage transactions" on public.cage_transaction
  for select to authenticated
  using (member_id = (select private.current_member_id()) and (select private.has_feature((select private.current_member_id()), 'sessions.history')));

drop policy "members see their own markers" on public.marker;
create policy "members see their own markers, settled ones with session history" on public.marker
  for select to authenticated
  using (member_id = (select private.current_member_id()) and (settled_at is null or (select private.has_feature((select private.current_member_id()), 'sessions.history'))));

drop policy "members see what their cash-outs settled" on public.marker_settlement;
create policy "members with session history see what their cash-outs settled" on public.marker_settlement
  for select to authenticated
  using (marker_id in (select k.id from public.marker k where k.member_id = (select private.current_member_id())) and (select private.has_feature((select private.current_member_id()), 'sessions.history')));

-- Balance, a core feature, names the table of each buy-in, cash-out and marker (#68). It read that through the cage
-- transaction, the marker and the seat, which a member without session history no longer reads, so it now asks this
-- helper, which answers only for a ledger transaction with a line on the member's own account.
create function private.movement_table_name(p_ledger_transaction_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select g.name
  from public.ledger_transaction t
  left join public.cage_transaction c on c.ledger_transaction_id = t.id
  left join public.marker k on k.ledger_transaction_id = t.id
  join public.seat_session s on s.id = coalesce(c.session_id, k.session_id)
  join public.game_table g on g.id = s.table_id
  where t.id = p_ledger_transaction_id
    and exists (select 1 from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
                where e.transaction_id = t.id and a.member_id = (select private.current_member_id()))
  limit 1;
$$;

revoke execute on function private.movement_table_name(uuid) from public, anon;
grant execute on function private.movement_table_name(uuid) to authenticated;

-- As before (20261020090400_deposits.sql), with the table from private.movement_table_name.
create or replace view public.my_wallet_movement
with (security_invoker = true)
as
select e.id, t.created_at as at, t.kind, substring(a.code from 8) as account,
       case when a.kind = 'asset' then e.amount else -e.amount end as amount,
       private.movement_table_name(t.id) as table_name, b.reason as bonus_reason, p.bank_name, d.utr
from public.ledger_entry e
join public.ledger_account a on a.id = e.account_id
join public.ledger_transaction t on t.id = e.transaction_id
left join public.bonus_grant b on b.ledger_transaction_id = t.id
left join public.withdrawal_request w on t.id in (w.hold_transaction_id, w.outcome_transaction_id)
left join public.payout_account p on p.id = w.payout_account_id
left join public.deposit_request d on d.ledger_transaction_id = t.id
where a.member_id = (select private.current_member_id()) and a.unit = 'paise';
