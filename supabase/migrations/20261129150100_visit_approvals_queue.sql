-- Visits waiting for a super admin are a queue of their own (#1134), so the console counts them on the rail and chimes, as it
-- does for Bonus approvals. Generated from the live definition by gen1134.py, that one row added.
CREATE OR REPLACE FUNCTION private.staff_queue_counts(p_venue_id uuid)
 RETURNS TABLE(queue text, waiting integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select q.queue, q.waiting::integer
  from (values
    ('waitlist', (select count(*) from private.waitlist_requests(p_venue_id))),
    ('topUps', (select count(*) from private.top_ups_tonight(p_venue_id) t where t.status in ('requested', 'in_progress'))),
    -- Seats whose member set or extended their call time and the floor has not marked it seen (#1090), as floor_requests.
    ('callTimeSet', (select count(*) from public.seat_session s
                     where s.venue_id = p_venue_id and s.ended_at is null
                       and exists (select 1 from public.call_time_request r where r.session_id = s.id and r.status = 'approved'
                                     and r.decided_by_staff_id is null and r.seen_at is null)
                       and private.has_permission(p_venue_id, 'waitlist.manage'))),
    ('fnb', (select count(*) from private.fnb_orders_tonight(p_venue_id) o where o.delivered_at is null and o.cancelled_at is null)),
    -- A member's own cancellation, for a minute, so the console chimes: the bar may already hold its KOT.
    ('fnbCancelled', (select count(*) from private.fnb_orders_tonight(p_venue_id) o
                      where o.cancel_reason = 'Cancelled by the member' and o.cancelled_at > now() - interval '1 minute')),
    ('liveFloor', (select count(*) from private.floor_seats(p_venue_id) s where s.leaving_at is not null)),
    -- Approved players the floor can seat now (the owner, 8 Nov).
    ('seating', (select count(*) from private.seating_alerts(p_venue_id) a where a.state = 'ready')),
    ('kycReview', (select count(*) from private.kyc_review_queue(p_venue_id) k where k.status = 'needs_review')),
    ('feedback', (select count(*) from private.venue_feedback(p_venue_id) f where f.is_ticket and f.resolved_at is null)),
    -- Waiting for an approver: a marketer who asked sees the list, but only a super admin decides.
    ('promotions', (select count(*) from private.promotions_awaiting_approval(p_venue_id)
                    where private.has_permission(p_venue_id, 'promotions.approve'))),
    -- Bonus a promotion calculated, waiting for a super admin, as the queue lists it (decision 0670).
    ('bonusApprovals', (select count(*) from public.promotion_grant g join public.member m on m.id = g.member_id and m.erased_at is null
                        where g.venue_id = p_venue_id and g.status = 'waiting' and private.is_super_admin(p_venue_id)
                          and not private.is_own_cage_record(g.member_id) and not coalesce(private.is_own_kyc_check(g.member_id), false))),
    -- Visits the floor or an admin added, waiting for a super admin (#1134), as visits_waiting lists them.
    ('visitApprovals', (select count(*) from private.visits_waiting(p_venue_id))),
    -- Members who asked to delete their account, for those who erase.
    ('erasureRequests', (select count(*) from private.member_erasure_requests(p_venue_id)))
  ) as q (queue, waiting)
  where q.waiting > 0;
$function$;
