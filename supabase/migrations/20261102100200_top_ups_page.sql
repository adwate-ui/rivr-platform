-- Top-ups on a page of their own (owner, 2 Nov; decision 0299): "TOPUP as a separate page. SHOW RED MARKERS for pending top
-- up requests. And a counter since requested. TAT is 60 seconds." The page starts, finishes and resets a request from its
-- line, so tonight's requests carry the seat session set_top_up takes. As 20261101090300_top_up_requests.sql otherwise.
drop function public.top_ups_tonight(uuid);
drop function private.top_ups_tonight(uuid);

create function private.top_ups_tonight(p_venue_id uuid)
returns table (request_id uuid, session_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               fulfilled_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.session_id, g.name, r.seat, m.full_name,
         case when r.outcome is not null then r.outcome
              when s.ended_at is not null then 'left'
              when r.started_at is not null then 'in_progress'
              else 'requested' end,
         r.requested_at,
         case when r.outcome = 'fulfilled' then floor(extract(epoch from r.closed_at - r.requested_at))::integer end
  from public.top_up_request r
  join public.seat_session s on s.id = r.session_id
  join public.member m on m.id = s.member_id
  join public.game_table g on g.id = r.table_id
  where r.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
    and coalesce(r.closed_at, now()) >= private.tonight_began(now())
  order by g.position, r.requested_at desc;
$$;
create function public.top_ups_tonight(p_venue_id uuid)
returns table (request_id uuid, session_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               fulfilled_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.top_ups_tonight(p_venue_id); $$;

revoke execute on function private.top_ups_tonight(uuid), public.top_ups_tonight(uuid) from public, anon;
grant execute on function private.top_ups_tonight(uuid), public.top_ups_tonight(uuid) to authenticated;
