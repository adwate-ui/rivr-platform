-- The member's seat card (owner, 2 Nov; decision 0300): "When SEATED on a table, options should be: Playing since: / Add
-- call time: 1 h + MINIMUM session time rule". The card reads when the member sat down and the call time the floor gave,
-- their minimum session. Add time itself becomes a request the floor approves, in the player redesign (owner, 3 Nov).

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
