-- Top-ups tonight and past name the member who asked (owner, 19 Nov: every member's name in the console opens their
-- account): `member_id` at the end of top_ups_tonight and top_up_history, the same member whose name each gives; none for an erased member. All four
-- functions are their live definitions with that column added; the grants are as they were.

drop function public.top_ups_tonight(uuid);
drop function private.top_ups_tonight(uuid);
drop function public.top_up_history(uuid, date, integer, integer);
drop function private.top_up_history(uuid, date, integer, integer);

create function private.top_ups_tonight(p_venue_id uuid)
returns table (request_id uuid, session_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               fulfilled_seconds integer, accepted_by text, accepted_seconds integer, done_by text, done_seconds integer, member_id uuid)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.session_id, g.name, case when s.ended_at is null then s.seat else r.seat end, m.full_name,
         case when r.outcome is not null then r.outcome
              when s.ended_at is not null then 'left'
              when r.started_at is not null then 'in_progress'
              else 'requested' end,
         r.requested_at,
         case when r.outcome = 'fulfilled' then floor(extract(epoch from r.closed_at - r.requested_at))::integer end,
         sb.full_name, floor(extract(epoch from r.started_at - r.requested_at))::integer,
         case when r.outcome = 'fulfilled' then cb.full_name end,
         case when r.outcome = 'fulfilled' then floor(extract(epoch from r.closed_at - r.started_at))::integer end,
         case when m.erased_at is null then m.id end
  from public.top_up_request r
  join public.seat_session s on s.id = r.session_id
  join public.member m on m.id = s.member_id
  join public.game_table g on g.id = case when s.ended_at is null then s.table_id else r.table_id end
  left join public.staff sb on sb.id = r.started_by_staff_id
  left join public.staff cb on cb.id = r.closed_by_staff_id
  where r.venue_id = p_venue_id and private.may_handle_top_ups(p_venue_id)
    and coalesce(r.closed_at, s.ended_at, now()) > private.tonight_began(now())
  order by g.position, r.requested_at desc;
$$;

create function public.top_ups_tonight(p_venue_id uuid)
returns table (request_id uuid, session_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               fulfilled_seconds integer, accepted_by text, accepted_seconds integer, done_by text, done_seconds integer, member_id uuid)
language sql stable security invoker set search_path = ''
as $$ select * from private.top_ups_tonight(p_venue_id); $$;

create function private.top_up_history(p_venue_id uuid, p_day date, p_page integer, p_page_size integer)
returns table (request_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz, accepted_by text,
               accepted_seconds integer, done_by text, done_seconds integer, total bigint, member_id uuid)
language sql stable security definer set search_path = ''
as $$
  select r.id, g.name, r.seat, m.full_name,
         case when r.outcome is not null then r.outcome
              when s.ended_at is not null then 'left'
              when r.started_at is not null then 'in_progress'
              else 'requested' end,
         r.requested_at,
         sb.full_name, floor(extract(epoch from r.started_at - r.requested_at))::integer,
         case when r.outcome = 'fulfilled' then cb.full_name end,
         case when r.outcome = 'fulfilled' then floor(extract(epoch from r.closed_at - r.started_at))::integer end,
         count(*) over (),
         case when m.erased_at is null then m.id end
  from public.top_up_request r
  join public.seat_session s on s.id = r.session_id
  join public.member m on m.id = r.member_id
  join public.game_table g on g.id = r.table_id
  left join public.staff sb on sb.id = r.started_by_staff_id
  left join public.staff cb on cb.id = r.closed_by_staff_id
  where r.venue_id = p_venue_id and private.may_handle_top_ups(p_venue_id) and p_day is not null
    and r.requested_at >= (p_day::timestamp + interval '6 hours') at time zone 'Asia/Kolkata'
    and r.requested_at < ((p_day + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata'
  order by r.requested_at desc, r.id
  limit greatest(least(coalesce(p_page_size, 50), 200), 1)
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(least(coalesce(p_page_size, 50), 200), 1);
$$;

create function public.top_up_history(p_venue_id uuid, p_day date, p_page integer default 1, p_page_size integer default 50)
returns table (request_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz, accepted_by text,
               accepted_seconds integer, done_by text, done_seconds integer, total bigint, member_id uuid)
language sql stable security invoker set search_path = ''
as $$ select * from private.top_up_history(p_venue_id, p_day, p_page, p_page_size); $$;

revoke execute on function private.top_ups_tonight(uuid), public.top_ups_tonight(uuid),
  private.top_up_history(uuid, date, integer, integer), public.top_up_history(uuid, date, integer, integer) from public, anon;
grant execute on function private.top_ups_tonight(uuid), public.top_ups_tonight(uuid),
  private.top_up_history(uuid, date, integer, integer), public.top_up_history(uuid, date, integer, integer) to authenticated;
