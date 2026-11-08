-- A member cancels an order they just sent (audit 8 Nov, F-048): their own, and only before the bar accepts it. It is a void
-- as staff's is (decision 0302), with one fixed reason, so the order leaves the lanes and the tracker says so. Audited. The
-- console's count falls with it, and the minute's fnbCancelled queue chimes, as the bar may already hold its KOT.

-- Refusals: 42501 not a member with table-side ordering, or not their order; 22023 the bar has accepted it; RVFRZ the venue
-- frozen. A second tap changes nothing.
create function private.cancel_my_fnb_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_order public.fnb_order;
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'fnb.table_side') then
    raise exception 'Table-side ordering is not part of your tier' using errcode = '42501';
  end if;
  select * into v_order from public.fnb_order o where o.id = p_order_id and o.member_id = v_member_id for update;
  if v_order.id is null then
    raise exception 'Only their own order is a member''s to cancel' using errcode = '42501';
  end if;
  if v_order.cancelled_at is not null then
    return;
  end if;
  if v_order.accepted_at is not null then
    raise exception 'The bar has accepted that order' using errcode = '22023';
  end if;
  perform private.assert_writable(v_order.venue_id);
  update public.fnb_order set cancelled_at = now(), cancel_reason = 'Cancelled by the member' where id = v_order.id;
  perform private.audit(v_order.venue_id, 'fnb_order.cancel', 'fnb_order', v_order.id::text, null, null, 'Cancelled by the member');
end;
$$;

create function public.cancel_my_fnb_order(p_order_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.cancel_my_fnb_order(p_order_id); $$;

revoke execute on function private.cancel_my_fnb_order(uuid), public.cancel_my_fnb_order(uuid) from public, anon;
grant execute on function private.cancel_my_fnb_order(uuid), public.cancel_my_fnb_order(uuid) to authenticated;

-- As 20261109210000_seating_alerts.sql made it, with the minute's cancellations.
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
    ('tournamentInterest', (select count(*) from private.tournament_interest_list(p_venue_id) i where i.registered_at is null))
  ) as q (queue, waiting)
  where q.waiting > 0;
$$;
