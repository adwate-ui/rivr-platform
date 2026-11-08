-- Seating an approved player is a task for the floor (the owner, 8 Nov: "once somebody is approved, it should create an
-- alert for seating him"). Every place approved onto a table's list tonight and not yet seated is on the Live floor's
-- requests: ready to seat when its table is open and a seat is free for it (in the list's own order, as many as there are
-- free seats) or held for its call; its identity check first while that is unfinished (a selfie lets a member wait, the
-- desk checks them before they sit); else waiting, at a full table or one not open, and ready as a seat frees for it. The
-- ready ones count on the Live floor (and chime). The floor seats them; nobody is called by this (the owner's choice).

-- The places approved tonight and not yet seated, at their tables: each `ready`, `check` (identity check unfinished) or
-- `wait` (no seat free for it yet, or the table not open); `seat` the seat held for its call; `since` its call, else its
-- approval. For the floor (waitlist.manage).
create function private.seating_alerts(p_venue_id uuid)
returns table (entry_id uuid, member_id uuid, full_name text, table_id uuid, seat integer, since timestamptz, state text)
language sql
stable
security definer
set search_path = ''
as $$
  with free as (
    -- Seats neither sat in nor held for a call.
    select g.id, g.is_open,
           g.seats - (select count(*) from public.seat_session s where s.table_id = g.id and s.ended_at is null)
                   - (select count(*) from public.waitlist_entry h where h.call_table_id = g.id and h.status = 'waiting' and h.called_at is not null)
             as free_seats
    from public.game_table g where g.venue_id = p_venue_id
  ),
  places as (
    -- Tonight's approved places in the list's own order (private.ranked_waitlist: priority, then join time).
    select e.id, e.member_id, e.table_id, e.called_at, e.call_table_id, e.call_seat, e.approved_at, r.place,
           private.is_kyc_complete(e.member_id) as is_checked
    from private.ranked_waitlist((select array_agg(tt.id) from public.table_type tt where tt.venue_id = p_venue_id)) r
    join public.waitlist_entry e on e.id = r.entry_id
    where e.venue_id = p_venue_id and e.stepped_away_at is null and private.has_permission(p_venue_id, 'waitlist.manage')
  ),
  turns as (
    -- Each checked, uncalled place's turn for a free seat at its table.
    select p.*, case when p.is_checked and p.called_at is null
                     then row_number() over (partition by p.table_id, p.is_checked and p.called_at is null order by p.place) end as turn
    from places p
  ),
  stated as (
    select q.*,
           case when not q.is_checked then 'check'
                when not coalesce(f.is_open, false) then 'wait'
                when q.called_at is not null or q.turn <= f.free_seats then 'ready'
                else 'wait' end as state
    from turns q
    left join free f on f.id = coalesce(q.call_table_id, q.table_id)
  )
  select q.id, q.member_id, m.full_name, coalesce(q.call_table_id, q.table_id), case when q.called_at is not null then q.call_seat end,
         coalesce(q.called_at, q.approved_at), q.state
  from stated q
  join public.member m on m.id = q.member_id
  order by q.approved_at, q.id;
$$;

revoke execute on function private.seating_alerts(uuid) from public, anon, authenticated;

-- As 20261107300000_floor_requests.sql made it, with the approved places to seat.
create or replace function private.floor_requests(p_venue_id uuid)
returns table (kind text, request_id uuid, session_id uuid, member_id uuid, full_name text, table_id uuid, seat integer,
               since timestamptz, minutes integer, call_time_left integer, top_up text, owed_seconds integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    select 'time', c.id, s.id, s.member_id, m.full_name, s.table_id, s.seat, c.requested_at,
           c.minutes, private.session_call_time(s, now()), null, null
    from public.call_time_request c
    join public.seat_session s on s.id = c.session_id and s.ended_at is null
    join public.member m on m.id = s.member_id
    where c.venue_id = p_venue_id and c.status = 'requested'
    union all
    select 'leaving', s.id, s.id, s.member_id, m.full_name, s.table_id, s.seat, s.leaving_at,
           null, private.session_call_time(s, now()), null, null
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
    where v.venue_id = p_venue_id and v.closed_at is null and s.ended_at is not null and o.o_seconds > 0
      and not exists (select 1 from public.early_departure e where e.session_id = o.o_session_id)
      and private.has_permission(p_venue_id, 'call_time.override')
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
$$;

-- As 20261103210000_time_requests.sql made it, counting the places ready to seat.
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
