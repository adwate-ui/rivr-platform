-- Tonight's high hands name the member in full only for staff who read members (#1019). Marketing manage promotions and
-- read a promotion's hits, but do not read members: they see a first name and initial, as the TVs show
-- (private.first_name_and_initial). Everything else is as it was.
--
-- The function is the live definition (20261120130000_high_hand_on_the_floor.sql), so made, with the member's name the only
-- change.

CREATE OR REPLACE FUNCTION private.high_hand_tonight(p_venue_id uuid, p_promotion_id uuid, p_limit integer)
 RETURNS TABLE(hit_id uuid, logged_at timestamp with time zone, member_id uuid, member_name text, table_name text, seat integer, hand text, rank text, chips bigint, logged_by text, paid_count bigint, paid_chips bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select h.id, h.created_at, h.member_id,
         case when coalesce(private.has_permission(p_venue_id, 'members.read'), false) then m.full_name
              else private.first_name_and_initial(m.full_name) end,
         g.name, h.seat, h.hand, h.rank, h.chips, s.full_name,
         count(*) over (), (sum(h.chips) over ())::bigint
  from public.high_hand_hit h
  join public.member m on m.id = h.member_id
  join public.game_table g on g.id = h.table_id
  join public.staff s on s.id = h.logged_by_staff_id
  where h.venue_id = p_venue_id and h.created_at >= private.tonight_began(now())
    and (p_promotion_id is null or h.promotion_id = p_promotion_id)
    and private.reads_high_hands(p_venue_id)
  order by h.created_at desc, h.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$function$;
