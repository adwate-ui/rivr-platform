-- Edit visit says when time away is longer than its seat (the owner, 19 Nov): that refusal is its own, RVAWL, so the
-- panel names it instead of "Those times do not fit the visit."; every other refusal stays 22023. Generated from the
-- live definition, that raise alone changed.
CREATE OR REPLACE FUNCTION private.correct_one_seat(p_visit_id uuid, p_session_id uuid, p_away_seconds integer, p_ended_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_end timestamptz;
  v_running integer;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not coalesce(private.is_super_admin(v_session.venue_id), false) then
    raise exception 'Only a super admin corrects a session' using errcode = '42501';
  end if;
  if v_session.visit_id is distinct from p_visit_id then
    raise exception 'One visit''s seats at a time' using errcode = '22023';
  end if;
  if private.is_own_cage_record(v_session.member_id) or coalesce(private.is_own_kyc_check(v_session.member_id), false) then
    raise exception 'Staff never correct a session of their own record' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  -- Only a session that is over has an end to move: an open one ends at the table.
  if v_session.ended_at is null and p_ended_at is not null then
    raise exception 'A seat still taken ends at the table, not here' using errcode = '22023';
  end if;
  v_end := case when v_session.ended_at is null then null else coalesce(p_ended_at, v_session.ended_at) end;
  if v_end is not null and (v_end <= v_session.seated_here_at or v_end > now()) then
    raise exception 'The end falls after they sat at that table, and not ahead of now' using errcode = '22023';
  end if;
  if p_ended_at is not null and p_ended_at > (select coalesce(vi.closed_at, now()) from public.visit vi where vi.id = v_session.visit_id) then
    raise exception 'The end falls before the visit closed' using errcode = '22023';
  end if;
  if v_end is not null and exists (select 1 from public.seat_session o where o.member_id = v_session.member_id and o.id <> v_session.id
                                    and o.started_at >= v_session.started_at and o.started_at < v_end) then
    raise exception 'The end runs into the member''s next seat' using errcode = '22023';
  end if;
  if p_away_seconds is null or p_away_seconds < 0
     or p_away_seconds > floor(extract(epoch from (coalesce(v_end, now()) - v_session.started_at))) then
    raise exception 'Time away is within the session' using errcode = 'RVAWL';
  end if;
  v_running := coalesce(floor(extract(epoch from now() - v_session.away_since))::integer, 0);
  update public.seat_session set ended_at = v_end, away_seconds = greatest(0, p_away_seconds - v_running) where id = v_session.id;
  return jsonb_build_object('session_id', v_session.id,
                            'before', jsonb_build_object('ended_at', v_session.ended_at, 'away_seconds', v_session.away_seconds + v_running),
                            'after', jsonb_build_object('ended_at', v_end, 'away_seconds', p_away_seconds));
end;
$function$;
