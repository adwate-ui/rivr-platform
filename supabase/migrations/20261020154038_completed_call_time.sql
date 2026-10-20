-- Completed call time as a promotion condition (#80, as #78 records it): a seat in the member's visit
-- at that moment whose call time the sweep recorded complete by then (seat_session.call_time_completed_at).
-- The visit is the one open at that moment, so an event at check-out, when the visit has just closed
-- (points are earned then), still finds it. Otherwise #83's facts unchanged.
create or replace function private.promotion_facts(p_member_id uuid, p_table_id uuid, p_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'at', p_at,
    'club_day', (private.tonight_began(p_at) at time zone 'Asia/Kolkata')::date,
    'tier_id', m.tier_id,
    'stake', (select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = p_table_id),
    'table_id', p_table_id,
    'visits_in_month', private.visits_this_month(p_member_id, p_at),
    'days_since_last_visit', (select floor(extract(epoch from p_at - max(v.opened_at)) / 86400)::integer from public.visit v
                              where v.member_id = p_member_id and v.opened_at <= p_at and v.id is distinct from private.current_visit(p_member_id)),
    'call_time_complete', exists (select 1 from public.seat_session s
                                  where s.member_id = p_member_id and s.call_time_completed_at <= p_at
                                    and s.visit_id = (select v.id from public.visit v
                                                      where v.member_id = p_member_id and v.opened_at <= p_at
                                                        and (v.closed_at is null or v.closed_at >= p_at)
                                                      order by v.opened_at desc limit 1)))
  from public.member m where m.id = p_member_id;
$$;
