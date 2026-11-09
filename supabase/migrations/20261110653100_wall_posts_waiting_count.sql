-- Social shows a count of wall posts waiting for approval, as other queues do (the owner, 9 Nov, #874). Nothing expires.
-- As 20261110600050_published_tournaments_for_staff.sql made it, with that count.
create or replace function private.staff_queue_counts(p_venue_id uuid)
returns table (queue text, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select q.queue, q.waiting::integer
  from (values
    ('waitlist', (select count(*) from private.waitlist_requests(p_venue_id))),
    ('topUps', (select count(*) from private.top_ups_tonight(p_venue_id) t where t.status in ('requested', 'in_progress'))),
    ('timeRequests', (select count(*) from private.floor_seats(p_venue_id) s where s.time_request_id is not null)),
    ('fnb', (select count(*) from private.fnb_orders_tonight(p_venue_id) o where o.delivered_at is null and o.cancelled_at is null)),
    -- A member's own cancellation, for a minute, so the console chimes: the bar may already hold its KOT.
    ('fnbCancelled', (select count(*) from private.fnb_orders_tonight(p_venue_id) o
                      where o.cancel_reason = 'Cancelled by the member' and o.cancelled_at > now() - interval '1 minute')),
    ('liveFloor', (select count(*) from private.floor_seats(p_venue_id) s where s.leaving_at is not null)),
    -- Approved players the floor can seat now (the owner, 8 Nov).
    ('seating', (select count(*) from private.seating_alerts(p_venue_id) a where a.state = 'ready')),
    ('kycReview', (select count(*) from private.kyc_review_queue(p_venue_id) k where k.status = 'needs_review')),
    ('rewards', (select count(*) from private.venue_redemptions(p_venue_id) r where r.handed_over_at is null)),
    ('feedback', (select count(*) from private.venue_feedback(p_venue_id) f where f.is_ticket and f.resolved_at is null)),
    -- Waiting for an approver: a marketer who asked sees the list, but only a super admin decides.
    ('promotions', (select count(*) from private.promotions_awaiting_approval(p_venue_id)
                    where private.has_permission(p_venue_id, 'promotions.approve'))),
    -- Calls not yet made: a call logged without an offer stays open, handled.
    ('hostQueue', (select count(*) from private.host_queue(p_venue_id) h where h.status = 'open' and h.handled_at is null)),
    ('tournamentInterest', (select count(*) from private.tournament_interest_list(p_venue_id) i
                            join public.tournament t on t.id = i.tournament_id
                            where i.registered_at is null and t.is_published)),
    -- Wall posts waiting for approval, for those who approve them.
    ('wallPosts', (select count(*) from public.wall_post w
                   where w.venue_id = p_venue_id and w.status = 'pending' and private.has_permission(p_venue_id, 'marketing.publish')))
  ) as q (queue, waiting)
  where q.waiting > 0;
$$;
