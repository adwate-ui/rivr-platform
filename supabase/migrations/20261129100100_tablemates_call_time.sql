-- A seated member sees the call time of the others at their table (the owner, 22 Nov): each one's seat, first name and
-- call time, "Seat 3 · Ritika · until 23:40" or "Not set". Never the full name or the member number; no name at all for a
-- member who keeps it off the TVs. Only for a member who sees their own call time (call_time.view).
--
-- `call_time` is not_set (none set yet, or a seat with no call time), away (the clock stands still), done (run out) or
-- until, with `ends_at` when it ends.
create function private.my_tablemates()
returns table (seat integer, first_name text, call_time text, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.seat,
         case when coalesce(p.name_on_tvs, true) then nullif(split_part(btrim(m.full_name), ' ', 1), '') end,
         case when o.call_time_set_at is null or o.call_time_minutes <= 0 then 'not_set'
              when o.away_since is not null then 'away'
              when private.session_call_time(o, now()) <= 0 then 'done'
              else 'until' end,
         case when o.call_time_set_at is not null and o.call_time_minutes > 0 and o.away_since is null and private.session_call_time(o, now()) > 0
              then now() + make_interval(secs => private.session_call_time(o, now())) end
  from public.seat_session s
  join public.seat_session o on o.table_id = s.table_id and o.ended_at is null and o.id <> s.id
  join public.member m on m.id = o.member_id
  left join public.member_preference p on p.member_id = o.member_id
  where s.member_id = private.current_member_id() and s.ended_at is null
    and private.has_feature(s.member_id, 'call_time.view')
  order by o.seat;
$$;
revoke all on function private.my_tablemates() from public, anon;
grant execute on function private.my_tablemates() to authenticated;
create function public.my_tablemates()
returns table (seat integer, first_name text, call_time text, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$ select * from private.my_tablemates(); $$;
revoke all on function public.my_tablemates() from public, anon;
grant execute on function public.my_tablemates() to authenticated;
