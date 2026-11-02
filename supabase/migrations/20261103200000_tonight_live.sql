-- The redesigned Tonight (decision 0320). The seat card counts down to an absolute end, so a timer never ticks from data
-- that has gone stale (brief 5): call_time_ends_at is now plus the time left, null while away (the clock stands still) or
-- without call time. The card also names the seat's game and stakes. The join sheet's seat map reads which seat numbers
-- are taken at each table (brief 7.2): numbers only, never a name, so the TV-name choice has nothing to hide here.

-- As 20261102110100_seat_card_minimum_session.sql made it, with the end of the call time and the seat's game and stakes.
drop function public.my_seat();
drop function private.my_seat();
create function private.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint)
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
         t.name, t.small_blind_paise, t.big_blind_paise
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type t on t.id = g.table_type_id
  cross join lateral (select private.has_feature(s.member_id, 'call_time.view') as sees_call_time) f
  where s.member_id = private.current_member_id() and s.ended_at is null;
$$;
create function public.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_seat(); $$;

revoke execute on function private.my_seat(), public.my_seat() from public, anon;
grant execute on function private.my_seat(), public.my_seat() to authenticated;

-- The seat numbers taken at each table of the member's venue, as floor_open_seats counts them: a player in the seat, or a
-- seat held for a called member. With the live floor (floor.live_view), as the tables themselves.
create function private.floor_taken_seats()
returns table (table_id uuid, seat integer)
language sql
stable
security definer
set search_path = ''
as $$
  select taken.table_id, taken.seat
  from (
    select s.table_id, s.seat from public.seat_session s where s.ended_at is null
    union
    select e.call_table_id, e.call_seat from public.waitlist_entry e where e.status = 'waiting' and e.called_at is not null
  ) taken
  join public.game_table t on t.id = taken.table_id
  where t.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view');
$$;
create function public.floor_taken_seats()
returns table (table_id uuid, seat integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_taken_seats(); $$;

revoke execute on function private.floor_taken_seats(), public.floor_taken_seats() from public, anon;
grant execute on function private.floor_taken_seats(), public.floor_taken_seats() to authenticated;

-- Rate your visit names the night (brief 3.4 F): "Tonight · 2h 41m at Table 1". As 20261026100100_feedback.sql made it,
-- with the time played across the visit's seats and the table of its last.
drop function public.my_feedback_visit();
drop function private.my_feedback_visit();
create function private.my_feedback_visit()
returns table (visit_id uuid, closed_at timestamptz, played_seconds integer, table_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.closed_at,
         (select coalesce(sum(floor(extract(epoch from coalesce(s.ended_at, v.closed_at) - s.started_at))), 0)::integer
          from public.seat_session s where s.visit_id = v.id),
         (select g.name from public.seat_session s join public.game_table g on g.id = s.table_id
          where s.visit_id = v.id order by s.started_at desc limit 1)
  from (select * from public.visit v where v.member_id = (select private.current_member_id())
        order by v.opened_at desc limit 1) v
  where v.closed_at is not null and v.closed_at > now() - interval '7 days'
    and not exists (select 1 from public.feedback f where f.visit_id = v.id);
$$;
create function public.my_feedback_visit()
returns table (visit_id uuid, closed_at timestamptz, played_seconds integer, table_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_feedback_visit(); $$;

revoke execute on function private.my_feedback_visit(), public.my_feedback_visit() from public, anon;
grant execute on function private.my_feedback_visit(), public.my_feedback_visit() to authenticated;
