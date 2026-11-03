-- The Live floor's requests panel (console v3, phase 2; decision 0479): one read of everything that waits on the floor,
-- oldest first, each with when it began, so its age can turn late past the club's target.
-- 1. floor_requests: join requests, top-ups (asked for or in hand), time requests, players leaving, and players who left
--    their seat before its call time (the last only for staff who let a player go early, call_time.override).
-- 2. The targets are the club's setting floor.request_targets (seconds); unset, @rivr/domain's defaults apply.

insert into public.setting_key (key, description, scope, value_schema) values
  ('floor.request_targets',
   'How long a request may wait on the Live floor before it shows late: a top-up, and every other request, in seconds.',
   'venue',
   '{"type":"object","properties":{"top_up_seconds":{"type":"integer","minimum":30,"maximum":1800},"other_seconds":{"type":"integer","minimum":60,"maximum":3600}},"required":["top_up_seconds","other_seconds"],"additionalProperties":false}');

-- Everything that waits on the floor, oldest first. `request_id` is what the floor acts on: the waitlist place, the top-up
-- request, the time request, the seat session (leaving) or the member (left before call time).
create function private.floor_requests(p_venue_id uuid)
returns table (kind text, request_id uuid, session_id uuid, member_id uuid, full_name text, table_id uuid, seat integer,
               since timestamptz, minutes integer, call_time_left integer, top_up text, owed_seconds integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the floor reads its requests' using errcode = '42501';
  end if;
  return query
  select r.* from (
    select 'join'::text, w.entry_id, null::uuid, w.member_id, w.full_name, w.table_id, null::integer, w.joined_at,
           null::integer, null::integer, null::text, null::integer
    from private.waitlist_requests(p_venue_id) w
    union all
    select 'top_up', t.id, s.id, s.member_id, m.full_name, s.table_id, s.seat, t.requested_at,
           null, private.session_call_time(s, now()), private.top_up_state(s), null
    from public.seat_session s
    join public.member m on m.id = s.member_id
    join public.top_up_request t on t.session_id = s.id and t.closed_at is null
    where s.venue_id = p_venue_id and s.ended_at is null and s.top_up_requested_at is not null
    union all
    select 'time', c.id, s.id, s.member_id, m.full_name, s.table_id, s.seat, c.requested_at,
           c.minutes, private.session_call_time(s, now()), null, null
    from public.call_time_request c
    join public.seat_session s on s.id = c.session_id and s.ended_at is null
    join public.member m on m.id = s.member_id
    where c.venue_id = p_venue_id and c.status = 'requested'
    union all
    select 'leaving', s.id, s.id, s.member_id, m.full_name, s.table_id, s.seat, s.leaving_at,
           null, private.session_call_time(s, now()), null, null
    from public.seat_session s
    join public.member m on m.id = s.member_id
    where s.venue_id = p_venue_id and s.ended_at is null and s.leaving_at is not null
    union all
    -- As left_owing_call_time: still in the room, their last seat ended owing, and nobody let them go yet.
    select 'left_owing', v.member_id, s.id, v.member_id, m.full_name, s.table_id, s.seat, s.ended_at,
           null, null, null, o.o_seconds
    from public.visit v
    join public.member m on m.id = v.member_id
    cross join lateral private.call_time_owed(v.member_id, now()) o
    join public.seat_session s on s.id = o.o_session_id
    where v.venue_id = p_venue_id and v.closed_at is null and s.ended_at is not null and o.o_seconds > 0
      and not exists (select 1 from public.early_departure e where e.session_id = o.o_session_id)
      and private.has_permission(p_venue_id, 'call_time.override')
  ) as r (kind, request_id, session_id, member_id, full_name, table_id, seat, since, minutes, call_time_left, top_up, owed_seconds)
  order by r.since, r.request_id;
end;
$$;

create function public.floor_requests(p_venue_id uuid)
returns table (kind text, request_id uuid, session_id uuid, member_id uuid, full_name text, table_id uuid, seat integer,
               since timestamptz, minutes integer, call_time_left integer, top_up text, owed_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_requests(p_venue_id); $$;

-- The club's targets for the floor, in seconds; null where the club has set none, so @rivr/domain's defaults apply.
create function private.floor_request_targets(p_venue_id uuid)
returns table (top_up_seconds integer, other_seconds integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value jsonb;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the floor reads its targets' using errcode = '42501';
  end if;
  v_value := private.setting_at(p_venue_id, 'floor.request_targets', '', now());
  return query select (v_value ->> 'top_up_seconds')::integer, (v_value ->> 'other_seconds')::integer;
end;
$$;

create function public.floor_request_targets(p_venue_id uuid)
returns table (top_up_seconds integer, other_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_request_targets(p_venue_id); $$;

revoke execute on function private.floor_requests(uuid), private.floor_request_targets(uuid) from public, anon;
grant execute on function private.floor_requests(uuid), private.floor_request_targets(uuid) to authenticated;
revoke execute on function public.floor_requests(uuid), public.floor_request_targets(uuid) from public, anon;
grant execute on function public.floor_requests(uuid), public.floor_request_targets(uuid) to authenticated;
