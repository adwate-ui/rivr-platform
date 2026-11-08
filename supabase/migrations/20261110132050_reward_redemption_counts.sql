-- How many of each reward went in the last 30 days, for staff who keep the catalogue or hand rewards over (audit 8 Nov,
-- F-072), so a restock or a retirement has something to go on. A cancelled redemption did not go. Nothing for anyone else.

create function private.reward_redemption_counts(p_venue_id uuid)
returns table (reward_item_id uuid, redeemed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.reward_item_id, count(*)::integer
  from public.redemption r
  where r.venue_id = p_venue_id
    and r.cancelled_at is null
    and r.created_at >= now() - interval '30 days'
    and (coalesce(private.has_permission(p_venue_id, 'rewards.manage'), false)
         or coalesce(private.has_permission(p_venue_id, 'rewards.hand_over'), false))
  group by r.reward_item_id;
$$;
create function public.reward_redemption_counts(p_venue_id uuid)
returns table (reward_item_id uuid, redeemed integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.reward_redemption_counts(p_venue_id); $$;

revoke execute on function private.reward_redemption_counts(uuid), public.reward_redemption_counts(uuid) from public, anon;
grant execute on function private.reward_redemption_counts(uuid), public.reward_redemption_counts(uuid) to authenticated;
