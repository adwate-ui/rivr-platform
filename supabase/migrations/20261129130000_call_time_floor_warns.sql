-- The floor's call time warns instead of refusing (the owner, 25 Nov; #1132): staff who set call time on the console
-- (call_time.override: super admins, admins, the floor and cashiers) may set a time before the minimum playing time (until
-- set) or before the current end (once set), or one already gone, which ends the call time now, once they confirm past a
-- warning. A day at most and a seat with a call time stay hard. The member's own Set and Extend keep every rule.
-- One rule: private.floor_call_time_until, proved equal to @rivr/domain floorCallTimeUntil on
-- packages/testing/golden/callTimeUntil.json (pgTAP 024).

-- A time already gone is nought minutes from now.
alter table public.call_time_request drop constraint call_time_request_minutes_check;
alter table public.call_time_request add constraint call_time_request_minutes_check check (minutes between 0 and 1440);

-- The seat's call time once the floor picks a time `p_seconds_ahead` from now, and the warning to confirm past: 'early'
-- when the member's rule (private.call_time_until) would refuse it, 'gone' when it is not ahead of now, which ends the call
-- time now (the whole minutes played, one at least). Null minutes, and no warning, for a seat with no call time or past a
-- day in all. @rivr/domain floorCallTimeUntil.
create function private.floor_call_time_until(p_current integer, p_played_seconds integer, p_initial integer, p_is_set boolean,
                                              p_seconds_ahead numeric)
returns table (o_minutes integer, o_warning text)
language sql
immutable
set search_path = ''
as $$
  select case when t.is_gone then least(1440, greatest(1, floor(t.played / 60.0)))::integer
              when t.total <= 1440 then t.total::integer end,
         case when t.is_gone then 'gone'
              when t.total <= 1440 and private.call_time_until(p_current, p_played_seconds, p_initial, p_is_set, p_seconds_ahead) is null
                then 'early' end
  from (select greatest(coalesce(p_played_seconds, 0), 0) as played,
               ceil((greatest(coalesce(p_played_seconds, 0), 0) + p_seconds_ahead) / 60.0) as total,
               p_seconds_ahead <= 0 as is_gone) t
  where p_current > 0 and p_seconds_ahead is not null;
$$;
revoke all on function private.floor_call_time_until(integer, integer, integer, boolean, numeric) from public, anon, authenticated;

-- The floor sets or extends a seated player's call time to a time. Without `p_confirmed`, a time the member's rule would
-- refuse is refused with RVCTE, and one gone with RVCTG, so the console asks first and sends it again, with the same
-- request id, confirmed. Refusals: 42501 not the floor's managers; RVOWN the staff member's own seat, now that a call time
-- can be cut (as private.set_seat_call_time refuses it); 22023 no request id or time, an ended seat, or the id was for
-- another call time; RVCTN a seat with no call time; RVCTX past a day.
drop function public.add_seat_call_time(uuid, timestamptz, uuid);
drop function private.add_seat_call_time(uuid, timestamptz, uuid);
create function private.add_seat_call_time(p_session_id uuid, p_until timestamptz, p_idempotency_key uuid, p_confirmed boolean default false)
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
  v_warning text;
  v_id uuid;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'call_time.override') then
    raise exception 'Only the floor''s managers add call time' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_session.member_id) then
    raise exception 'Staff never set call time on their own record' using errcode = 'RVOWN';
  end if;
  select * into v_done from public.call_time_request r where r.venue_id = v_session.venue_id and r.idempotency_key = p_idempotency_key;
  if v_done.id is not null then
    if v_done.session_id <> v_session.id or p_until is null or v_done.until_at is distinct from p_until then
      raise exception 'That request id was for another call time' using errcode = '22023';
    end if;
    return;
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  if p_idempotency_key is null or p_until is null or v_session.ended_at is not null then
    raise exception 'Call time is set to a time, for a seated player, with a request id' using errcode = '22023';
  end if;
  if v_session.call_time_minutes <= 0 then
    raise exception 'Only a seat with a call time sets one' using errcode = 'RVCTN';
  end if;
  select f.o_minutes, f.o_warning into v_minutes, v_warning
  from private.floor_call_time_until(v_session.call_time_minutes, private.seconds_played(v_session, now()),
                                     private.initial_call_time(v_session), v_session.call_time_set_at is not null, v_ahead) f;
  if v_minutes is null then
    raise exception 'A call time is at most a day' using errcode = 'RVCTX';
  end if;
  if v_warning = 'early' and not coalesce(p_confirmed, false) then
    raise exception 'Before the minimum playing time, or the current end: confirm to set it' using errcode = 'RVCTE';
  end if;
  if v_warning = 'gone' and not coalesce(p_confirmed, false) then
    raise exception 'That time has gone, so the call time ends now: confirm to set it' using errcode = 'RVCTG';
  end if;
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, status, idempotency_key, decided_at, decided_by_staff_id, minutes_before, until_at)
  values (v_session.venue_id, v_session.member_id, v_session.id, greatest(0, ceil(v_ahead / 60.0))::integer, 'approved', p_idempotency_key, now(),
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
create function public.add_seat_call_time(p_session_id uuid, p_until timestamptz, p_idempotency_key uuid, p_confirmed boolean default false)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.add_seat_call_time(p_session_id, p_until, p_idempotency_key, p_confirmed); $$;
revoke all on function private.add_seat_call_time(uuid, timestamptz, uuid, boolean) from public, anon;
grant execute on function private.add_seat_call_time(uuid, timestamptz, uuid, boolean) to authenticated;
revoke all on function public.add_seat_call_time(uuid, timestamptz, uuid, boolean) from public, anon;
grant execute on function public.add_seat_call_time(uuid, timestamptz, uuid, boolean) to authenticated;

-- Undo gives back the call time as it was: a seat the minute sweep marked done after a shorter call time owes again when
-- the call time given back has time left (#1132). Otherwise as 20261124120000.
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
    -- Done by a shorter call time, and owing again on the one given back (#1132).
    update public.seat_session s set call_time_completed_at = null
    where s.id = v_session.id and s.call_time_completed_at is not null and private.owes_call_time(s, now());
    perform private.emit(v_request.venue_id, 'call_time.updated',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_request.minutes_before),
                         'call_time.updated:undone:' || v_request.id);
  end if;
  -- Undone, never asked for again: members no longer ask the floor (#1076).
  update public.call_time_request set status = 'undone', minutes_before = null where id = v_request.id;
end;
$function$;
