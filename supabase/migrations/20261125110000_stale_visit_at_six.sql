-- A visit nobody checked out ends with its night when its seat was let go the next morning (#1092). A forgotten seat let go
-- after 08:00 is stamped as ending at 06:00 (private.seat_end_stamp), the start of the new club day, and close_stale_visit
-- kept a visit whose last seat ended at or after that start, so the visit ran on into the next nights and every later seat
-- joined it. That end is last night's: compared strictly, the visit closes at it (end_of_day), at check-in, at seating and
-- in the morning sweep. A member who played on past 06:00 keeps their visit, as before.
CREATE OR REPLACE FUNCTION private.close_stale_visit(p_member_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_visit public.visit;
  v_last timestamptz;
begin
  select * into v_visit from public.visit v where v.member_id = p_member_id and v.closed_at is null;
  if v_visit.id is null or exists (select 1 from public.seat_session s where s.visit_id = v_visit.id and s.ended_at is null) then
    return;
  end if;
  v_last := coalesce((select max(s.ended_at) from public.seat_session s where s.visit_id = v_visit.id), v_visit.opened_at);
  -- A seat let go next morning is stamped at 06:00 (private.seat_end_stamp): that end is still last night's.
  if v_last > private.tonight_began(now()) then
    return;
  end if;
  perform private.close_visit(p_member_id, v_last, 'end_of_day');
end;
$function$;
