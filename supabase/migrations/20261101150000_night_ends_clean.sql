-- Every night ends clean (B5 of the Fix Tracker; the 28 Oct audit, A5-01, A5-02, A5-04, A5-05, A5-09, A5-11, A5-16). A
-- night ends at 06:00 IST (private.tonight_began), but nothing ended what was left open: a seat nobody let go of ran into
-- the next evening and earned its hours; a visit nobody checked out became tomorrow's too (and the door checked the
-- member out); a waiting place outlived its visit and was called; a dealer's down was still dealing the next night.

-- When a seat from an earlier night ends: at that night's end if it is let go of well into the next day (a seat
-- forgotten overnight earns no hours past its night), else now (a player who stayed past 06:00 is not cut short).
create function private.seat_end_stamp(p_seated_here_at timestamptz, p_now timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when p_seated_here_at < private.tonight_began(p_now) and p_now > private.tonight_began(p_now) + interval '2 hours'
              then private.tonight_began(p_now) else p_now end;
$$;

-- As in 20261019092000_seat_events.sql, with the seat's end from seat_end_stamp.
create or replace function private.end_seat(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  perform private.assert_writable(v_session.venue_id);
  update public.seat_session set ended_at = private.seat_end_stamp(v_session.seated_here_at, now()), end_reason = p_reason, away_since = null
  where id = v_session.id;
  update public.buy_in_request set status = 'withdrawn', decided_at = now() where session_id = v_session.id and status = 'waiting';
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', p_reason), 'seat.left:' || v_session.id);
end;
$$;

-- A player leaving from the app, the same. As in 20261029170000_seat_self_service.sql, with that.
create or replace function private.leave_my_seat()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
begin
  if not private.has_feature(v_session.member_id, 'table.leave') then
    raise exception 'Leaving from the app is not open to you' using errcode = '42501';
  end if;
  if coalesce(private.session_call_time(v_session, now()), 0) > 0 then
    update public.seat_session set leaving_at = coalesce(leaving_at, now()) where id = v_session.id;
    return 'leaving';
  end if;
  update public.seat_session set ended_at = private.seat_end_stamp(v_session.seated_here_at, now()), end_reason = 'left', away_since = null where id = v_session.id;
  update public.buy_in_request set status = 'withdrawn', decided_at = now() where session_id = v_session.id and status = 'waiting';
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', 'left'), 'seat.left:' || v_session.id);
  return 'left';
end;
$$;

-- Closing a visit leaves the member's waiting places from earlier nights, and a seat one was called to rolls on to the
-- next, as leave_waitlist does. Tonight's places stay: a member steps out and back, or is seated from one. As in
-- 20261028380100_accommodation_nights.sql, with that.
create or replace function private.close_visit(p_member_id uuid, p_at timestamptz, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_entry public.waitlist_entry;
begin
  select * into v_visit from public.visit v where v.member_id = p_member_id and v.closed_at is null for update;
  if v_visit.id is null then return null; end if;
  update public.visit set closed_at = greatest(p_at, v_visit.opened_at), close_reason = p_reason where id = v_visit.id;
  for v_entry in select * from public.waitlist_entry e
                 where e.member_id = p_member_id and e.status = 'waiting' and e.joined_at < private.tonight_began(now()) for update loop
    update public.waitlist_entry set status = 'left', left_at = now(), left_reason = 'left' where id = v_entry.id;
    if v_entry.called_at is not null then perform private.roll_call_on(v_entry); end if;
  end loop;
  perform private.emit(v_visit.venue_id, 'visit.closed',
                       jsonb_build_object('visit_id', v_visit.id, 'member_id', p_member_id, 'reason', p_reason), 'visit.closed:' || v_visit.id);
  perform private.earn_visit_points(v_visit.id);
  perform private.earn_visit_nights(v_visit.id);
  perform private.weigh_hours_played(v_visit.id);
  return v_visit.id;
end;
$$;

-- A visit from an earlier night that nothing happened in after that night ended (its last seat, or its opening if it had
-- none, came before) is closed then (end_of_day): two nights are never one visit, and last night's call time never blocks
-- tonight. A member who played on past 06:00 keeps their visit until they leave; a seat still open keeps it until the
-- floor ends it.
create function private.close_stale_visit(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_last timestamptz;
begin
  select * into v_visit from public.visit v where v.member_id = p_member_id and v.closed_at is null;
  if v_visit.id is null or exists (select 1 from public.seat_session s where s.visit_id = v_visit.id and s.ended_at is null) then
    return;
  end if;
  v_last := coalesce((select max(s.ended_at) from public.seat_session s where s.visit_id = v_visit.id), v_visit.opened_at);
  if v_last >= private.tonight_began(now()) then
    return;
  end if;
  perform private.close_visit(p_member_id, v_last, 'end_of_day');
end;
$$;
revoke execute on function private.close_stale_visit(uuid) from public, anon, authenticated;

-- Check-in closes it first. As in 20261026100000_door_kiosk.sql, with that.
create or replace function private.open_visit(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  -- One at a time per member: two taps open one visit, and a break that starts meanwhile is seen.
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: the member cannot be checked in until it ends' using errcode = 'RVBRK';
  end if;
  perform private.close_stale_visit(p_member_id);
  v_id := private.current_visit(p_member_id);
  if v_id is not null then return v_id; end if;
  insert into public.visit (venue_id, member_id, opened_by_staff_id, opened_by_device_id)
  values (p_venue_id, p_member_id, private.current_staff_id(p_venue_id),
          case when private.door_venue_id() = p_venue_id then private.current_device_id() end)
  returning id into v_id;
  perform private.emit(p_venue_id, 'visit.opened', jsonb_build_object('visit_id', v_id, 'member_id', p_member_id), 'visit.opened:' || v_id);
  -- Once a club day, however often a member scans in and out (keyed by the day, not the visit).
  perform private.evaluate_promotions(p_venue_id, 'check_in', jsonb_build_object('member_id', p_member_id,
    'key', 'check_in:' || p_member_id || ':' || (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date));
  return v_id;
end;
$$;

-- The door kiosk too, before it reads the visit, so last night's never makes tonight's scan a check-out. As in
-- 20261026100000_door_kiosk.sql, with that.
create or replace function private.door_scan(p_code text)
returns table (action text, first_name text, played_seconds bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.door_venue_id();
  v_member public.member;
  v_visit uuid;
  v_last public.visit;
begin
  if v_venue_id is null then
    raise exception 'Only a door kiosk scans members in and out' using errcode = '42501';
  end if;
  select * into v_member from public.member m where m.id = private.card_member(v_venue_id, p_code, now()) for update;
  perform private.close_stale_visit(v_member.id);
  v_visit := private.current_visit(v_member.id);
  if v_visit is not null and (select v.opened_at from public.visit v where v.id = v_visit) > now() - interval '2 minutes' then
    return query select 'in'::text, split_part(trim(v_member.full_name), ' ', 1), 0::bigint;
    return;
  end if;
  if v_visit is not null then
    perform private.leave_by_door(v_venue_id, v_member.id);
    return query select 'out'::text, split_part(trim(v_member.full_name), ' ', 1), h.o_played from private.visit_hours(v_visit) h;
    return;
  end if;
  select * into v_last from public.visit v where v.member_id = v_member.id and v.closed_at is not null order by v.closed_at desc limit 1;
  if v_last.closed_at > now() - interval '10 minutes' then
    return query select 'gone'::text, split_part(trim(v_member.full_name), ' ', 1), h.o_played from private.visit_hours(v_last.id) h;
    return;
  end if;
  perform private.open_visit(v_venue_id, v_member.id);
  return query select 'in'::text, split_part(trim(v_member.full_name), ' ', 1), 0::bigint;
end;
$$;

-- Seating a member nobody checked in opens their visit as check-in does: last night's closed first, and the check-in
-- promotions run. As in 20261019091800_seat_sessions.sql, through open_visit.
create or replace function private.start_seat_session(p_member_id uuid, p_table_id uuid, p_seat integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table := private.floor_table(p_table_id);
  v_visit uuid;
  v_id uuid;
begin
  select * into v_table from public.game_table t where t.id = v_table.id for no key update;
  if not v_table.is_open or p_seat is null or p_seat not between 1 and v_table.seats
     or not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = v_table.venue_id) then
    raise exception 'Seat a member of this venue at an open table, in a seat it has' using errcode = '22023';
  end if;
  perform private.assert_writable(v_table.venue_id, null, p_member_id);
  if not private.is_kyc_complete(p_member_id) then
    raise exception 'Finish the identity check to take a seat' using errcode = 'RVKYC';
  end if;
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: the member cannot be seated until it ends' using errcode = 'RVBRK';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  if exists (select 1 from public.seat_session s where s.member_id = p_member_id and s.ended_at is null) then
    raise exception 'Already seated: move the player instead' using errcode = 'RVSTD';
  end if;
  if private.is_seat_held(v_table.id, p_seat, p_member_id) then
    raise exception 'That seat is held for a member called from the waitlist' using errcode = 'RVHLD';
  end if;
  v_visit := private.open_visit(v_table.venue_id, p_member_id);
  begin
    insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, seated_by_staff_id)
    values (v_table.venue_id, p_member_id, v_visit, v_table.id, p_seat, private.current_staff_id(v_table.venue_id))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Someone sits in that seat' using errcode = 'RVOCC';
  end;
  return v_id;
end;
$$;

-- A down from an earlier night is no one's down tonight: the tablet asks for a dealer's sign-in, which ends it. As in
-- 20261019090800_dealer_sign_in.sql, with that.
create or replace function private.current_down()
returns table (down_id uuid, staff_id uuid, full_name text, started_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select dd.id, s.id, s.full_name, dd.started_at
  from public.dealer_down dd join public.staff s on s.id = dd.staff_id
  where dd.table_id = (select o_table_id from private.my_tablet_table()) and dd.ended_at is null
    and dd.started_at >= private.tonight_began(now());
$$;

-- A waiting place from an earlier night is on no list tonight: nobody at home is called. As in 20261029180000_waitlist_requests.sql, with that.
create or replace function private.ranked_waitlist(p_table_type_ids uuid[])
returns table (entry_id uuid, table_type_id uuid, member_id uuid, joined_at timestamptz, added_by_staff_id uuid,
               place integer, priority_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.table_type_id, e.member_id, e.joined_at, e.added_by_staff_id,
         row_number() over (partition by e.table_type_id order by coalesce(p.weight, 0) desc, e.joined_at, e.id)::integer,
         p.reason
  from public.waitlist_entry e
  left join lateral private.place_priority(e.member_id, e.table_type_id, e.joined_at) p on true
  where e.status = 'waiting' and e.approved_at is not null and e.table_type_id = any (p_table_type_ids)
    and e.joined_at >= private.tonight_began(now());
$$;
