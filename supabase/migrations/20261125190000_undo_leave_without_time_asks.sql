-- undo_leave without its branch for time asks closed as 'left' (#1082, from the review of #1076). Members no longer ask the floor
-- for more time (request_call_time was dropped and waiting asks declined), and nothing else marks a time ask 'left', so the
-- branch that turned them back into 'requested' could never run. No change in behaviour.

CREATE OR REPLACE FUNCTION private.undo_leave(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_table public.game_table;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor undoes a leave' using errcode = '42501';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  select * into v_table from public.game_table t where t.id = v_session.table_id for no key update;
  if v_session.ended_at is null or v_session.end_reason <> 'left' or not private.is_undoable(v_session.ended_at)
     or not v_table.active or not v_table.is_open
     or exists (select 1 from public.early_departure e where e.session_id = v_session.id)
     or exists (select 1 from public.visit v where v.id = v_session.visit_id and v.closed_at is not null)
     or exists (select 1 from public.outbox_event e where e.venue_id = v_session.venue_id and e.idempotency_key = 'seat.left:' || v_session.id) then
    raise exception 'Only the floor''s leave of the last two minutes, at an open table, not let go early, is undone' using errcode = '22023';
  end if;
  if private.is_seat_held(v_table.id, v_session.seat, v_session.member_id) then
    raise exception 'That seat is held for a member called from the waitlist' using errcode = 'RVHLD';
  end if;
  if (select r.break_until from private.member_restrictions(v_session.member_id, now()) r) is not null then
    raise exception 'On a break: the member cannot be seated until it ends' using errcode = 'RVBRK';
  end if;
  begin
    update public.seat_session set ended_at = null, end_reason = null, leave_reason = null where id = v_session.id;
  exception when unique_violation then
    raise exception 'Someone sits in that seat, or the player sits elsewhere' using errcode = 'RVOCC';
  end;
  update public.top_up_request set closed_at = null, outcome = null
  where session_id = v_session.id and outcome = 'left' and closed_at = v_session.ended_at;
  perform private.emit(v_session.venue_id, 'seat.taken',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat), 'seat.taken:' || v_session.id || ':' || clock_timestamp());
end;
$function$;
