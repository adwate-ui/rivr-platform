-- Set and Extend call time from lists of their own (#1089, the owner, 19 Nov). Until a seat's call time is set, it offers and
-- takes the Set list (call_time.add_choices, "Set call time choices"); once set, the Extend list (call_time.extend_choices,
-- "Extend call time choices"), which adds beyond the current end. Both on the member's own Set or Extend (set_my_call_time,
-- my_seat) and on the floor's (add_seat_call_time, floor_seats, which now carries the lengths). One rule picks the list:
-- private.seat_time_choices. The Extend list starts as a copy of each venue's Set list, row for row.

insert into public.setting_key (key, description, scope, value_schema) values
  ('call_time.add_choices',
   'Set call time choices: the lengths a call time is set by, in minutes, before one is set, by the member or the floor. None set is 30 minutes, 1 hour and 2 hours.',
   'venue',
   '{"type":"object","properties":{"minutes":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"integer","minimum":1,"maximum":1440}}},"required":["minutes"],"additionalProperties":false}')
on conflict (key) do update set description = excluded.description, value_schema = excluded.value_schema;
insert into public.setting_key (key, description, scope, value_schema) values
  ('call_time.extend_choices',
   'Extend call time choices: the lengths a call time once set is extended by, beyond its current end, in minutes. None set is 30 minutes, 1 hour and 2 hours.',
   'venue',
   '{"type":"object","properties":{"minutes":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"integer","minimum":1,"maximum":1440}}},"required":["minutes"],"additionalProperties":false}')
on conflict (key) do update set description = excluded.description, value_schema = excluded.value_schema;

-- The Extend list: as the Set list is read (each a number, then whole), shortest first.
CREATE OR REPLACE FUNCTION private.extend_time_choices(p_venue_id uuid)
 RETURNS integer[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (select array_agg(distinct m::numeric::integer order by m::numeric::integer)
     from jsonb_array_elements_text(private.setting_at(p_venue_id, 'call_time.extend_choices', '', now()) -> 'minutes') m),
    array[30, 60, 120]);
$function$;
revoke all on function private.extend_time_choices(uuid) from public, anon, authenticated;

-- The lengths a seat offers and takes by its state: the Set list until a call time is set, then the Extend list.
create function private.seat_time_choices(p_session public.seat_session)
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_session.call_time_set_at is null then private.add_time_choices(p_session.venue_id)
              else private.extend_time_choices(p_session.venue_id) end;
$$;
revoke all on function private.seat_time_choices(public.seat_session) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.call_time_choices_open(p_session seat_session)
 RETURNS integer[]
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(c.minutes order by c.minutes), '{}'::integer[])
  from unnest(private.seat_time_choices(p_session)) as c(minutes)
  where p_session.ended_at is null
    and private.call_time_choice_end(p_session.call_time_minutes, private.minutes_played(p_session, now()), private.initial_call_time(p_session),
                                     p_session.call_time_set_at is not null, c.minutes) is not null;
$function$;

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
  if not (p_minutes = any (private.seat_time_choices(v_session))) then
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
  if p_idempotency_key is null or v_session.ended_at is not null or not (p_minutes = any (private.seat_time_choices(v_session))) then
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
         case when f.sees_call_time then private.seat_time_choices(s) else '{}'::integer[] end, t.game, t.straddle_paise,
         case when f.sees_call_time then s.call_time_set_at end,
         -- The lengths open now by the one rule (#1076): until set, those ending after the call time the seat started with.
         case when f.sees_call_time then private.call_time_choices_open(s) else '{}'::integer[] end
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type t on t.id = g.table_type_id
  cross join lateral (select private.has_feature(s.member_id, 'call_time.view') as sees_call_time) f
  where s.member_id = private.current_member_id() and s.ended_at is null;
$function$;

-- The floor's seats carry the lengths by state, so the console offers Set or Extend as the app does.
drop function public.floor_seats(uuid);
drop function private.floor_seats(uuid);
CREATE FUNCTION private.floor_seats(p_venue_id uuid)
 RETURNS TABLE(session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text, started_at timestamp with time zone, must_move_order integer, away_since timestamp with time zone, call_time_left integer, leaving_at timestamp with time zone, top_up text, call_time_set_at timestamp with time zone, call_time_ends_at timestamp with time zone, owes_call_time boolean, call_time_choices_open integer[], call_time_set_by_member boolean, call_time_change_id uuid, add_time_choices integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end,
         s.away_since, private.session_call_time(s, now()), s.leaving_at, private.top_up_state(s),
         -- Call time on the floor (#1076): when it was set, when they leave once it is (none while away), whether they owe
         -- it, the lengths open now, and whether the member set it last, which the floor is told of.
         s.call_time_set_at,
         case when s.call_time_set_at is not null and s.call_time_minutes > 0 and s.away_since is null
              then now() + make_interval(secs => private.session_call_time(s, now())) end,
         private.owes_call_time(s, now()), private.call_time_choices_open(s),
         latest.by_member, latest.id,
         -- The lengths the seat offers by its state (#1089): the Set list until one is set, then the Extend list.
         private.seat_time_choices(s)
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
revoke all on function private.floor_seats(uuid) from public, anon;
grant execute on function private.floor_seats(uuid) to authenticated;
CREATE FUNCTION public.floor_seats(p_venue_id uuid)
 RETURNS TABLE(session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text, started_at timestamp with time zone, must_move_order integer, away_since timestamp with time zone, call_time_left integer, leaving_at timestamp with time zone, top_up text, call_time_set_at timestamp with time zone, call_time_ends_at timestamp with time zone, owes_call_time boolean, call_time_choices_open integer[], call_time_set_by_member boolean, call_time_change_id uuid, add_time_choices integer[])
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.floor_seats(p_venue_id); $function$;
revoke all on function public.floor_seats(uuid) from public, anon;
grant execute on function public.floor_seats(uuid) to authenticated;

-- The Extend list starts as each venue's Set list: every row copied (past, in force and to come), its minutes as numbers,
-- each once and shortest first, as the Set list reads them; by no one, as no one set it (the reason says it was copied).
insert into public.setting (venue_id, key, subject, value, effective_from, reason, created_by_staff_id)
select s.venue_id, 'call_time.extend_choices', s.subject,
       jsonb_build_object('minutes', (select jsonb_agg(distinct m::numeric::integer order by m::numeric::integer)
                                      from jsonb_array_elements_text(s.value -> 'minutes') m)),
       s.effective_from, 'Copied from Set call time choices as the lists were split (#1089)', null
from public.setting s
where s.key = 'call_time.add_choices';
