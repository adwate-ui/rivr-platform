-- A member's own Set or Extend call time stays in the floor's Requests until the floor marks it seen (#1090, the owner, 19
-- Nov): the floor got only a toast and a minute's chime, easily missed. One item for the seat (floor_requests' call_time_set),
-- its latest change, counted for the chime and the header (staff_queue_counts' callTimeSet) until Seen or the seat ends;
-- the floor's own Set or Extend is never one. Seen marks that seat's member changes up to the one shown, by whom.

alter table public.call_time_request
  add column seen_at timestamptz,
  add column seen_by_staff_id uuid,
  add constraint call_time_request_seen_by_staff_id_venue_id_fkey foreign key (seen_by_staff_id, venue_id) references public.staff (id, venue_id),
  -- Only a member's own change is seen, and who saw it only with when.
  add constraint call_time_request_seen_check check ((seen_at is null or decided_by_staff_id is null) and (seen_by_staff_id is null or seen_at is not null));
create index call_time_request_seen_by_staff_id_idx on public.call_time_request (seen_by_staff_id, venue_id);
create index call_time_request_unseen_idx on public.call_time_request (session_id)
  where status = 'approved' and decided_by_staff_id is null and seen_at is null;
comment on column public.call_time_request.seen_at is 'When the floor marked a member''s own Set or Extend seen (#1090); until then it is in Requests.';

-- The member's data export carries them, as decided_by_staff_id.
insert into private.member_export_column (table_name, column_name, kind) values
  ('call_time_request', 'seen_at', 'owed'), ('call_time_request', 'seen_by_staff_id', 'owed');

-- Changes from before today are no news: none of tonight's seats opens with an item.
update public.call_time_request r set seen_at = now()
from public.seat_session s
where s.id = r.session_id and s.ended_at is null and r.status = 'approved' and r.decided_by_staff_id is null and r.seen_at is null;

CREATE OR REPLACE FUNCTION private.floor_requests(p_venue_id uuid)
 RETURNS TABLE(kind text, request_id uuid, session_id uuid, member_id uuid, full_name text, table_id uuid, seat integer, since timestamp with time zone, minutes integer, call_time_left integer, top_up text, owed_seconds integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the floor reads its requests' using errcode = '42501';
  end if;
  return query
  select r.* from (
    select 'join'::text, w.entry_id, null::uuid, w.member_id, w.full_name, w.table_id, null::integer, w.joined_at,
           null::integer, null::integer, null::text, null::integer
    from private.waitlist_requests(p_venue_id) w
    union all
    select 'top_up', t.id, s.id, s.member_id, m.full_name, s.table_id, s.seat, t.requested_at,
           null, private.session_call_time(s, now()), private.top_up_state(s), null
    from public.seat_session s
    join public.member m on m.id = s.member_id
    join public.top_up_request t on t.session_id = s.id and t.closed_at is null
    where s.venue_id = p_venue_id and s.ended_at is null and s.top_up_requested_at is not null
    union all
    select 'leaving', s.id, s.id, s.member_id, m.full_name, s.table_id, s.seat, s.leaving_at,
           null, private.session_call_time(s, now()), null,
           case when private.owes_call_time(s, now()) then coalesce(private.session_call_time(s, now()), 0) end
    from public.seat_session s
    join public.member m on m.id = s.member_id
    where s.venue_id = p_venue_id and s.ended_at is null and s.leaving_at is not null
    union all
    -- As left_owing_call_time: still in the room, their last seat ended owing, and nobody let them go yet.
    select 'left_owing', v.member_id, s.id, v.member_id, m.full_name, s.table_id, s.seat, s.ended_at,
           null, null, null, o.o_seconds
    from public.visit v
    join public.member m on m.id = v.member_id
    cross join lateral private.call_time_owed(v.member_id, now()) o
    join public.seat_session s on s.id = o.o_session_id
    where v.venue_id = p_venue_id and v.closed_at is null and s.ended_at is not null and o.o_owes
      and not exists (select 1 from public.early_departure e where e.session_id = o.o_session_id)
      and private.has_permission(p_venue_id, 'call_time.override')
    union all
    -- A member's own Set or Extend call time (#1090, the owner, 19 Nov): one item for the seat, its latest change the floor has
    -- not marked seen, until it is or the seat ends; `minutes` what they set or added, the call time left while they sit.
    select 'call_time_set', c.id, s.id, s.member_id, m.full_name, s.table_id, s.seat, c.decided_at,
           c.minutes, case when s.away_since is null then private.session_call_time(s, now()) end, null, null
    from public.seat_session s
    join public.member m on m.id = s.member_id
    cross join lateral (select r.id, r.decided_at, r.minutes from public.call_time_request r
                        where r.session_id = s.id and r.status = 'approved' and r.decided_by_staff_id is null and r.seen_at is null
                        order by r.decided_at desc, r.id desc limit 1) c
    where s.venue_id = p_venue_id and s.ended_at is null
    union all
    -- Approved and not yet seated (the owner, 8 Nov): `seat` while a seat is free for them or held for their call, so the
    -- floor seats them now; `seat_check` while their identity check is unfinished; `seat_wait` while their table is full.
    select case a.state when 'ready' then 'seat' when 'check' then 'seat_check' else 'seat_wait' end, a.entry_id, null::uuid, a.member_id,
           a.full_name, a.table_id, a.seat,
           a.since, null::integer, null::integer, null::text, null::integer
    from private.seating_alerts(p_venue_id) a
  ) as r (kind, request_id, session_id, member_id, full_name, table_id, seat, since, minutes, call_time_left, top_up, owed_seconds)
  order by r.since, r.request_id;
end;
$function$;

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
    -- Members who asked to delete their account, for those who erase.
    ('erasureRequests', (select count(*) from private.member_erasure_requests(p_venue_id)))
  ) as q (queue, waiting)
  where q.waiting > 0;
$function$;

-- The floor marks a member's Set or Extend seen: that seat's member changes up to the one shown, by whom. Again, nothing.
create function private.mark_call_time_seen(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.call_time_request;
begin
  select * into v_request from public.call_time_request r where r.id = p_request_id;
  if v_request.id is null or not private.has_permission(v_request.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor marks a call time seen' using errcode = '42501';
  end if;
  if v_request.status <> 'approved' or v_request.decided_by_staff_id is not null then
    raise exception 'Only a member''s own Set or Extend is marked seen' using errcode = '22023';
  end if;
  perform private.assert_writable(v_request.venue_id, null, v_request.member_id);
  update public.call_time_request r
  set seen_at = now(), seen_by_staff_id = private.current_staff_id(v_request.venue_id)
  where r.session_id = v_request.session_id and r.status = 'approved' and r.decided_by_staff_id is null and r.seen_at is null
    and (r.decided_at, r.id) <= (v_request.decided_at, v_request.id);
end;
$$;
create function public.mark_call_time_seen(p_request_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.mark_call_time_seen(p_request_id); $$;
revoke all on function private.mark_call_time_seen(uuid) from public, anon;
grant execute on function private.mark_call_time_seen(uuid) to authenticated;
revoke all on function public.mark_call_time_seen(uuid) from public, anon;
grant execute on function public.mark_call_time_seen(uuid) to authenticated;
