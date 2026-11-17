-- The member sets their call time from the seat (#1059, the owner, 17 Nov). In the player app "Add time", a request the
-- floor approved, becomes "Set call time": a length the club offers (call_time.add_choices), counted from now, that the
-- member owes as well as the call time they had. private.set_call_time is the twin of @rivr/domain setCallTime, proved
-- equal on packages/testing/golden/callTimeSet.json (supabase/tests/024). The floor's own Add time and the requests
-- already waiting are unchanged. `call_time_set_at` says the member set one, so the app shows "Call time until".

alter table public.seat_session add column call_time_set_at timestamptz;
comment on column public.seat_session.call_time_set_at is
  'When the member last set their call time from the seat (#1059): the player app shows "Call time until" only then.';
-- The member's own act: their data export carries it.
insert into private.member_export_column (table_name, column_name, kind) values ('seat_session', 'call_time_set_at', 'owed');

-- The seat's call time once the member sets one: the whole minutes played (none or below nought as nought) plus the
-- length, never before the call time owed, up to a day, and only on a seat with a call time; null when refused.
create function private.set_call_time(p_current integer, p_played integer, p_length integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_length between 1 and 1440 and p_current > 0
              and greatest(coalesce(p_played, 0), 0) + p_length <= 1440
              and greatest(coalesce(p_played, 0), 0) + p_length >= p_current
         then greatest(coalesce(p_played, 0), 0) + p_length end;
$$;

-- The member's own seat: the call time set at once, with no floor approval, kept as an approved row of
-- call_time_request (decided by no staff member) so the seat's history shows it. A request id makes a repeat harmless; a
-- length that changes nothing writes nothing and tells no one (security review: no stream of rows and broadcasts). Each
-- refusal has its own code, so the app says which: RVCTC not a length the club offers, RVCTN a seat with no call time,
-- RVCTX past a day, RVCTE before the call time owed.
create function private.set_my_call_time(p_minutes integer, p_idempotency_key uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
  v_minutes := private.set_call_time(v_session.call_time_minutes, private.minutes_played(v_session, now()), p_minutes);
  if v_minutes is null and private.minutes_played(v_session, now()) + p_minutes > 1440 then
    raise exception 'A call time is at most a day' using errcode = 'RVCTX';
  end if;
  if v_minutes is null then
    raise exception 'A call time you set ends no earlier than the one you owe' using errcode = 'RVCTE';
  end if;
  if v_minutes = v_session.call_time_minutes then
    update public.seat_session set call_time_set_at = coalesce(call_time_set_at, now()) where id = v_session.id;
    return v_minutes;
  end if;
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, status, idempotency_key, decided_at, minutes_before)
  values (v_session.venue_id, v_session.member_id, v_session.id, p_minutes, 'approved', p_idempotency_key, now(), v_session.call_time_minutes)
  returning id into v_id;
  update public.seat_session
  set call_time_minutes = v_minutes, call_time_set_at = now(), ending_warned_at = null,
      call_time_first_met_at = coalesce(call_time_first_met_at, call_time_completed_at), call_time_completed_at = null
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'call_time.updated',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_minutes),
                       'call_time.updated:' || v_id);
  return v_minutes;
end;
$$;

create function public.set_my_call_time(p_minutes integer, p_idempotency_key uuid)
returns integer
language sql
set search_path = ''
as $$ select private.set_my_call_time(p_minutes, p_idempotency_key); $$;

revoke all on function private.set_call_time(integer, integer, integer) from public, anon, authenticated;
revoke all on function private.set_my_call_time(integer, uuid) from public, anon;
grant execute on function private.set_my_call_time(integer, uuid) to authenticated;
revoke all on function public.set_my_call_time(integer, uuid) from public, anon;
grant execute on function public.set_my_call_time(integer, uuid) to authenticated;

-- The member's seat also says whether they set the call time themselves (the app's "Call time until").
drop function public.my_seat();
drop function private.my_seat();

create function private.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint, time_request_minutes integer,
               add_time_choices integer[], game text, straddle_paise bigint, call_time_set_at timestamptz)
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
         private.add_time_choices(s.venue_id), t.game, t.straddle_paise,
         case when f.sees_call_time then s.call_time_set_at end
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
               add_time_choices integer[], game text, straddle_paise bigint, call_time_set_at timestamptz)
language sql
stable
set search_path = ''
as $$ select * from private.my_seat(); $$;

revoke all on function private.my_seat() from public, anon;
grant execute on function private.my_seat() to authenticated;
revoke all on function public.my_seat() from public, anon;
grant execute on function public.my_seat() to authenticated;
