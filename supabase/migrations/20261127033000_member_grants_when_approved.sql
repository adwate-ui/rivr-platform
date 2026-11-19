-- The member record's promotions say when each was given (#1019). Since a promotion's Bonus waits for a super admin (decision
-- 0670), the list showed when the Bonus was calculated, though the member had it only once approved. Now a Bonus that waited
-- shows, and is ordered by, when its decision approved it; anything given at once, when it was calculated, as before.

CREATE OR REPLACE FUNCTION private.member_promotion_grants(p_member_id uuid, p_limit integer)
 RETURNS TABLE(grant_id uuid, granted_at timestamp with time zone, club_day date, promotion_name text, version integer, chips bigint, perk text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, coalesce(d.created_at, g.created_at), g.club_day, coalesce(v.name, p.name), v.version, g.chips, g.perk
  from public.promotion_grant g
  join public.promotion p on p.id = g.promotion_id
  left join public.promotion_version v on v.id = g.promotion_version_id
  left join public.promotion_bonus_decision d on d.id = g.decision_id and d.venue_id = g.venue_id
  where g.member_id = p_member_id and g.status = 'given' and private.has_permission(g.venue_id, 'members.read')
  order by coalesce(d.created_at, g.created_at) desc, g.id
  limit greatest(least(coalesce(p_limit, 20), 5000), 1);
$function$;
