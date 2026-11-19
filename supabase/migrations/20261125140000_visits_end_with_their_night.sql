-- A night's visit ends with it (#1096, #1095, the owner, 19 Nov).
-- * A seat forgotten overnight and let go after 08:00 ends at 06:00 (private.seat_end_stamp); its visit now closes then too, at
--   once, by the floor's end_seat and the member's leave_my_seat alike.
-- * The 11:10 sweep closes any visit from an earlier night with nothing open, at its last seat's end, even one that ended a
--   little after 06:00 (before, only check-in and seating closed those, at the member's next visit).
-- * An end at exactly 06:00 is last night's: the door's list (todays_players) and the top-ups list count it as before tonight.

CREATE OR REPLACE FUNCTION private.end_seat(p_session_id uuid, p_reason text, p_leave_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.may_change_seats(v_session.table_id) then
    raise exception 'Only the floor or the table''s tablet lets a player leave' using errcode = '42501';
  end if;
  if v_session.ended_at is not null then return; end if;
  if p_reason is null or p_reason not in ('left', 'away') then
    raise exception 'A player leaves, or is away for good' using errcode = '22023';
  end if;
  if p_leave_reason is not null
     and p_leave_reason not in ('call_time_met', 'busted', 'emergency', 'unwell', 'table_broke', 'floor_decision') then
    raise exception 'A reason to leave is one of the club''s list' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id);
  update public.seat_session
  set ended_at = private.seat_end_stamp(v_session.seated_here_at, now()), end_reason = p_reason, away_since = null, leave_reason = p_leave_reason
  where id = v_session.id;
  -- A seat forgotten overnight ends at its night's end (private.seat_end_stamp): its visit ends with it now, not at the
  -- member's next check-in or the morning sweep (#1096). A stop in force leaves the visit to the sweep.
  if private.seat_end_stamp(v_session.seated_here_at, now()) < now() then
    begin
      perform private.close_stale_visit(v_session.member_id);
    exception when sqlstate 'RVFRZ' or sqlstate 'RVMBR' then
      null;
    end;
  end if;
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', p_reason), 'seat.left:' || v_session.id || ':' || clock_timestamp());
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
  -- A seat forgotten overnight ends at its night's end (private.seat_end_stamp): its visit ends with it now, not at the
  -- member's next check-in or the morning sweep (#1096). A stop in force leaves the visit to the sweep.
  if private.seat_end_stamp(v_session.seated_here_at, now()) < now() then
    begin
      perform private.close_stale_visit(v_session.member_id);
    exception when sqlstate 'RVFRZ' or sqlstate 'RVMBR' then
      null;
    end;
  end if;
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', 'left'), 'seat.left:' || v_session.id);
  return 'left';
end;
$function$;

CREATE OR REPLACE FUNCTION private.close_stale_visits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member uuid;
  v_visit public.visit;
begin
  for v_member in
    select v.member_id from public.visit v where v.closed_at is null and v.opened_at < private.tonight_began(now())
  loop
    begin
      -- One at a time per member, as check-in and seating take it first.
      perform 1 from public.member m where m.id = v_member for update;
      -- An earlier night's visit with nothing open ends at its last seat's end, even one that ended a little after 06:00
      -- (the owner, #1095). Check-in and seating keep private.close_stale_visit's narrower rule.
      select * into v_visit from public.visit v
      where v.member_id = v_member and v.closed_at is null and v.opened_at < private.tonight_began(now());
      if v_visit.id is not null and not exists (select 1 from public.seat_session s where s.visit_id = v_visit.id and s.ended_at is null) then
        perform private.close_visit(v_member, coalesce((select max(s.ended_at) from public.seat_session s where s.visit_id = v_visit.id),
                                                       v_visit.opened_at), 'end_of_day');
      end if;
    exception
      when sqlstate 'RVFRZ' or sqlstate 'RVMBR' then
        -- A stop in force: a later run closes it once the stop is released.
        continue;
      when others then
        raise warning 'stale visit: member % not closed: %', v_member, sqlerrm;
    end;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.todays_players(p_venue_id uuid, p_day date DEFAULT NULL::date)
 RETURNS TABLE(member_id uuid, full_name text, member_number bigint, status text, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with day as (
    select s.starts_at, s.starts_at + interval '1 day' as ends_at, p_day is null as is_today
    from (select coalesce((p_day + time '06:00') at time zone 'Asia/Kolkata', private.tonight_began(now())) as starts_at) s
  ),
  people as (
    select v.member_id from public.visit v, day where v.venue_id = p_venue_id
      and ((v.opened_at >= day.starts_at and v.opened_at < day.ends_at) or (day.is_today and v.closed_at is null))
    union select e.member_id from public.waitlist_entry e, day where e.venue_id = p_venue_id
      and ((e.joined_at >= day.starts_at and e.joined_at < day.ends_at) or (day.is_today and e.status = 'waiting'))
    union select s.member_id from public.seat_session s, day where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  sessions as (
    select s.* from public.seat_session s, day where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  -- Each stretch at one table, as private.session_tables splits a seat's time: an open one runs to now. Time away from the
  -- table is taken off, shared out over the session's tables as private.visit_table_time does (#1061).
  stretches as (
    select s.id as session_id, s.member_id, t.o_table_id as table_id, greatest(0, extract(epoch from least(t.o_to, now()) - t.o_from)) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)))::bigint as wall,
           s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                 then greatest(0, floor(extract(epoch from (now() - s.away_since))))::bigint else 0 end as away
    from sessions s cross join lateral private.session_tables(s.id) t
  ),
  per_session_table as (
    select st.member_id, st.table_id,
           private.table_played_seconds(least(floor(sum(st.seconds))::bigint, st.wall), st.wall, least(st.wall, greatest(0, st.wall - st.away))) as seconds
    from stretches st
    group by st.member_id, st.session_id, st.table_id, st.wall, st.away
  ),
  per_table as (
    select p.member_id, g.name, g.position, sum(p.seconds)::integer as seconds
    from per_session_table p join public.game_table g on g.id = p.table_id
    group by p.member_id, g.name, g.position
  )
  select m.id, m.full_name, m.member_number,
         case when exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'playing'
              when exists (select 1 from public.waitlist_entry e where e.member_id = m.id and e.status = 'waiting') then 'waiting'
              when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null) then 'in_room'
              when not exists (select 1 from public.visit v, day where v.member_id = m.id
                                 and v.opened_at < day.ends_at and (v.closed_at is null or v.closed_at > day.starts_at))
                then 'never_arrived'
              else 'left' end,
         (select min(v.opened_at) from public.visit v, day where v.member_id = m.id and v.opened_at >= day.starts_at and v.opened_at < day.ends_at),
         -- Checked out once the day's every visit is closed: the last close.
         (select case when bool_and(v.closed_at is not null) then max(v.closed_at) end from public.visit v, day
          where v.member_id = m.id and v.opened_at >= day.starts_at and v.opened_at < day.ends_at),
         coalesce((select floor(sum(extract(epoch from coalesce(e.left_at, e.seated_at, now()) - e.joined_at)))::integer
                   from public.waitlist_entry e, day where e.member_id = m.id and e.joined_at >= day.starts_at and e.joined_at < day.ends_at), 0),
         coalesce((select jsonb_agg(jsonb_build_object('table', pt.name, 'seconds', pt.seconds) order by pt.position)
                   from per_table pt where pt.member_id = m.id), '[]'::jsonb)
  from people p
  join public.member m on m.id = p.member_id
  where (select private.has_permission(p_venue_id, 'members.read'))
  order by m.full_name;
$function$;

CREATE OR REPLACE FUNCTION private.top_ups_tonight(p_venue_id uuid)
 RETURNS TABLE(request_id uuid, session_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamp with time zone, fulfilled_seconds integer, accepted_by text, accepted_seconds integer, done_by text, done_seconds integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.id, r.session_id, g.name, case when s.ended_at is null then s.seat else r.seat end, m.full_name,
         case when r.outcome is not null then r.outcome
              when s.ended_at is not null then 'left'
              when r.started_at is not null then 'in_progress'
              else 'requested' end,
         r.requested_at,
         case when r.outcome = 'fulfilled' then floor(extract(epoch from r.closed_at - r.requested_at))::integer end,
         sb.full_name, floor(extract(epoch from r.started_at - r.requested_at))::integer,
         case when r.outcome = 'fulfilled' then cb.full_name end,
         case when r.outcome = 'fulfilled' then floor(extract(epoch from r.closed_at - r.started_at))::integer end
  from public.top_up_request r
  join public.seat_session s on s.id = r.session_id
  join public.member m on m.id = s.member_id
  join public.game_table g on g.id = case when s.ended_at is null then s.table_id else r.table_id end
  left join public.staff sb on sb.id = r.started_by_staff_id
  left join public.staff cb on cb.id = r.closed_by_staff_id
  where r.venue_id = p_venue_id and private.may_handle_top_ups(p_venue_id)
    and coalesce(r.closed_at, s.ended_at, now()) > private.tonight_began(now())
  order by g.position, r.requested_at desc;
$function$;
