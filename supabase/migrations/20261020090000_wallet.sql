-- The member's Balance (#18; features "Wallet", design prompt "Balance"): wallet cash, points and the
-- credit limit in one row, and every money line on the member's own accounts, newest first. Bonus
-- grants and markers the member already reads (#17, #74). Points are their own ledger and never turn
-- into cash: Balance shows the points balance, and points history stays with Rewards behind the tier's
-- rewards.points_history (decision 0062).

-- The signed-in member's cash, points and credit limit (null with no credit line, or a line at
-- nothing). The limit is read here because the credit line itself, with its reasons and proposals,
-- is for staff.
create function private.my_wallet()
returns table (member_id uuid, cash_paise bigint, points bigint, credit_limit_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
         coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = m.id and a.code = 'member.cash'), 0)::bigint,
         coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = m.id and a.code = 'member.points'), 0)::bigint,
         (select nullif(c.limit_paise, 0) from public.credit_line c where c.member_id = m.id and c.venue_id = m.venue_id)
  from public.member m
  where m.id = private.current_member_id();
$$;

revoke execute on function private.my_wallet() from public, anon;
grant execute on function private.my_wallet() to authenticated;

create function public.my_wallet()
returns table (member_id uuid, cash_paise bigint, points bigint, credit_limit_paise bigint) language sql stable security invoker set search_path = ''
as $$ select * from private.my_wallet(); $$;

revoke execute on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

-- Every money line on the signed-in member's accounts (cash, bonus, and the receivable their markers
-- owe): when, what kind of movement, which account, and by how much as the member sees it (more cash
-- or bonus, or more owed, is positive), with the table it happened at and a bonus's reason. The
-- member's own rows only, under each table's policies.
create view public.my_wallet_movement
with (security_invoker = true)
as
select e.id, t.created_at as at, t.kind, substring(a.code from 8) as account,
       case when a.kind = 'asset' then e.amount else -e.amount end as amount,
       g.name as table_name, b.reason as bonus_reason
from public.ledger_entry e
join public.ledger_account a on a.id = e.account_id
join public.ledger_transaction t on t.id = e.transaction_id
left join public.cage_transaction c on c.ledger_transaction_id = t.id
left join public.marker k on k.ledger_transaction_id = t.id
left join public.seat_session s on s.id = coalesce(c.session_id, k.session_id)
left join public.game_table g on g.id = s.table_id
left join public.bonus_grant b on b.ledger_transaction_id = t.id
where a.member_id = (select private.current_member_id()) and a.unit = 'paise';

comment on view public.my_wallet_movement is 'The signed-in member''s money lines, as Balance lists them (#18).';

grant select on public.my_wallet_movement to authenticated;
