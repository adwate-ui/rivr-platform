-- A cancelled redemption stays on the member's list with the reason staff gave, rather than vanishing (decision 0302;
-- the workflow audit of 2 Nov).

-- As 20261028390600_a_cancelled_redemption_refunds.sql made it, with a cancelled redemption and the reason, which the member
-- now sees: the reason is theirs in an export too.
drop function public.my_redemptions();
drop function private.my_redemptions();
create function private.my_redemptions()
returns table (id uuid, reward_name text, kind text, detail text, points bigint, nights integer, created_at timestamptz, handed_over_at timestamptz,
               cancelled_at timestamptz, cancel_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, i.name, i.kind, i.detail, r.points, r.nights, r.created_at, r.handed_over_at, r.cancelled_at, r.cancel_reason
  from public.redemption r join public.reward_item i on i.id = r.reward_item_id
  where r.member_id = private.current_member_id() and private.has_feature(r.member_id, 'rewards.catalogue')
  order by r.created_at desc
  limit 20;
$$;
create function public.my_redemptions()
returns table (id uuid, reward_name text, kind text, detail text, points bigint, nights integer, created_at timestamptz, handed_over_at timestamptz,
               cancelled_at timestamptz, cancel_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_redemptions(); $$;

revoke execute on function private.my_redemptions(), public.my_redemptions() from public, anon;
grant execute on function private.my_redemptions(), public.my_redemptions() to authenticated;

update private.member_export_column set kind = 'owed' where table_name = 'redemption' and column_name = 'cancel_reason';
