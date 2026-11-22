-- Call time is set and extended to a time on the clock (the owner, 22 Nov), by the member from the seat and by the floor,
-- in place of the lengths of call_time.add_choices and call_time.extend_choices, which go. Until a call time is set, the
-- time picked must fall after the minimum playing time the seat started with; once set, after the current end. One rule:
-- private.call_time_until, with the bound the app and the floor show (private.call_time_opens_after), each proved equal
-- to @rivr/domain on packages/testing/golden/callTimeUntil.json (pgTAP 024).

-- The time picked, so a retry with the same request id is told apart from another time. Null on requests made by length.
alter table public.call_time_request add column until_at timestamptz;
comment on column public.call_time_request.until_at is 'The time a call time was set or extended to (the owner, 22 Nov); null on one made by a length before then.';
-- A member's export carries it, as the rest of their call time requests.
insert into private.member_export_column (table_name, column_name, kind) values ('call_time_request', 'until_at', 'owed');

-- Whole seconds played, net of time away, as private.minutes_played counts minutes.
create function private.seconds_played(p_session public.seat_session, p_at timestamptz)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(0, floor(extract(epoch from (e.end_at - p_session.started_at)) - p_session.away_seconds
                           - coalesce(greatest(0, extract(epoch from (e.end_at - p_session.away_since))), 0)))::integer
  from (select case when p_session.ended_at is not null and p_session.ended_at < p_at then p_session.ended_at else p_at end as end_at) e;
$$;

-- The seat's call time once a time `p_seconds_ahead` from now is picked: the seconds played and ahead in minutes rounded up;
-- until set, more than the minimum and no less than the call time owed; once set, more than the call time now; a day at
-- most; only a seat with a call time and a time ahead. Null when refused. @rivr/domain callTimeUntil.
create function private.call_time_until(p_current integer, p_played_seconds integer, p_initial integer, p_is_set boolean, p_seconds_ahead numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_current > 0 and p_seconds_ahead > 0 and t.total <= 1440
               and case when p_is_set then t.total > p_current else t.total > coalesce(p_initial, p_current) and t.total >= p_current end
              then t.total end
  from (select ceil((greatest(coalesce(p_played_seconds, 0), 0) + p_seconds_ahead) / 60.0)::integer as total) t;
$$;

-- The seconds from now after which a picked time is open: the end of the minimum until set, the current end once set,
-- nought once passed; null for a seat with no call time. @rivr/domain callTimeOpensAfter.
create function private.call_time_opens_after(p_current integer, p_played_seconds integer, p_initial integer, p_is_set boolean)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_current > 0 then greatest(0,
    case when p_is_set then p_current * 60 else greatest(coalesce(p_initial, p_current) * 60, (p_current - 1) * 60) end
    - greatest(coalesce(p_played_seconds, 0), 0)) end;
$$;

-- When a picked time opens for a seat, as the app and the floor show it: null for an ended seat or one with no call time.
create function private.call_time_after_at(p_session public.seat_session)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when p_session.ended_at is null
              then now() + make_interval(secs => private.call_time_opens_after(p_session.call_time_minutes, private.seconds_played(p_session, now()),
                                                                               private.initial_call_time(p_session), p_session.call_time_set_at is not null)) end;
$$;
revoke all on function private.seconds_played(public.seat_session, timestamptz), private.call_time_until(integer, integer, integer, boolean, numeric),
  private.call_time_opens_after(integer, integer, integer, boolean), private.call_time_after_at(public.seat_session) from public, anon, authenticated;

-- The member's own Set or Extend, to a time. Refusals: 42501 call time not open to them, 22023 no request id or time, or the
-- id was for another call time; RVCTN a seat with no call time; RVCTX past a day; RVCTE not after the minimum (until set)
-- or the current end (once set).
drop function public.set_my_call_time(integer, uuid);
drop function private.set_my_call_time(integer, uuid);
create function private.set_my_call_time(p_until timestamptz, p_idempotency_key uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
  v_done public.call_time_request;
  v_ahead numeric := extract(epoch from (p_until - now()));
  v_played integer;
  v_minutes integer;
  v_id uuid;
begin
  if not private.has_feature(v_session.member_id, 'call_time.view') then
    raise exception 'Call time is not open to you' using errcode = '42501';
  end if;
  select * into v_done from public.call_time_request r
  where r.venue_id = v_session.venue_id and r.idempotency_key = p_idempotency_key and r.member_id = v_session.member_id;
  if v_done.id is not null then
    -- Only this member's own set, for this seat and time, is a repeat; a request the floor decides is not.
    if v_done.session_id <> v_session.id or v_done.until_at is distinct from p_until or v_done.status <> 'approved' or v_done.decided_by_staff_id is not null then
      raise exception 'That request id was for another call time' using errcode = '22023';
    end if;
    return v_session.call_time_minutes;
  end if;
  if p_idempotency_key is null or p_until is null then
    raise exception 'A call time is set to a time, with a request id' using errcode = '22023';
  end if;
  if v_session.call_time_minutes <= 0 then
    raise exception 'Only a seat with a call time sets one' using errcode = 'RVCTN';
  end if;
  v_played := private.seconds_played(v_session, now());
  v_minutes := private.call_time_until(v_session.call_time_minutes, v_played, private.initial_call_time(v_session),
                                       v_session.call_time_set_at is not null, v_ahead);
  if v_minutes is null and v_ahead > 0 and ceil((v_played + v_ahead) / 60.0) > 1440 then
    raise exception 'A call time is at most a day' using errcode = 'RVCTX';
  end if;
  if v_minutes is null then
    raise exception 'A call time set ends after the minimum playing time, and one extended after its current end' using errcode = 'RVCTE';
  end if;
  -- `minutes` is the length from now to the time picked.
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, status, idempotency_key, decided_at, minutes_before, until_at)
  values (v_session.venue_id, v_session.member_id, v_session.id, ceil(v_ahead / 60.0)::integer, 'approved', p_idempotency_key, now(),
          v_session.call_time_minutes, p_until)
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
$$;
create function public.set_my_call_time(p_until timestamptz, p_idempotency_key uuid)
returns integer
language sql
set search_path = ''
as $$ select private.set_my_call_time(p_until, p_idempotency_key); $$;
revoke all on function private.set_my_call_time(timestamptz, uuid) from public, anon;
grant execute on function private.set_my_call_time(timestamptz, uuid) to authenticated;
revoke all on function public.set_my_call_time(timestamptz, uuid) from public, anon;
grant execute on function public.set_my_call_time(timestamptz, uuid) to authenticated;

-- The floor's managers (call_time.override) set or extend a seated player's call time to a time, by the member's own rule;
-- it counts as setting it. Refusals: 42501 not allowed, 22023 a time refused, no request id, or the id for another one.
drop function public.add_seat_call_time(uuid, integer, uuid);
drop function private.add_seat_call_time(uuid, integer, uuid);
create function private.add_seat_call_time(p_session_id uuid, p_until timestamptz, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_done public.call_time_request;
  v_ahead numeric := extract(epoch from (p_until - now()));
  v_minutes integer;
  v_id uuid;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'call_time.override') then
    raise exception 'Only the floor''s managers add call time' using errcode = '42501';
  end if;
  select * into v_done from public.call_time_request r where r.venue_id = v_session.venue_id and r.idempotency_key = p_idempotency_key;
  if v_done.id is not null then
    if v_done.session_id <> v_session.id or v_done.until_at is distinct from p_until then
      raise exception 'That request id was for another call time' using errcode = '22023';
    end if;
    return;
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  if p_idempotency_key is null or p_until is null or v_session.ended_at is not null then
    raise exception 'Call time is set to a time, for a seated player, with a request id' using errcode = '22023';
  end if;
  v_minutes := private.call_time_until(v_session.call_time_minutes, private.seconds_played(v_session, now()),
                                       private.initial_call_time(v_session), v_session.call_time_set_at is not null, v_ahead);
  if v_minutes is null then
    raise exception 'Call time is set after the minimum playing time, and extended after its current end, up to a day' using errcode = '22023';
  end if;
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, status, idempotency_key, decided_at, decided_by_staff_id, minutes_before, until_at)
  values (v_session.venue_id, v_session.member_id, v_session.id, ceil(v_ahead / 60.0)::integer, 'approved', p_idempotency_key, now(),
          private.current_staff_id(v_session.venue_id), v_session.call_time_minutes, p_until)
  returning id into v_id;
  update public.seat_session
  set call_time_minutes = v_minutes, call_time_set_at = coalesce(call_time_set_at, now()), ending_warned_at = null,
      call_time_first_met_at = coalesce(call_time_first_met_at, call_time_completed_at), call_time_completed_at = null
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'call_time.updated',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_minutes),
                       'call_time.updated:' || v_id);
end;
$$;
create function public.add_seat_call_time(p_session_id uuid, p_until timestamptz, p_idempotency_key uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.add_seat_call_time(p_session_id, p_until, p_idempotency_key); $$;
revoke all on function private.add_seat_call_time(uuid, timestamptz, uuid) from public, anon;
grant execute on function private.add_seat_call_time(uuid, timestamptz, uuid) to authenticated;
revoke all on function public.add_seat_call_time(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.add_seat_call_time(uuid, timestamptz, uuid) to authenticated;

-- The member's seat says after when a picked time is open, in place of the lengths.
drop function public.my_seat();
drop function private.my_seat();
create function private.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint, game text, straddle_paise bigint,
               call_time_set_at timestamptz, call_time_after_at timestamptz)
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
         t.name, t.small_blind_paise, t.big_blind_paise, t.game, t.straddle_paise,
         case when f.sees_call_time then s.call_time_set_at end,
         case when f.sees_call_time then private.call_time_after_at(s) end
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type t on t.id = g.table_type_id
  cross join lateral (select private.has_feature(s.member_id, 'call_time.view') as sees_call_time) f
  where s.member_id = private.current_member_id() and s.ended_at is null;
$$;
create function public.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint, game text, straddle_paise bigint,
               call_time_set_at timestamptz, call_time_after_at timestamptz)
language sql
stable
set search_path = ''
as $$ select * from private.my_seat(); $$;
revoke all on function private.my_seat() from public, anon;
grant execute on function private.my_seat() to authenticated;
revoke all on function public.my_seat() from public, anon;
grant execute on function public.my_seat() to authenticated;

-- The floor's seats say the same, so the console offers Set or Extend to a time as the app does.
drop function public.floor_seats(uuid);
drop function private.floor_seats(uuid);
create function private.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text, started_at timestamptz,
               must_move_order integer, away_since timestamptz, call_time_left integer, leaving_at timestamptz, top_up text,
               call_time_set_at timestamptz, call_time_ends_at timestamptz, owes_call_time boolean, call_time_after_at timestamptz,
               call_time_set_by_member boolean, call_time_change_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end,
         s.away_since, private.session_call_time(s, now()), s.leaving_at, private.top_up_state(s),
         -- Call time on the floor: when it was set, when they leave once it is (none while away), whether they owe it, after
         -- when a picked time is open, and whether the member set it last, which the floor is told of.
         s.call_time_set_at,
         case when s.call_time_set_at is not null and s.call_time_minutes > 0 and s.away_since is null
              then now() + make_interval(secs => private.session_call_time(s, now())) end,
         private.owes_call_time(s, now()), private.call_time_after_at(s),
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
$$;
revoke all on function private.floor_seats(uuid) from public, anon;
grant execute on function private.floor_seats(uuid) to authenticated;
create function public.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text, started_at timestamptz,
               must_move_order integer, away_since timestamptz, call_time_left integer, leaving_at timestamptz, top_up text,
               call_time_set_at timestamptz, call_time_ends_at timestamptz, owes_call_time boolean, call_time_after_at timestamptz,
               call_time_set_by_member boolean, call_time_change_id uuid)
language sql
stable
set search_path = ''
as $$ select * from private.floor_seats(p_venue_id); $$;
revoke all on function public.floor_seats(uuid) from public, anon;
grant execute on function public.floor_seats(uuid) to authenticated;

-- The lengths go: their lists, the rule that read them, and the settings.
drop function private.call_time_choices_open(public.seat_session);
drop function private.seat_time_choices(public.seat_session);
drop function private.extend_time_choices(uuid);
drop function public.add_time_choices(uuid);
drop function private.floor_add_time_choices(uuid);
drop function private.add_time_choices(uuid);
drop function private.call_time_choice_end(integer, integer, integer, boolean, integer);
delete from public.setting s where s.key in ('call_time.add_choices', 'call_time.extend_choices');
delete from public.setting_key where key in ('call_time.add_choices', 'call_time.extend_choices');
