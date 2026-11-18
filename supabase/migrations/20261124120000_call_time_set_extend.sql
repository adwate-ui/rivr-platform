-- Call time set, extended and owed (#1076, the owner, 18 Nov). Generated from the live definitions by gen1076.py.
-- - One rule for the member's Set call time and Extend call time and the floor's Add call time
--   (private.call_time_choice_end, the twin of @rivr/domain callTimeChoiceEnd; packages/testing/golden/callTimeChoice.json):
--   until set, a length counts from now and is open only if it ends after the call time the seat started with; once set,
--   it extends it. The floor's Add call time counts as setting it.
-- - A seat with call time owes until a call time has been set and has run out (private.owes_call_time): the floor's leave
--   lets them go before call time, the member's own leave puts them on the Leaving list owing, and the door asks for it.
-- - The member asking the floor for more time goes (request_call_time, decide_call_time_request, the Requests list's
--   time asks and the queue count): any still waiting are declined. The floor is told when a member sets or extends
--   (staff_queue_counts' callTimeSet, which the console chimes on, and floor_seats' call_time_set_by_member).
-- - Promotions keep counting time played as before: the call time's completion stamps are untouched; the member is told
--   their call time is done only once one set has run out (the event still goes, with is_set, for the lock screen); a
--   visit let go before call time is not call time met. The dealer's tablet reads whether each seat owes it.
-- - Seats in play at release keep what they had: time the floor added, or a call time already run out, counts as set; a
--   seat already left, in a visit still open, keeps the old rule. The floor never undoes a member's own set. Release
--   outside club hours: consoles and apps open across it read the dropped time-ask columns until reloaded.

-- A member let go with no call time set owes nothing by the clock: a shortfall of nought is kept.
alter table public.early_departure drop constraint early_departure_shortfall_seconds_check;
alter table public.early_departure add constraint early_departure_shortfall_seconds_check check (shortfall_seconds >= 0);

-- The seat's call time once a length is chosen (null when refused): the twin of @rivr/domain callTimeChoiceEnd.
create function private.call_time_choice_end(p_current integer, p_played integer, p_initial integer, p_is_set boolean, p_length integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_set then private.extended_call_time(p_current, p_played, p_length)
    when p_length between 1 and 1440 and p_current > 0
         and greatest(coalesce(p_played, 0), 0) + p_length <= 1440
         and greatest(coalesce(p_played, 0), 0) + p_length > coalesce(p_initial, p_current)
         and greatest(coalesce(p_played, 0), 0) + p_length >= p_current
    then greatest(coalesce(p_played, 0), 0) + p_length end;
$$;

-- The call time a seat started with, before any was set or added: the value its first change replaced. Each change only
-- adds, so that is the least any change replaced, whatever two made in one moment.
create function private.initial_call_time(p_session public.seat_session)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce((select min(r.minutes_before) from public.call_time_request r where r.session_id = p_session.id),
                  p_session.call_time_minutes);
$$;

-- Whether a seat owes its call time: it has one, and either none has been set or the one set has not run out.
create function private.owes_call_time(p_session public.seat_session, p_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_session.call_time_minutes > 0
         and (p_session.call_time_set_at is null or coalesce(private.session_call_time(p_session, p_at), 0) > 0);
$$;

-- The lengths the club offers that the one rule opens now, for a seat still taken.
create function private.call_time_choices_open(p_session public.seat_session)
returns integer[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(c.minutes order by c.minutes), '{}'::integer[])
  from unnest(private.add_time_choices(p_session.venue_id)) as c(minutes)
  where p_session.ended_at is null
    and private.call_time_choice_end(p_session.call_time_minutes, private.minutes_played(p_session, now()), private.initial_call_time(p_session),
                                     p_session.call_time_set_at is not null, c.minutes) is not null;
$$;

revoke all on function private.call_time_choice_end(integer, integer, integer, boolean, integer), private.initial_call_time(public.seat_session),
  private.owes_call_time(public.seat_session, timestamptz), private.call_time_choices_open(public.seat_session) from public, anon, authenticated;

-- The call time a member's last seat of this visit leaves: its seconds left, and whether it is owed.
drop function private.call_time_owed(uuid, timestamptz);
create function private.call_time_owed(p_member_id uuid, p_at timestamptz)
returns table (o_session_id uuid, o_seconds integer, o_owes boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, coalesce(private.session_call_time(s, p_at), 0), private.owes_call_time(s, p_at) from public.seat_session s
  where s.member_id = p_member_id and s.visit_id = private.current_visit(p_member_id)
  order by s.ended_at is null desc, s.ended_at desc limit 1;
$$;
revoke all on function private.call_time_owed(uuid, timestamptz) from public, anon, authenticated;

-- Seats already in play when this release lands keep what they had: one the floor added time to counts as set, as the
-- floor's Add call time now does, and so does one whose call time had already run out (met); one already left, in a
-- visit still open, keeps the old rule, met at nought.
update public.seat_session s
set call_time_set_at = coalesce((select min(r.decided_at) from public.call_time_request r where r.session_id = s.id and r.status = 'approved'),
                                s.call_time_completed_at)
where s.ended_at is null and s.call_time_set_at is null
  and (s.call_time_completed_at is not null
       or exists (select 1 from public.call_time_request r where r.session_id = s.id and r.status = 'approved'));
update public.seat_session s
set call_time_set_at = s.ended_at
where s.ended_at is not null and s.call_time_set_at is null and s.call_time_minutes > 0
  and exists (select 1 from public.visit v where v.id = s.visit_id and v.closed_at is null);

-- A seat's changes, read by seat on every floor poll (the floor's latest change, the call time it started with).
create index call_time_request_session_idx on public.call_time_request (session_id, decided_at desc);
comment on column public.seat_session.call_time_set_at is
  'When a call time was first set, by the member from the seat or the floor''s Add call time (#1059, #1076). Until it is, call time is owed even once the countdown reaches nought.';

-- Everything that asks whether call time is owed asks it the one way.
CREATE OR REPLACE FUNCTION private.let_leave_early(p_venue_id uuid, p_member_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owed record;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'call_time.override') then
    raise exception 'Only an admin lets a player leave before call time' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if private.is_own_cage_record(p_member_id) then
    raise exception 'Staff never let themselves leave before call time' using errcode = 'RVOWN';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Say why, in 3 to 500 characters' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if not coalesce(v_owed.o_owes, false) then
    raise exception 'No call time owed: nothing to let go early' using errcode = 'RVCTD';
  end if;
  insert into public.early_departure (venue_id, member_id, visit_id, session_id, shortfall_seconds, reason, overridden_by_staff_id)
  values (p_venue_id, p_member_id, private.current_visit(p_member_id), v_owed.o_session_id, v_owed.o_seconds, btrim(p_reason),
          private.current_staff_id(p_venue_id))
  on conflict (session_id) do nothing
  returning id into v_id;
  return coalesce(v_id, (select e.id from public.early_departure e where e.session_id = v_owed.o_session_id));
end;
$function$;

CREATE OR REPLACE FUNCTION private.left_owing_call_time(p_venue_id uuid)
 RETURNS TABLE(member_id uuid, full_name text, table_name text, owed_seconds integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.id, m.full_name, g.name, o.o_seconds
  from public.visit v
  join public.member m on m.id = v.member_id
  cross join lateral private.call_time_owed(v.member_id, now()) o
  join public.seat_session s on s.id = o.o_session_id
  join public.game_table g on g.id = s.table_id
  where v.venue_id = p_venue_id and v.closed_at is null and s.ended_at is not null and o.o_owes
    and not exists (select 1 from public.early_departure e where e.session_id = o.o_session_id)
    and private.has_permission(p_venue_id, 'call_time.override')
  order by m.full_name;
$function$;

CREATE OR REPLACE FUNCTION private.leave_by_door(p_venue_id uuid, p_member_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owed record;
begin
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  -- One at a time per member, with the cage's cash-out (which takes the same lock).
  perform 1 from public.member m where m.id = p_member_id for update;
  -- A close is a write (decision 0161), refused while the venue or the member is frozen.
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if private.current_visit(p_member_id) is null then
    raise exception 'Not checked in: there is no visit to close' using errcode = 'RVOUT';
  end if;
  if exists (select 1 from public.seat_session s where s.member_id = p_member_id and s.ended_at is null) then
    raise exception 'Still seated: the floor ends the seat first' using errcode = 'RVSTD';
  end if;
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_owes, false) and not exists (select 1 from public.early_departure e where e.session_id = v_owed.o_session_id) then
    raise exception 'Call time not complete: % seconds owed', v_owed.o_seconds
      using errcode = 'RVCTS', detail = v_owed.o_seconds::text;
  end if;
  return private.close_visit(p_member_id, now(), 'door');
end;
$function$;

CREATE OR REPLACE FUNCTION private.leave_my_seat()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session := private.my_open_seat();
begin
  if not private.has_feature(v_session.member_id, 'table.leave') then
    raise exception 'Leaving from the app is not open to you' using errcode = '42501';
  end if;
  -- Owing until a call time is set and has run out (#1076): the Leaving list, owing; else the seat ends, call time met.
  if private.owes_call_time(v_session, now()) then
    update public.seat_session set leaving_at = coalesce(leaving_at, now()) where id = v_session.id;
    return 'leaving';
  end if;
  update public.seat_session
  set ended_at = private.seat_end_stamp(v_session.seated_here_at, now()), end_reason = 'left', away_since = null,
      leave_reason = 'call_time_met'
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', 'left'), 'seat.left:' || v_session.id);
  return 'left';
end;
$function$;

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

-- The member's Set and Extend, and the floor's Add call time, by the one rule; both count as setting it.
CREATE OR REPLACE FUNCTION private.set_my_call_time(p_minutes integer, p_idempotency_key uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session := private.my_open_seat();
  v_done public.call_time_request;
  v_minutes integer;
  v_id uuid;
begin
  if not private.has_feature(v_session.member_id, 'call_time.view') then
    raise exception 'Call time is not open to you' using errcode = '42501';
  end if;
  select * into v_done from public.call_time_request r
  where r.venue_id = v_session.venue_id and r.idempotency_key = p_idempotency_key and r.member_id = v_session.member_id;
  if v_done.id is not null then
    -- Only this member's own set, for this seat and length, is a repeat; a request the floor decides is not.
    if v_done.session_id <> v_session.id or v_done.minutes <> p_minutes or v_done.status <> 'approved' or v_done.decided_by_staff_id is not null then
      raise exception 'That request id was for another call time' using errcode = '22023';
    end if;
    return v_session.call_time_minutes;
  end if;
  if p_idempotency_key is null then
    raise exception 'A call time is set with a request id' using errcode = '22023';
  end if;
  if not (p_minutes = any (private.add_time_choices(v_session.venue_id))) then
    raise exception 'A call time is a length the club offers' using errcode = 'RVCTC';
  end if;
  if v_session.call_time_minutes <= 0 then
    raise exception 'Only a seat with a call time sets one' using errcode = 'RVCTN';
  end if;
  -- One rule for the member's Set and Extend and the floor's Add call time (#1076): until set, a length counts from now
  -- and ends after the call time the seat started with; once set, it extends it.
  v_minutes := private.call_time_choice_end(v_session.call_time_minutes, private.minutes_played(v_session, now()),
                                            private.initial_call_time(v_session), v_session.call_time_set_at is not null, p_minutes);
  if v_minutes is null and p_minutes + (case when v_session.call_time_set_at is null then greatest(private.minutes_played(v_session, now()), 0)
                                             else greatest(v_session.call_time_minutes, private.minutes_played(v_session, now())) end) > 1440 then
    raise exception 'A call time is at most a day' using errcode = 'RVCTX';
  end if;
  if v_minutes is null then
    raise exception 'A call time you set ends after the one the seat started with' using errcode = 'RVCTE';
  end if;
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, status, idempotency_key, decided_at, minutes_before)
  values (v_session.venue_id, v_session.member_id, v_session.id, p_minutes, 'approved', p_idempotency_key, now(), v_session.call_time_minutes)
  returning id into v_id;
  update public.seat_session
  set call_time_minutes = v_minutes, call_time_set_at = coalesce(call_time_set_at, now()), ending_warned_at = null,
      call_time_first_met_at = coalesce(call_time_first_met_at, call_time_completed_at), call_time_completed_at = null
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'call_time.updated',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_minutes),
                       'call_time.updated:' || v_id);
  return v_minutes;
end;
$function$;

CREATE OR REPLACE FUNCTION private.add_seat_call_time(p_session_id uuid, p_minutes integer, p_idempotency_key uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- The member's rule (#1076): until set, a length counts from now and ends after the call time the seat started with;
  -- once set, it extends it. The floor's Add call time counts as setting it.
  v_minutes := private.call_time_choice_end(v_session.call_time_minutes, private.minutes_played(v_session, now()),
                                            private.initial_call_time(v_session), v_session.call_time_set_at is not null, p_minutes);
  if v_minutes is null then
    raise exception 'Call time ends after the one the seat started with, up to a day' using errcode = '22023';
  end if;
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, status, idempotency_key, decided_at, decided_by_staff_id, minutes_before)
  values (v_session.venue_id, v_session.member_id, v_session.id, p_minutes, 'approved', p_idempotency_key, now(),
          private.current_staff_id(v_session.venue_id), v_session.call_time_minutes)
  returning id into v_id;
  update public.seat_session
  set call_time_minutes = v_minutes, call_time_set_at = coalesce(call_time_set_at, now()), ending_warned_at = null,
      call_time_first_met_at = coalesce(call_time_first_met_at, call_time_completed_at), call_time_completed_at = null
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'call_time.updated',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_minutes),
                       'call_time.updated:' || v_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.undo_call_time(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request public.call_time_request;
  v_session public.seat_session;
  v_is_addition boolean;
begin
  select * into v_request from public.call_time_request r where r.id = p_request_id for update;
  if v_request.id is null then
    -- A floor addition, by the request id it was made with, at a venue where the caller adds call time.
    select * into v_request from public.call_time_request r
    where r.idempotency_key = p_request_id and r.requested_at = r.decided_at and r.decided_by_staff_id is not null
      and private.has_permission(r.venue_id, 'call_time.override')
    limit 1 for update;
  end if;
  v_is_addition := coalesce(v_request.requested_at = v_request.decided_at, false);
  if v_request.id is null or not private.has_permission(v_request.venue_id, 'waitlist.manage')
     or (v_is_addition and not private.has_permission(v_request.venue_id, 'call_time.override')) then
    raise exception 'Only the floor undoes call time' using errcode = '42501';
  end if;
  -- A member's own set is theirs (#1076): the floor does not take it back; nor does staff undo on their own record.
  if v_request.decided_by_staff_id is null then
    raise exception 'A member''s own call time is theirs to set' using errcode = '22023';
  end if;
  if private.is_own_cage_record(v_request.member_id) then
    raise exception 'Staff never undo call time on their own record' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(v_request.venue_id, null, v_request.member_id);
  select * into v_session from public.seat_session s where s.id = v_request.session_id for update;
  if v_request.status <> 'approved' or not private.is_undoable(v_request.decided_at) or v_session.ended_at is not null
     or (v_request.status = 'approved' and v_request.minutes_before is null)
     or exists (select 1 from public.call_time_request later where later.session_id = v_request.session_id and later.id <> v_request.id
                and later.status = 'approved' and later.decided_at > v_request.decided_at) then
    raise exception 'Only the seat''s latest call time decision, of the last two minutes, is undone' using errcode = '22023';
  end if;
  if v_request.status = 'approved' then
    -- Undoing the one that set the call time leaves it unset again (#1076).
    update public.seat_session
    set call_time_minutes = v_request.minutes_before, ending_warned_at = null,
        call_time_set_at = case when exists (select 1 from public.call_time_request o where o.session_id = v_session.id and o.id <> v_request.id
                                             and o.status = 'approved') then call_time_set_at end
    where id = v_session.id;
    perform private.emit(v_request.venue_id, 'call_time.updated',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_request.minutes_before),
                         'call_time.updated:undone:' || v_request.id);
  end if;
  -- Undone, never asked for again: members no longer ask the floor (#1076).
  update public.call_time_request set status = 'undone', minutes_before = null where id = v_request.id;
end;
$function$;

-- The seat as the member's app and the floor read it.
drop function public.my_seat();
drop function private.my_seat();
CREATE OR REPLACE FUNCTION private.my_seat()
 RETURNS TABLE(table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer, is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamp with time zone, call_time_ends_at timestamp with time zone, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, add_time_choices integer[], game text, straddle_paise bigint, call_time_set_at timestamp with time zone, call_time_choices_open integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.name, s.seat, s.away_since is not null, s.call_time_minutes > 0,
         case when f.sees_call_time then private.session_call_time(s, now()) end,
         floor(extract(epoch from now() - s.started_at))::integer, s.leaving_at is not null, private.top_up_state(s),
         case when f.sees_call_time then s.call_time_minutes end, s.started_at,
         case when f.sees_call_time and s.call_time_minutes > 0 and s.away_since is null
              then now() + make_interval(secs => private.session_call_time(s, now())) end,
         t.name, t.small_blind_paise, t.big_blind_paise,
         private.add_time_choices(s.venue_id), t.game, t.straddle_paise,
         case when f.sees_call_time then s.call_time_set_at end,
         -- The lengths open now by the one rule (#1076): until set, those ending after the call time the seat started with.
         case when f.sees_call_time then private.call_time_choices_open(s) else '{}'::integer[] end
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type t on t.id = g.table_type_id
  cross join lateral (select private.has_feature(s.member_id, 'call_time.view') as sees_call_time) f
  where s.member_id = private.current_member_id() and s.ended_at is null;
$function$;

CREATE OR REPLACE FUNCTION public.my_seat()
 RETURNS TABLE(table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer, is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamp with time zone, call_time_ends_at timestamp with time zone, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, add_time_choices integer[], game text, straddle_paise bigint, call_time_set_at timestamp with time zone, call_time_choices_open integer[])
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.my_seat(); $function$;

revoke all on function private.my_seat() from public, anon;
grant execute on function private.my_seat() to authenticated;
revoke all on function public.my_seat() from public, anon;
grant execute on function public.my_seat() to authenticated;

drop function public.floor_seats(uuid);
drop function private.floor_seats(uuid);
CREATE OR REPLACE FUNCTION private.floor_seats(p_venue_id uuid)
 RETURNS TABLE(session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text, started_at timestamp with time zone, must_move_order integer, away_since timestamp with time zone, call_time_left integer, leaving_at timestamp with time zone, top_up text, call_time_set_at timestamp with time zone, call_time_ends_at timestamp with time zone, owes_call_time boolean, call_time_choices_open integer[], call_time_set_by_member boolean, call_time_change_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end,
         s.away_since, private.session_call_time(s, now()), s.leaving_at, private.top_up_state(s),
         -- Call time on the floor (#1076): when it was set, when they leave once it is (none while away), whether they owe
         -- it, the lengths Add call time may give now, and whether the member set it last, which the floor is told of.
         s.call_time_set_at,
         case when s.call_time_set_at is not null and s.call_time_minutes > 0 and s.away_since is null
              then now() + make_interval(secs => private.session_call_time(s, now())) end,
         private.owes_call_time(s, now()), private.call_time_choices_open(s),
         latest.by_member, latest.id
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.member m on m.id = s.member_id
  join public.tier tr on tr.id = m.tier_id
  -- The seat's latest call time change: who made it, and its id, so the floor is told of each once.
  left join lateral (select r.id, r.decided_by_staff_id is null as by_member from public.call_time_request r
                     where r.session_id = s.id and r.status = 'approved' order by r.decided_at desc, r.id desc limit 1) latest on true
  where s.venue_id = p_venue_id and s.ended_at is null and private.has_permission(p_venue_id, 'members.read')
  order by g.position, s.seat;
$function$;

CREATE OR REPLACE FUNCTION public.floor_seats(p_venue_id uuid)
 RETURNS TABLE(session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text, started_at timestamp with time zone, must_move_order integer, away_since timestamp with time zone, call_time_left integer, leaving_at timestamp with time zone, top_up text, call_time_set_at timestamp with time zone, call_time_ends_at timestamp with time zone, owes_call_time boolean, call_time_choices_open integer[], call_time_set_by_member boolean, call_time_change_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.floor_seats(p_venue_id); $function$;

revoke all on function private.floor_seats(uuid) from public, anon;
grant execute on function private.floor_seats(uuid) to authenticated;
revoke all on function public.floor_seats(uuid) from public, anon;
grant execute on function public.floor_seats(uuid) to authenticated;

-- The floor's chime when a member sets or extends their call time, in place of the time asks that go.
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
    ('callTimeSet', (select count(*) from public.call_time_request r where r.venue_id = p_venue_id and r.status = 'approved'
                     and r.decided_by_staff_id is null and r.decided_at > now() - interval '1 minute'
                     and private.has_permission(p_venue_id, 'members.read'))),
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

-- The minute's sweep: the member told their call time is done only once one set has run out.
CREATE OR REPLACE FUNCTION private.sweep_seated_time()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_ending record;
begin
  for v_session in
    select * from public.seat_session s
    where s.ended_at is null and s.call_time_completed_at is null and s.call_time_minutes > 0 and private.session_call_time(s, now()) = 0
    for update skip locked
  loop
    update public.seat_session set call_time_completed_at = now() where id = v_session.id;
    -- Promotions count the time as before, and the event goes either way, so the lock screen's countdown stops; is_set says
    -- whether the member is told it is done: only once a call time set has run out (#1076), as one never set is still owed.
    perform private.emit(v_session.venue_id, 'call_time.completed',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                            'seat', v_session.seat, 'is_set', v_session.call_time_set_at is not null),
                         'call_time.completed:' || v_session.id || ':' || v_session.call_time_minutes);
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
end;
$function$;
CREATE OR REPLACE FUNCTION private.seat_session_ended_call_time()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.ended_at is null and new.ended_at is not null and new.call_time_minutes > 0 and new.call_time_completed_at is null
     and private.call_time_left(new.call_time_minutes, new.started_at, new.away_seconds, new.away_since, new.ended_at, new.ended_at) = 0 then
    new.call_time_completed_at := new.ended_at;
    -- The member is told only once a call time set has run out (#1076): one never set is still owed.
    if new.call_time_set_at is not null then
      perform private.emit(new.venue_id, 'call_time.completed',
                           jsonb_build_object('session_id', new.id, 'member_id', new.member_id, 'table_id', new.table_id, 'seat', new.seat),
                           'call_time.completed:' || new.id || ':' || new.call_time_minutes);
    end if;
  end if;
  return new;
end;
$function$;

-- A member's visits: let go before call time is not call time met.
CREATE OR REPLACE FUNCTION private.member_visits(p_venue_id uuid, p_member_id uuid, p_limit integer)
 RETURNS TABLE(visit_id uuid, opened_at timestamp with time zone, closed_at timestamp with time zone, tables text, minutes_played integer, call_time_met boolean, left_early boolean, leave_reasons text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select v.id, v.opened_at, v.closed_at,
         -- A floor move overwrites the seat's table, so the tables it left are in seat_move.
         (select string_agg(t.name, ', ' order by t.name)
          from (select g.name from public.seat_session s join public.game_table g on g.id = s.table_id where s.visit_id = v.id
                union
                select g.name from public.seat_move mv
                join public.seat_session s on s.id = mv.session_id
                join public.game_table g on g.id = mv.from_table_id
                where s.visit_id = v.id) t),
         coalesce((select sum(private.minutes_played(s, now()))::integer from public.seat_session s where s.visit_id = v.id), 0),
         -- Null when no seat of the visit owed any call time, or while the seats that owe it are still running.
         (select bool_and(s.call_time_completed_at is not null) filter (where s.ended_at is not null or s.call_time_completed_at is not null)
          from public.seat_session s where s.visit_id = v.id and s.call_time_minutes > 0)
           -- Let go before call time is not call time met, though the time was counted for promotions (#1076).
           and not exists (select 1 from public.early_departure e
                           where e.visit_id = v.id and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id)),
         -- A departure withdrawn as a mistake (decision 0500) does not count.
         exists (select 1 from public.early_departure e
                 where e.visit_id = v.id and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id)),
         -- Why they left each table of the visit, in order, those with a reason (#1060).
         array(select s.leave_reason from public.seat_session s where s.visit_id = v.id and s.leave_reason is not null
               order by s.ended_at, s.id)
  from public.visit v
  where v.member_id = p_member_id and v.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
  order by v.opened_at desc, v.id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$function$;

-- The dealer's tablet: whether each seat owes call time.
drop function public.tablet_seats();
drop function private.tablet_seats();
CREATE OR REPLACE FUNCTION private.tablet_seats()
 RETURNS TABLE(seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamp with time zone, minimum_paise bigint, call_time_left integer, leaving_at timestamp with time zone, small_blind_paise bigint, big_blind_paise bigint, straddle_paise bigint, owes_call_time boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select n.seat, s.id, m.id, m.full_name, s.away_since, g.min_buy_in_paise,
         case when s.id is not null then private.session_call_time(s, now()) end,
         s.leaving_at, tt.small_blind_paise, tt.big_blind_paise, tt.straddle_paise,
         case when s.id is not null then private.owes_call_time(s, now()) end
  from private.my_tablet_table() t
  join public.game_table g on g.id = t.o_table_id
  join public.table_type tt on tt.id = g.table_type_id
  cross join generate_series(1, g.seats) as n (seat)
  left join public.seat_session s on s.table_id = g.id and s.seat = n.seat and s.ended_at is null
  left join public.member m on m.id = s.member_id
  order by n.seat;
$function$;

CREATE OR REPLACE FUNCTION public.tablet_seats()
 RETURNS TABLE(seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamp with time zone, minimum_paise bigint, call_time_left integer, leaving_at timestamp with time zone, small_blind_paise bigint, big_blind_paise bigint, straddle_paise bigint, owes_call_time boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.tablet_seats(); $function$;

revoke all on function private.tablet_seats() from public, anon;
grant execute on function private.tablet_seats() to authenticated;
revoke all on function public.tablet_seats() from public, anon;
grant execute on function public.tablet_seats() to authenticated;

-- The member asking the floor for more time goes: any still waiting are declined, and the path is dropped.
update public.call_time_request set status = 'declined', decided_at = greatest(now(), requested_at) where status = 'requested';
drop trigger seat_session_close_call_time_requests on public.seat_session;
drop function private.close_call_time_requests();
drop function public.request_call_time(integer, uuid);
drop function private.request_call_time(integer, uuid);
drop function public.decide_call_time_request(uuid, boolean);
drop function private.decide_call_time_request(uuid, boolean);
drop function private.set_call_time(integer, integer, integer);
