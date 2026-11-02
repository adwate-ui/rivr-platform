-- "Your usual" on the Order screen (brief 3.5 and 7.4): the two items the member has ordered most over the last 90 days,
-- counted by the orders they were on, the more recent first on a tie; an order staff voided (decision 0302) does not count.
-- With table-side food and drink (fnb.table_side). The app shows only those still on the member's menu, and nothing without
-- history.
create function private.my_usual_fnb_items()
returns table (item_id uuid, times integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (l ->> 'item_id')::uuid, count(*)::integer
  from public.fnb_order o
  cross join lateral jsonb_array_elements(o.lines) l
  where o.member_id = private.current_member_id() and o.created_at > now() - interval '90 days' and o.cancelled_at is null
    and private.has_feature(o.member_id, 'fnb.table_side')
  group by 1
  order by count(*) desc, max(o.created_at) desc
  limit 2;
$$;
create function public.my_usual_fnb_items()
returns table (item_id uuid, times integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_usual_fnb_items(); $$;

revoke execute on function private.my_usual_fnb_items(), public.my_usual_fnb_items() from public, anon;
grant execute on function private.my_usual_fnb_items(), public.my_usual_fnb_items() to authenticated;
