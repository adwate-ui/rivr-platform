-- A member's points history (audit 8 Nov, F-054): every earn, spend and change one tap from the balance. It is read from
-- the ledger, so it is what the balance is made of: earned (a visit, a promotion, by hand), spent on a reward, back from a
-- cancelled redemption, given locked, and released to spend. Feature rewards.points_history (decision 0062).

-- A member's lines, newest first. A release moves points between the member's two accounts: it is read from the spendable
-- one alone, so it is one line. `staff_name` is who posted it, for the member's record; members are not shown it.
create function private.points_history(p_member_id uuid, p_limit integer)
returns table (line_id uuid, at timestamptz, kind text, points bigint, reason text, staff_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.occurred_at,
         case
           when a.code = 'member.points_locked' then 'locked'
           when t.kind = 'points_unlocked' then 'released'
           when t.kind = 'reversal' and e.amount < 0 then 'returned'
           when e.amount < 0 then 'earned'
           else 'spent'
         end,
         abs(e.amount),
         coalesce(t.memo, 'Points'),
         s.full_name
  from public.ledger_account a
  join public.ledger_entry e on e.account_id = a.id
  join public.ledger_transaction t on t.id = e.transaction_id
  left join public.staff s on s.user_id = t.created_by_user_id and s.venue_id = t.venue_id
  where a.member_id = p_member_id
    and (a.code = 'member.points' or (a.code = 'member.points_locked' and t.kind = 'points_locked'))
  order by t.occurred_at desc, t.id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$$;

-- The signed-in member's lines, with rewards.points_history. Who posted them is not shown to members.
create function private.my_points_history(p_limit integer)
returns table (line_id uuid, at timestamptz, kind text, points bigint, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.line_id, h.at, h.kind, h.points, h.reason from private.points_history(private.current_member_id(), p_limit) h
  where private.has_feature(private.current_member_id(), 'rewards.points_history');
$$;
create function public.my_points_history(p_limit integer default 20)
returns table (line_id uuid, at timestamptz, kind text, points bigint, reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_points_history(p_limit); $$;

revoke execute on function private.points_history(uuid, integer) from public, anon, authenticated;
revoke execute on function private.my_points_history(integer), public.my_points_history(integer) from public, anon;
grant execute on function private.my_points_history(integer), public.my_points_history(integer) to authenticated;
