-- Correct visit says which rule refused a correction (#1078): a clash with the member's other visit is its own refusal,
-- RVVCL, so the panel names it; every other refusal stays 22023. Generated from the live definition, that raise alone changed.
CREATE OR REPLACE FUNCTION private.correct_visit(p_visit_id uuid, p_seats jsonb, p_reason text, p_opened_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_closed_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(o_refused integer, o_given_above integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_seats jsonb := coalesce(p_seats, '[]'::jsonb);
  v_visit public.visit;
  v_open timestamptz;
  v_close timestamptz;
  v_seat jsonb;
  v_done jsonb[] := array[]::jsonb[];
  v_refused uuid[];
  v_above integer;
begin
  select vi.* into v_visit from public.visit vi where vi.id = p_visit_id for update;
  if v_visit.id is null or not coalesce(private.is_super_admin(v_visit.venue_id), false) then
    raise exception 'Only a super admin corrects a visit' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_visit.member_id) or coalesce(private.is_own_kyc_check(v_visit.member_id), false) then
    raise exception 'Staff never correct a visit of their own record' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(v_visit.venue_id, null, v_visit.member_id);
  if length(v_reason) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(v_seats) is distinct from 'array' or jsonb_array_length(v_seats) > 20
     or (select count(distinct e ->> 'sessionId') from jsonb_array_elements(v_seats) e) <> jsonb_array_length(v_seats) then
    raise exception 'Up to twenty seats, each once' using errcode = '22023';
  end if;
  if p_closed_at is not null and v_visit.closed_at is null then
    raise exception 'A visit still open is checked out at the door, not here' using errcode = '22023';
  end if;
  v_open := coalesce(p_opened_at, v_visit.opened_at);
  v_close := coalesce(p_closed_at, v_visit.closed_at);
  if v_open = v_visit.opened_at and v_close is not distinct from v_visit.closed_at and jsonb_array_length(v_seats) = 0 then
    raise exception 'Nothing to correct' using errcode = '22023';
  end if;
  if v_open > now() or private.club_day_of(v_open) <> private.club_day_of(v_visit.opened_at) or v_close <= v_open or v_close > now() then
    raise exception 'Check-in stays on its club day; check-out falls after it, and neither ahead of now' using errcode = '22023';
  end if;
  -- A correction never stretches a visit past its club day's end, 06:00 IST the next morning, unless it already ran past it.
  if v_close > greatest((private.club_day_of(v_visit.opened_at) + 1 + time '06:00') at time zone 'Asia/Kolkata', v_visit.closed_at) then
    raise exception 'Check-out stays within the visit''s club day' using errcode = '22023';
  end if;
  if exists (select 1 from public.visit o where o.member_id = v_visit.member_id and o.id <> v_visit.id
             and o.opened_at < coalesce(v_close, 'infinity') and coalesce(o.closed_at, 'infinity') > v_open) then
    raise exception 'The visit runs into the member''s other visit' using errcode = 'RVVCL';
  end if;
  -- The visit first, so each seat's end is held to the corrected check-out.
  update public.visit set opened_at = v_open, closed_at = v_close
  where id = v_visit.id and (opened_at <> v_open or closed_at is distinct from v_close);
  for v_seat in select e from jsonb_array_elements(v_seats) e loop
    v_done := v_done || private.correct_one_seat(v_visit.id, (v_seat ->> 'sessionId')::uuid, (v_seat ->> 'awaySeconds')::integer,
                                                 (v_seat ->> 'endedAt')::timestamptz);
  end loop;
  if exists (select 1 from public.seat_session s where s.visit_id = v_visit.id and (s.started_at < v_open or s.ended_at > v_close)) then
    raise exception 'Check-in falls before the first seat, and check-out after the last' using errcode = '22023';
  end if;
  select array_agg(g.id order by g.created_at) filter (where g.status = 'waiting'), count(*) filter (where g.status = 'given')
    into v_refused, v_above
  from public.promotion_grant g
  join public.promotion_version pv on pv.id = g.promotion_version_id
  cross join lateral private.visit_schedule_time_at(v_visit.id, pv.schedule, pv.eligibility, coalesce(v_close, now())) t
  where g.venue_id = v_visit.venue_id and g.member_id = v_visit.member_id and g.trigger = 'hours_step'
    and g.status in ('waiting', 'given') and g.source_key like ('hours_step:' || v_visit.id || ':%')
    and t.o_seconds / 60 < (g.event ->> 'stepMinutes')::integer;
  if v_refused is not null then
    perform private.decide_promotion_bonus(v_visit.venue_id, v_refused, 'refused', 'Session corrected', gen_random_uuid());
  end if;
  perform private.weigh_hours_steps(v_visit.id, coalesce(v_close, now()));
  if v_open <> v_visit.opened_at or v_close is distinct from v_visit.closed_at then
    perform private.audit(v_visit.venue_id, 'visit.times_corrected', 'visit', v_visit.id::text,
                          jsonb_build_object('opened_at', v_visit.opened_at, 'closed_at', v_visit.closed_at),
                          jsonb_build_object('opened_at', v_open, 'closed_at', v_close, 'member_id', v_visit.member_id, 'given_above', v_above), v_reason);
  end if;
  foreach v_seat in array v_done loop
    perform private.audit(v_visit.venue_id, 'seat.session_corrected', 'seat_session', v_seat ->> 'session_id', v_seat -> 'before',
                          (v_seat -> 'after') || jsonb_build_object('member_id', v_visit.member_id, 'given_above', v_above), v_reason);
  end loop;
  return query select coalesce(cardinality(v_refused), 0), v_above;
end;
$function$;
