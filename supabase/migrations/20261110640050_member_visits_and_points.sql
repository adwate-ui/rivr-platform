-- A member's visits and points on their record (8 Nov audit, I-71, F-017): each visit's day, tables, time played, whether the
-- call time owed was met and whether they left early; and the points ledger the member sees on Rewards, with who posted each line.
create function private.member_visits(p_venue_id uuid, p_member_id uuid, p_limit integer)
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, tables text, minutes_played integer, call_time_met boolean, left_early boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.opened_at, v.closed_at,
         -- A floor move overwrites the seat's table, so the tables it left are in seat_move.
         (select string_agg(t.name, ', ' order by t.name)
          from (select g.name from public.seat_session s join public.game_table g on g.id = s.table_id where s.visit_id = v.id
                union
                select g.name from public.seat_move mv
                join public.seat_session s on s.id = mv.session_id
                join public.game_table g on g.id = mv.from_table_id
                where s.visit_id = v.id) t),
         coalesce((select sum(private.minutes_played(s, now()))::integer from public.seat_session s where s.visit_id = v.id), 0),
         -- Null when no seat of the visit owed any call time, or while the seats that owe it are still running.
         (select bool_and(s.call_time_completed_at is not null) filter (where s.ended_at is not null or s.call_time_completed_at is not null)
          from public.seat_session s where s.visit_id = v.id and s.call_time_minutes > 0),
         -- A departure withdrawn as a mistake (decision 0500) does not count.
         exists (select 1 from public.early_departure e
                 where e.visit_id = v.id and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id))
  from public.visit v
  where v.member_id = p_member_id and v.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
  order by v.opened_at desc, v.id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$$;

-- For staff, private.points_history as it is: the lines the member sees, with who posted each. None once erased, as a free-text
-- reason can name the person.
create function private.member_points_history(p_venue_id uuid, p_member_id uuid, p_limit integer)
returns table (line_id uuid, at timestamptz, kind text, points bigint, reason text, staff_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.* from private.points_history(p_member_id, p_limit) h
  where exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id and m.erased_at is null)
    and coalesce(private.has_permission(p_venue_id, 'members.read'), false);
$$;

create function public.member_visits(p_venue_id uuid, p_member_id uuid, p_limit integer default 20)
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, tables text, minutes_played integer, call_time_met boolean, left_early boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_visits(p_venue_id, p_member_id, p_limit); $$;
create function public.member_points_history(p_venue_id uuid, p_member_id uuid, p_limit integer default 20)
returns table (line_id uuid, at timestamptz, kind text, points bigint, reason text, staff_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_points_history(p_venue_id, p_member_id, p_limit); $$;

revoke execute on function private.member_visits(uuid, uuid, integer), private.member_points_history(uuid, uuid, integer),
  public.member_visits(uuid, uuid, integer), public.member_points_history(uuid, uuid, integer) from public, anon;
grant execute on function private.member_visits(uuid, uuid, integer), private.member_points_history(uuid, uuid, integer),
  public.member_visits(uuid, uuid, integer), public.member_points_history(uuid, uuid, integer) to authenticated;
