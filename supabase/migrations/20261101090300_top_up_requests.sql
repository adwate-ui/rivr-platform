-- Top-up requests (#639; owner's feedback doc of 29 Oct): each one a member asks for from the seat (#634) is kept, so the
-- floor and the cashier see tonight's by table, with its status and how long it took to fulfil. Still no amount.

-- One request, from asking to its close: fulfilled when the floor resets one it took in hand, reset when it never was.
create table public.top_up_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  session_id uuid not null references public.seat_session (id),
  table_id uuid not null,
  seat integer not null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  started_by_staff_id uuid,
  closed_at timestamptz,
  closed_by_staff_id uuid,
  outcome text check (outcome in ('fulfilled', 'reset')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (started_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (closed_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((closed_at is null) = (outcome is null)),
  check (started_at is null or started_at >= requested_at),
  check (outcome is distinct from 'fulfilled' or started_at is not null)
);
comment on table public.top_up_request is 'A top-up a member asked for from the seat (#634), from asking to fulfilled or reset (#639).';
create unique index top_up_request_open_idx on public.top_up_request (session_id) where closed_at is null;
create index top_up_request_venue_idx on public.top_up_request (venue_id, requested_at);
create index top_up_request_table_idx on public.top_up_request (table_id, venue_id);
create index top_up_request_member_idx on public.top_up_request (member_id, venue_id);
create index top_up_request_started_by_idx on public.top_up_request (started_by_staff_id, venue_id);
create index top_up_request_closed_by_idx on public.top_up_request (closed_by_staff_id, venue_id);
create trigger top_up_request_touch_updated_at before update on public.top_up_request
  for each row execute function private.touch_updated_at();

alter table public.top_up_request enable row level security;
-- Read through top_ups_tonight; written only by the functions below.
revoke all on public.top_up_request from anon, authenticated;

-- A member's export (#498) lists every column: their requests are theirs.
insert into private.member_export_column (table_name, column_name, kind)
select 'top_up_request', c, 'owed' from unnest(array['id', 'venue_id', 'member_id', 'session_id', 'table_id', 'seat', 'requested_at', 'started_at',
  'started_by_staff_id', 'closed_at', 'closed_by_staff_id', 'outcome', 'created_at', 'updated_at']) as c;

-- As in 20261029170000_seat_self_service.sql, with the request kept.
create or replace function private.request_top_up()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
begin
  if not private.has_feature(v_session.member_id, 'table.top_up') then
    raise exception 'Top-up requests are not open to you' using errcode = '42501';
  end if;
  if v_session.top_up_requested_at is not null then return; end if;
  update public.seat_session set top_up_requested_at = now() where id = v_session.id;
  insert into public.top_up_request (venue_id, member_id, session_id, table_id, seat)
  values (v_session.venue_id, v_session.member_id, v_session.id, v_session.table_id, v_session.seat);
end;
$$;

-- As in 20261029170000_seat_self_service.sql, with the request kept: taken in hand, then closed as fulfilled or reset.
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
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor handles top-ups' using errcode = '42501';
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

-- Tonight's top-up requests at the venue (closed tonight, or still open), by table then newest first, for staff who read
-- members (the floor and the
-- cashier): who and where, the status (requested, in progress, fulfilled, reset, or left: the player left with it open)
-- and, once fulfilled, the seconds from asking to done.
create function private.top_ups_tonight(p_venue_id uuid)
returns table (request_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               fulfilled_seconds integer)
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
returns table (request_id uuid, table_name text, seat integer, full_name text, status text, requested_at timestamptz,
               fulfilled_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.top_ups_tonight(p_venue_id); $$;

revoke execute on function private.top_ups_tonight(uuid), public.top_ups_tonight(uuid) from public, anon;
grant execute on function private.top_ups_tonight(uuid), public.top_ups_tonight(uuid) to authenticated;
