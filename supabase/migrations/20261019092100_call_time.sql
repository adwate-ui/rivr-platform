-- Call time (#78; features "Call time"; decision 0057): the minimum a player plays after being seated
-- before leaving. Each seat session keeps the call time in force when it began (the table type's
-- call_time.minutes) and the time spent away from the table, which does not count. A job every minute
-- emits call_time.completed once per session, and sends the member's session reminder (#56, decision
-- 0053) once they have been seated that long. The floor, the tablet and the player read the time left.

alter table public.seat_session
  add column call_time_minutes integer not null default 0 check (call_time_minutes between 0 and 1440),
  add column away_seconds integer not null default 0 check (away_seconds >= 0),
  add column call_time_completed_at timestamptz,
  add column reminded_at timestamptz;

-- A member reads their own sessions (#77), but their call time only through my_seat, behind call_time.view.
revoke select on public.seat_session from authenticated;
grant select (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, seated_by_staff_id,
              away_since, away_seconds, created_at, updated_at) on public.seat_session to authenticated;

-- @rivr/domain callTime in SQL, proved on the same golden file: whole seconds left, never below zero;
-- time away does not count, and after leaving the clock stands where it stopped.
create function private.call_time_left(p_minutes integer, p_seated_at timestamptz, p_away_seconds integer, p_away_since timestamptz,
                                       p_left_at timestamptz, p_at timestamptz)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(0, p_minutes * 60 - floor(extract(epoch from (e.end_at - p_seated_at)) - p_away_seconds
                                            - coalesce(greatest(0, extract(epoch from (e.end_at - p_away_since))), 0)))::integer
  from (select case when p_left_at is not null and p_left_at < p_at then p_left_at else p_at end as end_at) e;
$$;

-- A session's time left at `p_at`; null when its table type has no call time.
create function private.session_call_time(p_session public.seat_session, p_at timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when p_session.call_time_minutes > 0
              then private.call_time_left(p_session.call_time_minutes, p_session.started_at, p_session.away_seconds,
                                          p_session.away_since, p_session.ended_at, p_at) end;
$$;

-- Seating fixes the call time in force then, for the table type of the table.
create function private.seat_session_call_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.call_time_minutes := coalesce((private.setting_at(new.venue_id, 'call_time.minutes',
    (select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = new.table_id),
    new.started_at) ->> 'minutes')::integer, 0);
  return new;
end;
$$;
create trigger seat_session_call_time before insert on public.seat_session
  for each row execute function private.seat_session_call_time();

-- Back from away, or gone while away: the time away is added up, so it never counts.
create function private.seat_session_away_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.away_since is not null and new.away_since is null then
    new.away_seconds := old.away_seconds + greatest(0, floor(extract(epoch from (coalesce(new.ended_at, now()) - old.away_since))))::integer;
  end if;
  return new;
end;
$$;
create trigger seat_session_away_time before update of away_since on public.seat_session
  for each row execute function private.seat_session_away_time();

-- A player who leaves with their call time complete gets call_time.completed then, even if the
-- minute's sweep has not seen it yet. (Away time is added up first: triggers fire by name.)
create function private.seat_session_ended_call_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.ended_at is null and new.ended_at is not null and new.call_time_minutes > 0 and new.call_time_completed_at is null
     and private.call_time_left(new.call_time_minutes, new.started_at, new.away_seconds, new.away_since, new.ended_at, new.ended_at) = 0 then
    new.call_time_completed_at := new.ended_at;
    perform private.emit(new.venue_id, 'call_time.completed',
                         jsonb_build_object('session_id', new.id, 'member_id', new.member_id, 'table_id', new.table_id, 'seat', new.seat),
                         'call_time.completed:' || new.id);
  end if;
  return new;
end;
$$;
create trigger seat_session_ended_call_time before update of ended_at on public.seat_session
  for each row execute function private.seat_session_ended_call_time();

-- The time left on a member's open session, for the player's Home and the door (#82); null when not
-- seated or with no call time.
create function private.call_time_remaining(p_member_id uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.session_call_time(s, p_at) from public.seat_session s where s.member_id = p_member_id and s.ended_at is null;
$$;

-- What a member at the cage (#76) or the door (#82) still owes tonight: the time left on their open
-- session, or on the last one they left during their visit; 0 with none or outside a visit.
create function private.call_time_shortfall(p_member_id uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.session_call_time(s, p_at) from public.seat_session s
                   where s.member_id = p_member_id and s.visit_id = private.current_visit(p_member_id)
                   order by s.ended_at is null desc, s.ended_at desc limit 1), 0);
$$;

-- Every minute: call_time.completed once per session whose call time is complete, and the member's
-- session reminder once per session when they have been seated that long.
create function private.sweep_seated_time()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_due record;
begin
  for v_session in
    select * from public.seat_session s
    where s.ended_at is null and s.call_time_completed_at is null and s.call_time_minutes > 0 and private.session_call_time(s, now()) = 0
    for update skip locked
  loop
    update public.seat_session set call_time_completed_at = now() where id = v_session.id;
    perform private.emit(v_session.venue_id, 'call_time.completed',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                            'seat', v_session.seat), 'call_time.completed:' || v_session.id);
  end loop;
  for v_due in
    select s.id, s.venue_id, s.member_id, r.session_reminder_hours as hours from public.seat_session s
    cross join lateral private.member_restrictions(s.member_id, now()) r
    where s.ended_at is null and s.reminded_at is null and r.session_reminder_hours is not null
      and s.started_at + make_interval(hours => r.session_reminder_hours) <= now()
    for update of s skip locked
  loop
    update public.seat_session set reminded_at = now() where id = v_due.id;
    perform private.emit(v_due.venue_id, 'session.reminder',
                         jsonb_build_object('session_id', v_due.id, 'member_id', v_due.member_id, 'hours', v_due.hours),
                         'session.reminder:' || v_due.id);
  end loop;
end;
$$;

select cron.schedule('seated-time', '* * * * *', 'select private.sweep_seated_time()');

-- The seat map and the tablet's seats, now with the time left (null with no call time).
drop function public.floor_seats(uuid);
drop function private.floor_seats(uuid);
create function private.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz, call_time_left integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end,
         s.away_since, private.session_call_time(s, now())
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.member m on m.id = s.member_id
  join public.tier tr on tr.id = m.tier_id
  where s.venue_id = p_venue_id and s.ended_at is null and private.has_permission(p_venue_id, 'members.read')
  order by g.position, s.seat;
$$;
create function public.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz, call_time_left integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_seats(p_venue_id); $$;

drop function public.tablet_seats();
drop function private.tablet_seats();
create function private.tablet_seats()
returns table (seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamptz, minimum_paise bigint,
               pending_buy_in_paise bigint, call_time_left integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.seat, s.id, m.id, m.full_name, s.away_since, tt.buy_in_min_paise,
         (select r.amount_paise from public.buy_in_request r where r.session_id = s.id and r.status = 'waiting'),
         case when s.id is not null then private.session_call_time(s, now()) end
  from private.my_tablet_table() t
  join public.game_table g on g.id = t.o_table_id
  join public.table_type tt on tt.id = g.table_type_id
  cross join generate_series(1, g.seats) as n (seat)
  left join public.seat_session s on s.table_id = g.id and s.seat = n.seat and s.ended_at is null
  left join public.member m on m.id = s.member_id
  order by n.seat;
$$;
create function public.tablet_seats()
returns table (seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamptz, minimum_paise bigint,
               pending_buy_in_paise bigint, call_time_left integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.tablet_seats(); $$;

-- The signed-in member's seat tonight: where, whether away, whether it has call time, and with
-- call_time.view the time left.
create function private.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, s.seat, s.away_since is not null, s.call_time_minutes > 0,
         case when private.has_feature(s.member_id, 'call_time.view') then private.session_call_time(s, now()) end
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  where s.member_id = private.current_member_id() and s.ended_at is null;
$$;
create function public.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_seat(); $$;

revoke execute on function private.call_time_left(integer, timestamptz, integer, timestamptz, timestamptz, timestamptz),
  private.session_call_time(public.seat_session, timestamptz), private.seat_session_call_time(), private.seat_session_away_time(),
  private.seat_session_ended_call_time(), private.call_time_remaining(uuid, timestamptz),
  private.call_time_shortfall(uuid, timestamptz), private.sweep_seated_time() from public, anon, authenticated;
revoke execute on function private.floor_seats(uuid), private.tablet_seats(), private.my_seat() from public, anon;
grant execute on function private.floor_seats(uuid), private.tablet_seats(), private.my_seat() to authenticated;
revoke execute on function public.floor_seats(uuid), public.tablet_seats(), public.my_seat() from public, anon;
grant execute on function public.floor_seats(uuid), public.tablet_seats(), public.my_seat() to authenticated;
