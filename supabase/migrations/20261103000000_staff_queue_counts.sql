-- Staff are told (decision 0301; the workflow audit of 2 Nov, the first of its three PRs): every staff queue counts what
-- waits beside its rail entry.

-- How many wait in each queue the signed-in staff member acts on, by the console rail entry they show beside. Each count
-- reads the queue's own list, so a count never differs from the screen it leads to; each list already shows nothing to
-- staff without its permission, and a queue with nothing waiting is left out.
create function private.staff_queue_counts(p_venue_id uuid)
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
    ('fnb', (select count(*) from private.fnb_orders_tonight(p_venue_id) o where o.delivered_at is null)),
    ('liveFloor', (select count(*) from private.floor_seats(p_venue_id) s where s.leaving_at is not null)),
    ('kycReview', (select count(*) from private.kyc_review_queue(p_venue_id) k where k.status = 'needs_review')),
    ('rewards', (select count(*) from private.venue_redemptions(p_venue_id) r where r.handed_over_at is null)),
    ('feedback', (select count(*) from private.venue_feedback(p_venue_id) f where f.is_ticket and f.resolved_at is null)),
    -- Waiting for an approver: a marketer who asked sees the list, but only a super admin decides.
    ('promotions', (select count(*) from private.promotions_awaiting_approval(p_venue_id)
                    where private.has_permission(p_venue_id, 'promotions.approve'))),
    -- Calls not yet made: a call logged without an offer stays open, handled.
    ('hostQueue', (select count(*) from private.host_queue(p_venue_id) h where h.status = 'open' and h.handled_at is null)),
    ('tournamentInterest', (select count(*) from private.tournament_interest_list(p_venue_id) i where i.registered_at is null))
  ) as q (queue, waiting)
  where q.waiting > 0;
$$;

create function public.staff_queue_counts(p_venue_id uuid)
returns table (queue text, waiting integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.staff_queue_counts(p_venue_id); $$;

revoke execute on function private.staff_queue_counts(uuid), public.staff_queue_counts(uuid) from public, anon;
grant execute on function private.staff_queue_counts(uuid), public.staff_queue_counts(uuid) to authenticated;
