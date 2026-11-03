-- Undo on the Live floor (console v3, phase 2; decision 0447). Every change the floor makes shows a toast with Undo for five
-- seconds, and Undo calls a compensating function here, never a rollback in the browser. Each takes back one change made in
-- the last two minutes (the toast's five seconds, and the rest a slow network's), by staff who may make it, never while the
-- venue or member is frozen, and refuses (22023) once anything has moved on from it.
-- - undo_seat: a seat taken goes, and the member is back on the lists seating took them off.
-- - undo_leave: a seat left is taken again. A player let go early is not: the early departure is the cage's record (#79).
-- - undo_call_time: time approved, added or declined goes back; the seat's call time is what it was before.
-- - undo_top_up: a top-up started goes back to asked for; one done or reset is open again.
-- - undo_waitlist_decision: a join approved is a request again; a join declined is back.
-- Moves, opening and closing a table, must-move links and Not leaving are undone by the functions that made them.

-- A change may be undone for two minutes after it was made.
create function private.is_undoable(p_at timestamptz)
returns boolean language sql stable set search_path = ''
as $$ select p_at is not null and p_at > now() - interval '2 minutes'; $$;

-- The seat's call time before more was approved or added, so undo_call_time puts it back; null for a decision made before
-- this, a declined request, or one undone. A floor addition undone is 'undone': it was never asked for.
alter table public.call_time_request add column minutes_before integer check (minutes_before between 0 and 1440);
comment on column public.call_time_request.minutes_before is
  'The seat''s call time in minutes before this request was approved or the floor added it (decision 0447); null otherwise.';
alter table public.call_time_request drop constraint call_time_request_status_check;
alter table public.call_time_request add constraint call_time_request_status_check
  check (status in ('requested', 'approved', 'declined', 'left', 'undone'));

-- As 20261103210000_time_requests.sql, and the call time before is kept with the request.
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
      decided_by_staff_id = private.current_staff_id(v_request.venue_id),
      minutes_before = case when p_is_approved then v_session.call_time_minutes end
  where id = v_request.id;
end;
$$;

-- As 20261103210000_time_requests.sql, and the call time before is kept with the addition.
create or replace function private.add_seat_call_time(p_session_id uuid, p_minutes integer, p_idempotency_key uuid)
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
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, status, idempotency_key, decided_at, decided_by_staff_id, minutes_before)
  values (v_session.venue_id, v_session.member_id, v_session.id, p_minutes, 'approved', p_idempotency_key, now(),
          private.current_staff_id(v_session.venue_id), v_session.call_time_minutes)
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

-- A seat taken in the last two minutes, and not moved since, goes; the member is back on the lists seating took them off.
create function private.undo_seat(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor undoes a seat' using errcode = '42501';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  if v_session.ended_at is not null or not private.is_undoable(v_session.started_at) or v_session.seated_here_at <> v_session.started_at then
    raise exception 'Only a seat taken in the last two minutes, not moved since, is undone' using errcode = '22023';
  end if;
  -- The place they were seated from, and the places seating took them off, wait again uncalled (a call moved on stays moved).
  update public.waitlist_entry e
  set status = 'waiting', seated_at = null, left_at = null, left_reason = null,
      called_at = null, hold_until = null, call_table_id = null, call_seat = null, on_way_at = null
  where e.member_id = v_session.member_id and e.venue_id = v_session.venue_id
    and ((e.status = 'seated' and e.seated_at >= v_session.started_at)
         or (e.status = 'left' and e.left_reason = 'seated' and e.left_at >= v_session.started_at));
  begin
    delete from public.seat_session where id = v_session.id;
  exception when foreign_key_violation then
    raise exception 'Something was already recorded at that seat' using errcode = '22023';
  end;
  -- The TV's call-time board hears a seat taken or changed; a seat gone is told here.
  perform private.signal_tv(v_session.venue_id, 'call_time');
end;
$$;

-- A seat left in the last two minutes is taken again, unless the player was let go early, has left the room, or the seat
-- or the player is taken since (RVOCC).
create function private.undo_leave(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor undoes a leave' using errcode = '42501';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  if v_session.ended_at is null or v_session.end_reason <> 'left' or not private.is_undoable(v_session.ended_at)
     or exists (select 1 from public.early_departure e where e.session_id = v_session.id)
     or exists (select 1 from public.visit v where v.id = v_session.visit_id and v.closed_at is not null) then
    raise exception 'Only a leave of the last two minutes, not let go early, is undone' using errcode = '22023';
  end if;
  begin
    update public.seat_session set ended_at = null, end_reason = null where id = v_session.id;
  exception when unique_violation then
    raise exception 'Someone sits in that seat, or the player sits elsewhere' using errcode = 'RVOCC';
  end;
end;
$$;

-- Time approved, added or declined in the last two minutes goes back, while it is the seat's latest. Undoing an addition
-- takes the override, as adding did. `p_request_id` is the request's id, or the request id a floor addition was made with
-- (add_seat_call_time returns none).
create function private.undo_call_time(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.call_time_request;
  v_session public.seat_session;
  v_is_addition boolean;
begin
  select * into v_request from public.call_time_request r where r.id = p_request_id or r.idempotency_key = p_request_id
  order by r.id = p_request_id desc limit 1 for update;
  v_is_addition := coalesce(v_request.requested_at = v_request.decided_at, false);
  if v_request.id is null or not private.has_permission(v_request.venue_id, 'waitlist.manage')
     or (v_is_addition and not private.has_permission(v_request.venue_id, 'call_time.override')) then
    raise exception 'Only the floor undoes call time' using errcode = '42501';
  end if;
  perform private.assert_writable(v_request.venue_id, null, v_request.member_id);
  select * into v_session from public.seat_session s where s.id = v_request.session_id for update;
  if v_request.status not in ('approved', 'declined') or not private.is_undoable(v_request.decided_at) or v_session.ended_at is not null
     or (v_request.status = 'approved' and v_request.minutes_before is null)
     or exists (select 1 from public.call_time_request later where later.session_id = v_request.session_id and later.id <> v_request.id
                and later.status = 'approved' and later.decided_at > v_request.decided_at) then
    raise exception 'Only the seat''s latest call time decision, of the last two minutes, is undone' using errcode = '22023';
  end if;
  if v_request.status = 'approved' then
    update public.seat_session set call_time_minutes = v_request.minutes_before, ending_warned_at = null where id = v_session.id;
    perform private.emit(v_request.venue_id, 'call_time.updated',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_request.minutes_before),
                         'call_time.updated:undone:' || v_request.id);
  end if;
  -- A member's request waits again; the floor's own addition was never asked for.
  update public.call_time_request
  set status = case when v_is_addition then 'undone' else 'requested' end,
      decided_at = case when v_is_addition then decided_at end,
      decided_by_staff_id = case when v_is_addition then decided_by_staff_id end,
      minutes_before = null
  where id = v_request.id;
end;
$$;

-- A top-up done or reset in the last two minutes is open again as it was; one started is asked for again.
create function private.undo_top_up(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.top_up_request;
  v_session public.seat_session;
begin
  select * into v_request from public.top_up_request r where r.id = p_request_id for update;
  if v_request.id is null or not private.has_permission(v_request.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor undoes a top-up' using errcode = '42501';
  end if;
  perform private.assert_writable(v_request.venue_id, null, v_request.member_id);
  select * into v_session from public.seat_session s where s.id = v_request.session_id for update;
  if v_session.ended_at is null and v_request.closed_at is not null and v_request.outcome in ('fulfilled', 'reset')
     and private.is_undoable(v_request.closed_at)
     and not exists (select 1 from public.top_up_request o where o.session_id = v_session.id and o.closed_at is null) then
    update public.top_up_request set closed_at = null, outcome = null, closed_by_staff_id = null where id = v_request.id;
    update public.seat_session set top_up_requested_at = v_request.requested_at, top_up_started_at = v_request.started_at
    where id = v_session.id;
  elsif v_session.ended_at is null and v_request.closed_at is null and private.is_undoable(v_request.started_at) then
    update public.top_up_request set started_at = null, started_by_staff_id = null where id = v_request.id;
    update public.seat_session set top_up_started_at = null where id = v_session.id;
  else
    raise exception 'Only a top-up step of the last two minutes, while seated, is undone' using errcode = '22023';
  end if;
end;
$$;

-- A join approved in the last two minutes, and not called since, is a request again; a join declined then is back, unless
-- the member waits on another list now (RVONE).
create function private.undo_waitlist_decision(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id for update;
  if v_entry.id is null or not private.has_permission(v_entry.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor undoes a join decision' using errcode = '42501';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, v_entry.member_id);
  if v_entry.status = 'waiting' and v_entry.approved_by_staff_id is not null and v_entry.called_at is null
     and private.is_undoable(v_entry.approved_at) then
    update public.waitlist_entry set approved_at = null, approved_by_staff_id = null where id = v_entry.id;
  elsif v_entry.status = 'left' and v_entry.left_reason = 'left' and v_entry.approved_at is null and private.is_undoable(v_entry.left_at)
        and exists (select 1 from public.game_table t where t.id = v_entry.table_id and t.active) then
    if exists (select 1 from public.waitlist_entry o where o.member_id = v_entry.member_id and o.status = 'waiting') then
      raise exception 'The member waits on another list now' using errcode = 'RVONE';
    end if;
    update public.waitlist_entry set status = 'waiting', left_at = null, left_reason = null where id = v_entry.id;
  else
    raise exception 'Only a join decided in the last two minutes is undone' using errcode = '22023';
  end if;
end;
$$;

create function public.undo_seat(p_session_id uuid) returns void language sql set search_path = ''
as $$ select private.undo_seat(p_session_id); $$;
create function public.undo_leave(p_session_id uuid) returns void language sql set search_path = ''
as $$ select private.undo_leave(p_session_id); $$;
create function public.undo_call_time(p_request_id uuid) returns void language sql set search_path = ''
as $$ select private.undo_call_time(p_request_id); $$;
create function public.undo_top_up(p_request_id uuid) returns void language sql set search_path = ''
as $$ select private.undo_top_up(p_request_id); $$;
create function public.undo_waitlist_decision(p_entry_id uuid) returns void language sql set search_path = ''
as $$ select private.undo_waitlist_decision(p_entry_id); $$;

revoke execute on function private.is_undoable(timestamptz) from public, anon, authenticated;
revoke execute on function private.undo_seat(uuid), private.undo_leave(uuid), private.undo_call_time(uuid), private.undo_top_up(uuid),
  private.undo_waitlist_decision(uuid) from public, anon;
grant execute on function private.undo_seat(uuid), private.undo_leave(uuid), private.undo_call_time(uuid), private.undo_top_up(uuid),
  private.undo_waitlist_decision(uuid) to authenticated;
revoke execute on function public.undo_seat(uuid), public.undo_leave(uuid), public.undo_call_time(uuid), public.undo_top_up(uuid),
  public.undo_waitlist_decision(uuid) from public, anon;
grant execute on function public.undo_seat(uuid), public.undo_leave(uuid), public.undo_call_time(uuid), public.undo_top_up(uuid),
  public.undo_waitlist_decision(uuid) to authenticated;

-- A column without a default on a table the practice reset reloads (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
