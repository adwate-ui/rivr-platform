-- More call time, as the owner set it on 3 Nov (decision 0305), changing 20261103200200 (decision 0320):
-- 1. The lengths offered are the club's setting call_time.add_choices, ticked from eight presets (15, 30, 45 minutes,
--    1 hour, 1 hour 30, 2, 3 or 4 hours). None ticked offers 30 minutes, 1 hour and 2 hours, as before.
-- 2. More time may be asked for, and approved, after the call time is met (the owner, answering #782; decision 0324 is
--    undone). It is added to the later of the call time and the whole minutes played, so it runs from now
--    (private.extended_call_time, the twin of @rivr/domain extendedCallTime on packages/testing/golden/callTimeExtension.json).
--    The seat owes it again: time added clears the completion (promotions keep the first, call_time_first_met_at),
--    and the minute sweep completes it again once played.
-- 3. The floor's managers (call_time.override: the floor, cashiers, admins and super admins) add a length offered
--    themselves (add_seat_call_time), and time requests are a queue of their own on the rail, Time requests, no longer
--    counted on the live floor.

insert into public.setting_key (key, description, scope, value_schema) values
  ('call_time.add_choices',
   'The lengths of more call time offered: a member asks for one from the seat, the floor adds one. None set is 30 minutes, 1 hour and 2 hours.',
   'venue',
   '{"type":"object","properties":{"minutes":{"type":"array","minItems":1,"maxItems":8,"items":{"type":"string","enum":["15","30","45","60","90","120","180","240"]}}},"required":["minutes"],"additionalProperties":false}');

-- A request is for any length the club may offer.
alter table public.call_time_request drop constraint call_time_request_minutes_check;
alter table public.call_time_request add constraint call_time_request_minutes_check check (minutes in (15, 30, 45, 60, 90, 120, 180, 240));

-- When a seat's call time was first met, kept when more is added after it (and the completion cleared), so promotions
-- still count the call time completed: a member keeps a completion earned (decision 0305).
alter table public.seat_session add column call_time_first_met_at timestamptz;
comment on column public.seat_session.call_time_first_met_at is
  'When the call time was first met, kept once more is added after it and the completion is cleared (decision 0305).';
insert into private.member_export_column (table_name, column_name, kind) values ('seat_session', 'call_time_first_met_at', 'owed');

-- The lengths a venue offers now, shortest first.
create function private.add_time_choices(p_venue_id uuid)
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select array_agg(m::integer order by m::integer)
     from jsonb_array_elements_text(private.setting_at(p_venue_id, 'call_time.add_choices', '', now()) -> 'minutes') m),
    array[30, 60, 120]);
$$;

-- The floor's lengths to offer on a seat's row: for the floor of the venue.
create function private.floor_add_time_choices(p_venue_id uuid)
returns integer[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the floor reads the lengths of call time offered' using errcode = '42501';
  end if;
  return private.add_time_choices(p_venue_id);
end;
$$;
create function public.add_time_choices(p_venue_id uuid)
returns integer[] language sql stable security invoker set search_path = ''
as $$ select private.floor_add_time_choices(p_venue_id); $$;

-- The whole minutes a session has been played at `p_at`: time seated less time away, as private.call_time_left counts it.
create function private.minutes_played(p_session public.seat_session, p_at timestamptz)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(0, floor((extract(epoch from (e.end_at - p_session.started_at)) - p_session.away_seconds
                            - coalesce(greatest(0, extract(epoch from (e.end_at - p_session.away_since))), 0)) / 60))::integer
  from (select case when p_session.ended_at is not null and p_session.ended_at < p_at then p_session.ended_at else p_at end as end_at) e;
$$;

-- The rule: a length the club may offer, added whole to the later of the call time and the minutes played, to a seat with
-- a call time, up to a day in all; null for anything else.
drop function private.extended_call_time(integer, integer);
create function private.extended_call_time(p_current integer, p_played integer, p_add integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_add in (15, 30, 45, 60, 90, 120, 180, 240) and p_current > 0
              and greatest(p_current, coalesce(p_played, 0)) + p_add <= 1440
         then greatest(p_current, coalesce(p_played, 0)) + p_add end;
$$;

-- The member asks: seated, with call time open to them, a length the venue offers. Met or not. The same request id asks
-- once; while one request waits, another tap gives that one back.
create or replace function private.request_call_time(p_minutes integer, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
  v_id uuid;
begin
  if not private.has_feature(v_session.member_id, 'call_time.view') then
    raise exception 'Call time is not open to you' using errcode = '42501';
  end if;
  select r.id into v_id from public.call_time_request r
  where r.venue_id = v_session.venue_id and r.idempotency_key = p_idempotency_key and r.member_id = v_session.member_id;
  if v_id is not null then return v_id; end if;
  select r.id into v_id from public.call_time_request r where r.session_id = v_session.id and r.status = 'requested';
  if v_id is not null then return v_id; end if;
  if not (p_minutes = any (private.add_time_choices(v_session.venue_id)))
     or private.extended_call_time(v_session.call_time_minutes, private.minutes_played(v_session, now()), p_minutes) is null then
    raise exception 'More call time is a length the club offers, to a call time, up to a day' using errcode = '22023';
  end if;
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key)
  values (v_session.venue_id, v_session.member_id, v_session.id, p_minutes, p_idempotency_key)
  returning id into v_id;
  return v_id;
end;
$$;

-- The floor decides, once: approved, the seat's call time grows by the rule, met or not, and its 15-minute warning is owed
-- again (call_time.updated tells the member's devices); declined, nothing changes.
create or replace function private.decide_call_time_request(p_request_id uuid, p_is_approved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.call_time_request;
  v_session public.seat_session;
  v_minutes integer;
begin
  select * into v_request from public.call_time_request r where r.id = p_request_id for update;
  if v_request.id is null or not private.has_permission(v_request.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor decides call time' using errcode = '42501';
  end if;
  perform private.assert_writable(v_request.venue_id, null, v_request.member_id);
  select * into v_session from public.seat_session s where s.id = v_request.session_id for update;
  if v_request.status <> 'requested' or p_is_approved is null or v_session.ended_at is not null then
    raise exception 'A request is decided once, while the member is seated' using errcode = '22023';
  end if;
  if p_is_approved then
    v_minutes := private.extended_call_time(v_session.call_time_minutes, private.minutes_played(v_session, now()), v_request.minutes);
    if v_minutes is null then
      raise exception 'Call time is at most a day' using errcode = '22023';
    end if;
    update public.seat_session
    set call_time_minutes = v_minutes, ending_warned_at = null,
        call_time_first_met_at = coalesce(call_time_first_met_at, call_time_completed_at), call_time_completed_at = null
    where id = v_session.id;
    perform private.emit(v_request.venue_id, 'call_time.updated',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_minutes),
                         'call_time.updated:' || v_request.id);
  end if;
  update public.call_time_request
  set status = case when p_is_approved then 'approved' else 'declined' end, decided_at = now(),
      decided_by_staff_id = private.current_staff_id(v_request.venue_id)
  where id = v_request.id;
end;
$$;

-- The floor's managers add a length offered to a seated player's call time, by the same rule, without a member's request:
-- kept as a request approved at once, with who added it. The same request id again adds nothing more (a retry after a
-- lost answer), and one used for another seat or length is refused.
create function private.add_seat_call_time(p_session_id uuid, p_minutes integer, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_done public.call_time_request;
  v_minutes integer;
  v_id uuid;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'call_time.override') then
    raise exception 'Only the floor''s managers add call time' using errcode = '42501';
  end if;
  select * into v_done from public.call_time_request r where r.venue_id = v_session.venue_id and r.idempotency_key = p_idempotency_key;
  if v_done.id is not null then
    if v_done.session_id <> v_session.id or v_done.minutes <> p_minutes then
      raise exception 'That request id was for another addition' using errcode = '22023';
    end if;
    return;
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  if p_idempotency_key is null or v_session.ended_at is not null or not (p_minutes = any (private.add_time_choices(v_session.venue_id))) then
    raise exception 'More call time is a length the club offers, for a seated player, with a request id' using errcode = '22023';
  end if;
  v_minutes := private.extended_call_time(v_session.call_time_minutes, private.minutes_played(v_session, now()), p_minutes);
  if v_minutes is null then
    raise exception 'More call time goes to a call time, up to a day' using errcode = '22023';
  end if;
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, status, idempotency_key, decided_at, decided_by_staff_id)
  values (v_session.venue_id, v_session.member_id, v_session.id, p_minutes, 'approved', p_idempotency_key, now(),
          private.current_staff_id(v_session.venue_id))
  returning id into v_id;
  update public.seat_session
  set call_time_minutes = v_minutes, ending_warned_at = null,
      call_time_first_met_at = coalesce(call_time_first_met_at, call_time_completed_at), call_time_completed_at = null
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'call_time.updated',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_minutes),
                       'call_time.updated:' || v_id);
end;
$$;
create function public.add_seat_call_time(p_session_id uuid, p_minutes integer, p_idempotency_key uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.add_seat_call_time(p_session_id, p_minutes, p_idempotency_key); $$;

-- As 20261020180451_completed_call_time.sql made it, with a call time met before more was added still counting: a member
-- keeps the completion they earned (decision 0305).
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
                                  where s.member_id = p_member_id
                                    and coalesce(s.call_time_first_met_at, s.call_time_completed_at) <= p_at
                                    and s.visit_id = (select v.id from public.visit v
                                                      where v.member_id = p_member_id and v.opened_at <= p_at
                                                        and (v.closed_at is null or v.closed_at >= p_at)
                                                      order by v.opened_at desc limit 1)))
  from public.member m where m.id = p_member_id;
$$;

-- As 20261019092100_call_time.sql made it, with the call time in call_time.completed's key, as the sweep's below.
create or replace function private.seat_session_ended_call_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.ended_at is null and new.ended_at is not null and new.call_time_minutes > 0 and new.call_time_completed_at is null
     and private.call_time_left(new.call_time_minutes, new.started_at, new.away_seconds, new.away_since, new.ended_at, new.ended_at) = 0 then
    new.call_time_completed_at := new.ended_at;
    perform private.emit(new.venue_id, 'call_time.completed',
                         jsonb_build_object('session_id', new.id, 'member_id', new.member_id, 'table_id', new.table_id, 'seat', new.seat),
                         'call_time.completed:' || new.id || ':' || new.call_time_minutes);
  end if;
  return new;
end;
$$;

-- As 20261103200500_call_time_ending.sql made it, with the call time in call_time.completed's key: a call time met again
-- after more was added is a new event, as its second warning is.
create or replace function private.sweep_seated_time()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_due record;
  v_ending record;
begin
  for v_session in
    select * from public.seat_session s
    where s.ended_at is null and s.call_time_completed_at is null and s.call_time_minutes > 0 and private.session_call_time(s, now()) = 0
    for update skip locked
  loop
    update public.seat_session set call_time_completed_at = now() where id = v_session.id;
    perform private.emit(v_session.venue_id, 'call_time.completed',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                            'seat', v_session.seat), 'call_time.completed:' || v_session.id || ':' || v_session.call_time_minutes);
  end loop;
  for v_ending in
    select s.id, s.venue_id, s.member_id, s.seat, s.call_time_minutes, t.name as table_name,
           now() + make_interval(secs => private.session_call_time(s, now())) as ends_at
    from public.seat_session s
    join public.game_table t on t.id = s.table_id
    where s.ended_at is null and s.away_since is null and s.call_time_completed_at is null and s.ending_warned_at is null
      and s.call_time_minutes > 0 and private.session_call_time(s, now()) between 1 and 15 * 60
      -- Only a member who may see their call time hears it is ending (my_seat hides it otherwise).
      and private.has_feature(s.member_id, 'call_time.view')
    for update of s skip locked
  loop
    update public.seat_session set ending_warned_at = now() where id = v_ending.id;
    perform private.emit(v_ending.venue_id, 'call_time.ending',
                         jsonb_build_object('session_id', v_ending.id, 'member_id', v_ending.member_id, 'table_name', v_ending.table_name,
                                            'seat', v_ending.seat, 'ends_at', v_ending.ends_at),
                         'call_time.ending:' || v_ending.id || ':' || v_ending.call_time_minutes);
  end loop;
  for v_due in
    select s.id, s.venue_id, s.member_id, r.session_reminder_hours as hours from public.seat_session s
    cross join lateral private.member_restrictions(s.member_id, now()) r
    where s.ended_at is null and s.reminded_at is null and r.session_reminder_hours is not null
      and s.started_at + make_interval(hours => r.session_reminder_hours) <= now()
    for update of s skip locked
  loop
    update public.seat_session set reminded_at = now() where id = v_due.id;
    perform private.emit(v_due.venue_id, 'session.reminder',
                         jsonb_build_object('session_id', v_due.id, 'member_id', v_due.member_id, 'hours', v_due.hours),
                         'session.reminder:' || v_due.id);
  end loop;
end;
$$;

-- As 20261103200200_call_time_requests.sql made it, with the lengths the venue offers, for the app's Add time.
drop function public.my_seat();
drop function private.my_seat();
create function private.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint, time_request_minutes integer,
               add_time_choices integer[])
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, s.seat, s.away_since is not null, s.call_time_minutes > 0,
         case when f.sees_call_time then private.session_call_time(s, now()) end,
         floor(extract(epoch from now() - s.started_at))::integer, s.leaving_at is not null, private.top_up_state(s),
         case when f.sees_call_time then s.call_time_minutes end, s.started_at,
         case when f.sees_call_time and s.call_time_minutes > 0 and s.away_since is null
              then now() + make_interval(secs => private.session_call_time(s, now())) end,
         t.name, t.small_blind_paise, t.big_blind_paise,
         (select r.minutes from public.call_time_request r where r.session_id = s.id and r.status = 'requested'),
         private.add_time_choices(s.venue_id)
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type t on t.id = g.table_type_id
  cross join lateral (select private.has_feature(s.member_id, 'call_time.view') as sees_call_time) f
  where s.member_id = private.current_member_id() and s.ended_at is null;
$$;
create function public.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint, time_request_minutes integer,
               add_time_choices integer[])
language sql stable security invoker set search_path = ''
as $$ select * from private.my_seat(); $$;

-- As 20261103200300_order_on_its_way.sql made it, with time requests a queue of their own (Time requests), red with a
-- chime; the live floor counts the leaving list alone again.
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

revoke execute on function private.add_time_choices(uuid), private.minutes_played(public.seat_session, timestamptz),
  private.extended_call_time(integer, integer, integer), private.sweep_seated_time()
  from public, anon, authenticated;
revoke execute on function private.floor_add_time_choices(uuid), public.add_time_choices(uuid),
  private.add_seat_call_time(uuid, integer, uuid), public.add_seat_call_time(uuid, integer, uuid),
  private.my_seat(), public.my_seat() from public, anon;
grant execute on function private.floor_add_time_choices(uuid), public.add_time_choices(uuid),
  private.add_seat_call_time(uuid, integer, uuid), public.add_seat_call_time(uuid, integer, uuid),
  private.my_seat(), public.my_seat() to authenticated;

-- The practice venue's seed keeps the new column (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
