-- The member's seat card (owner, 2 Nov; decision 0300): "When SEATED on a table, options should be: Playing since: / Add
-- call time: 1 h + MINIMUM session time rule", and "Add 1 h" works throughout the session. An hour more is the later of the
-- call time and the whole minutes played (time away left out), plus 60, as @rivr/domain/callTime extendedCallTimeMinutes
-- has it: past the call time, the member commits to an hour from now. Still at most a day. And the card reads the call
-- time the floor gave, its minimum session.

-- As 20261029170000_seat_self_service.sql made it, at any time while seated. Refusals: 42501 without call_time.view;
-- 22023 not seated, or past a day.
create or replace function private.extend_my_call_time()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
  v_played integer;
  v_minutes integer;
begin
  if not private.has_feature(v_session.member_id, 'call_time.view') then
    raise exception 'Call time is not open to you' using errcode = '42501';
  end if;
  v_played := floor(extract(epoch from now() - v_session.started_at))::integer - v_session.away_seconds
              - coalesce(floor(extract(epoch from now() - v_session.away_since))::integer, 0);
  v_minutes := greatest(v_session.call_time_minutes, greatest(v_played, 0) / 60) + 60;
  if v_minutes > 1440 then
    raise exception 'Call time is at most a day' using errcode = '22023';
  end if;
  update public.seat_session set call_time_minutes = v_minutes, call_time_completed_at = null where id = v_session.id;
end;
$$;

-- As 20261029170000_seat_self_service.sql made it, with when the member sat down and the call time the floor gave, in
-- minutes (0 for none).
drop function public.my_seat();
drop function private.my_seat();
create function private.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, s.seat, s.away_since is not null, s.call_time_minutes > 0,
         case when private.has_feature(s.member_id, 'call_time.view') then private.session_call_time(s, now()) end,
         floor(extract(epoch from now() - s.started_at))::integer, s.leaving_at is not null, private.top_up_state(s),
         case when private.has_feature(s.member_id, 'call_time.view') then s.call_time_minutes end, s.started_at
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  where s.member_id = private.current_member_id() and s.ended_at is null;
$$;
create function public.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_seat(); $$;

revoke execute on function private.my_seat(), public.my_seat() from public, anon;
grant execute on function private.my_seat(), public.my_seat() to authenticated;
