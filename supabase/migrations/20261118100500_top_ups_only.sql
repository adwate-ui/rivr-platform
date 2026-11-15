-- A sign-in that sees only top-up requests (redesign of 15 Nov 2026, RD-32; the owner, 15 Nov): guest relations accept a
-- member's request for a top-up and mark it done, as the floor does, and read who accepted each, who marked it done and how
-- long each step took. They hold one permission, top_ups.manage, which no policy on any table names: every read and every
-- change goes through the functions below, and nothing else in the venue is theirs to read. Admins hold it too, so that
-- they can give the role (private.can_grant_role); the floor, hosts and cashiers go on handling top-ups by
-- waitlist.manage, as before.
insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['top_ups.manage']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['top_ups.manage']) as permission;
insert into public.role_permission (role, permission)
select 'guest_relations', permission from unnest(array['top_ups.manage']) as permission;

-- Who handles a venue's top-ups: the floor's staff as before, and staff who hold top_ups.manage.
create function private.may_handle_top_ups(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.has_permission(p_venue_id, 'waitlist.manage'), false) or coalesce(private.has_permission(p_venue_id, 'top_ups.manage'), false);
$$;
revoke execute on function private.may_handle_top_ups(uuid) from public, anon, authenticated;

-- Tonight's requests, as 20261102100200_top_ups_page.sql left them, for whoever handles top-ups, and with who accepted
-- each and who marked it done, and the seconds each step took: asked to accepted, accepted to done. What a function
-- returns cannot be changed in place, so it is dropped and made again, with its grants.
drop function public.top_ups_tonight(uuid);
drop function private.top_ups_tonight(uuid);
create function private.top_ups_tonight(p_venue_id uuid)
returns table (request_id uuid, session_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               fulfilled_seconds integer, accepted_by text, accepted_seconds integer, done_by text, done_seconds integer)
language sql
stable
security definer
set search_path = ''
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
         case when r.outcome = 'fulfilled' then floor(extract(epoch from r.closed_at - r.started_at))::integer end
  from public.top_up_request r
  join public.seat_session s on s.id = r.session_id
  join public.member m on m.id = s.member_id
  join public.game_table g on g.id = case when s.ended_at is null then s.table_id else r.table_id end
  left join public.staff sb on sb.id = r.started_by_staff_id
  left join public.staff cb on cb.id = r.closed_by_staff_id
  where r.venue_id = p_venue_id and private.may_handle_top_ups(p_venue_id)
    and coalesce(r.closed_at, s.ended_at, now()) >= private.tonight_began(now())
  order by g.position, r.requested_at desc;
$$;

create function public.top_ups_tonight(p_venue_id uuid)
returns table (request_id uuid, session_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               fulfilled_seconds integer, accepted_by text, accepted_seconds integer, done_by text, done_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.top_ups_tonight(p_venue_id); $$;

revoke execute on function private.top_ups_tonight(uuid), public.top_ups_tonight(uuid) from public, anon;
grant execute on function private.top_ups_tonight(uuid), public.top_ups_tonight(uuid) to authenticated;

-- A club day's requests, the newest first, a page at a time, each row with how many the day has. The day is the club's,
-- 06:00 to 06:00 in India, and the index on (venue_id, requested_at) finds it.
create function private.top_up_history(p_venue_id uuid, p_day date, p_page integer, p_page_size integer)
returns table (request_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               accepted_by text, accepted_seconds integer, done_by text, done_seconds integer, total bigint)
language sql
stable
security definer
set search_path = ''
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
         count(*) over ()
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
returns table (request_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               accepted_by text, accepted_seconds integer, done_by text, done_seconds integer, total bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.top_up_history(p_venue_id, p_day, p_page, p_page_size); $$;

revoke execute on function private.top_up_history(uuid, date, integer, integer), public.top_up_history(uuid, date, integer, integer) from public, anon;
grant execute on function private.top_up_history(uuid, date, integer, integer), public.top_up_history(uuid, date, integer, integer) to authenticated;

-- Taking a top-up in hand, finishing or resetting it, as 20261101090300_top_up_requests.sql left it, for whoever handles top-ups.
create or replace function private.set_top_up(p_session_id uuid, p_in_progress boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_staff_id uuid;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.may_handle_top_ups(v_session.venue_id) then
    raise exception 'Only the floor and guest relations handle top-ups' using errcode = '42501';
  end if;
  if v_session.ended_at is not null or p_in_progress is null or (p_in_progress and v_session.top_up_requested_at is null) then
    raise exception 'No top-up to take in hand' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  v_staff_id := private.current_staff_id(v_session.venue_id);
  update public.seat_session
  set top_up_started_at = case when p_in_progress then coalesce(top_up_started_at, now()) end,
      top_up_requested_at = case when p_in_progress then top_up_requested_at end
  where id = v_session.id;
  if p_in_progress then
    update public.top_up_request set started_at = coalesce(started_at, now()), started_by_staff_id = coalesce(started_by_staff_id, v_staff_id)
    where session_id = v_session.id and closed_at is null;
  else
    update public.top_up_request
    set closed_at = now(), closed_by_staff_id = v_staff_id, outcome = case when started_at is not null then 'fulfilled' else 'reset' end
    where session_id = v_session.id and closed_at is null;
  end if;
end;
$$;

-- Undoing a top-up's last step, as 20261107320000_floor_undo.sql left it, for whoever handles top-ups.
create or replace function private.undo_top_up(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.top_up_request;
  v_session public.seat_session;
begin
  select * into v_request from public.top_up_request r where r.id = p_request_id for update;
  if v_request.id is null or not private.may_handle_top_ups(v_request.venue_id) then
    raise exception 'Only the floor and guest relations undo a top-up' using errcode = '42501';
  end if;
  perform private.assert_writable(v_request.venue_id, null, v_request.member_id);
  select * into v_session from public.seat_session s where s.id = v_request.session_id for update;
  if v_session.ended_at is null and v_request.closed_at is not null and v_request.outcome in ('fulfilled', 'reset')
     and private.is_undoable(v_request.closed_at)
     and not exists (select 1 from public.top_up_request o where o.session_id = v_session.id and o.closed_at is null) then
    update public.top_up_request set closed_at = null, outcome = null, closed_by_staff_id = null where id = v_request.id;
    update public.seat_session set top_up_requested_at = v_request.requested_at, top_up_started_at = v_request.started_at
    where id = v_session.id;
  elsif v_session.ended_at is null and v_request.closed_at is null and private.is_undoable(v_request.started_at) then
    update public.top_up_request set started_at = null, started_by_staff_id = null where id = v_request.id;
    update public.seat_session set top_up_started_at = null where id = v_session.id;
  else
    raise exception 'Only a top-up step of the last two minutes, while seated, is undone' using errcode = '22023';
  end if;
end;
$$;
