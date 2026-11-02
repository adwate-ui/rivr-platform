-- Add time as a request the floor approves (brief 3.4 E and 7.1; owner, 3 Nov). From the seat a member asks for 30 min,
-- 1 hour or 2 hours; the floor approves or declines it beside the seat's top-up, and on approval the seat's call time
-- grows. It replaces the app's fixed "Add 1 h" (extend_my_call_time, kept but no longer called by the app).
--
-- The rule (@rivr/domain/callTime extendedCallTime, proved equal on packages/testing/golden/callTimeExtension.json in
-- 024): a choice of 30, 60 or 120 minutes, added to a call time the seat has (more than nought), up to a day (1,440
-- minutes) in all; anything else is refused. Approving after the call time completed leaves call_time_completed_at as it
-- was: the completion it recorded, its event and the promotion condition it met stand, and no second completion is sent.

create function private.extended_call_time(p_current integer, p_add integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_add in (30, 60, 120) and p_current > 0 and p_current + p_add <= 1440 then p_current + p_add end;
$$;

-- The 15-minute warning (call_time.ending), sent once a call time; time added clears it, so the new end is warned of too.
alter table public.seat_session add column ending_warned_at timestamptz;
comment on column public.seat_session.ending_warned_at is 'When the call time''s 15-minute warning went (decision 0320); cleared as time is added.';
insert into private.member_export_column (table_name, column_name, kind) values ('seat_session', 'ending_warned_at', 'owed');

create table public.call_time_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  session_id uuid not null references public.seat_session (id),
  minutes integer not null check (minutes in (30, 60, 120)),
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined')),
  idempotency_key uuid not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id),
  unique (venue_id, idempotency_key),
  check ((status = 'requested') = (decided_at is null)),
  check (decided_at is null or decided_at >= requested_at)
);
comment on table public.call_time_request is 'More call time a member asked for from the seat, which the floor approves or declines (decision 0320).';
-- One request open a seat at a time: a second tap waits on the first.
create unique index call_time_request_open_idx on public.call_time_request (session_id) where status = 'requested';
create index call_time_request_venue_idx on public.call_time_request (venue_id, requested_at);
create index call_time_request_member_idx on public.call_time_request (member_id, venue_id);
create index call_time_request_decided_by_idx on public.call_time_request (decided_by_staff_id, venue_id);
create trigger call_time_request_touch_updated_at before update on public.call_time_request
  for each row execute function private.touch_updated_at();

alter table public.call_time_request enable row level security;
-- Read through my_seat and floor_seats; written only by the functions below.
revoke all on public.call_time_request from anon, authenticated;

insert into private.member_export_column (table_name, column_name, kind)
select 'call_time_request', c, 'owed' from unnest(array['id', 'venue_id', 'member_id', 'session_id', 'minutes', 'status', 'idempotency_key',
  'requested_at', 'decided_at', 'decided_by_staff_id', 'created_at', 'updated_at']) as c;

-- The member asks: seated, with call time open to them, a choice the rule allows. The same request id asks once; while one
-- request waits, another tap gives that one back.
create function private.request_call_time(p_minutes integer, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
  v_id uuid;
begin
  if not private.has_feature(v_session.member_id, 'call_time.view') then
    raise exception 'Call time is not open to you' using errcode = '42501';
  end if;
  select r.id into v_id from public.call_time_request r
  where r.venue_id = v_session.venue_id and r.idempotency_key = p_idempotency_key and r.member_id = v_session.member_id;
  if v_id is not null then return v_id; end if;
  select r.id into v_id from public.call_time_request r where r.session_id = v_session.id and r.status = 'requested';
  if v_id is not null then return v_id; end if;
  if private.extended_call_time(v_session.call_time_minutes, p_minutes) is null then
    raise exception 'Call time is added in 30, 60 or 120 minutes, to a call time, up to a day' using errcode = '22023';
  end if;
  insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key)
  values (v_session.venue_id, v_session.member_id, v_session.id, p_minutes, p_idempotency_key)
  returning id into v_id;
  return v_id;
end;
$$;
create function public.request_call_time(p_minutes integer, p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.request_call_time(p_minutes, p_idempotency_key); $$;

-- The floor decides, once: approved, the seat's call time grows by the minutes asked for and its 15-minute warning is
-- owed again (call_time.updated tells the member's devices); declined, nothing changes.
create function private.decide_call_time_request(p_request_id uuid, p_is_approved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.call_time_request;
  v_session public.seat_session;
  v_minutes integer;
begin
  select * into v_request from public.call_time_request r where r.id = p_request_id for update;
  if v_request.id is null or not private.has_permission(v_request.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor decides call time' using errcode = '42501';
  end if;
  perform private.assert_writable(v_request.venue_id);
  select * into v_session from public.seat_session s where s.id = v_request.session_id for update;
  if v_request.status <> 'requested' or p_is_approved is null or v_session.ended_at is not null then
    raise exception 'A request is decided once, while the member is seated' using errcode = '22023';
  end if;
  if p_is_approved then
    v_minutes := private.extended_call_time(v_session.call_time_minutes, v_request.minutes);
    if v_minutes is null then
      raise exception 'Call time is at most a day' using errcode = '22023';
    end if;
    update public.seat_session set call_time_minutes = v_minutes, ending_warned_at = null where id = v_session.id;
    perform private.emit(v_request.venue_id, 'call_time.updated',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'minutes', v_minutes),
                         'call_time.updated:' || v_request.id);
  end if;
  update public.call_time_request
  set status = case when p_is_approved then 'approved' else 'declined' end, decided_at = now(),
      decided_by_staff_id = private.current_staff_id(v_request.venue_id)
  where id = v_request.id;
end;
$$;
create function public.decide_call_time_request(p_request_id uuid, p_is_approved boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.decide_call_time_request(p_request_id, p_is_approved); $$;

revoke execute on function private.extended_call_time(integer, integer), private.request_call_time(integer, uuid),
  public.request_call_time(integer, uuid), private.decide_call_time_request(uuid, boolean), public.decide_call_time_request(uuid, boolean)
  from public, anon;
grant execute on function private.request_call_time(integer, uuid), public.request_call_time(integer, uuid),
  private.decide_call_time_request(uuid, boolean), public.decide_call_time_request(uuid, boolean) to authenticated;

-- As 20261103200000_tonight_live.sql made it, with the minutes of a request for more call time the floor has not decided.
drop function public.my_seat();
drop function private.my_seat();
create function private.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint, time_request_minutes integer)
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
         t.name, t.small_blind_paise, t.big_blind_paise,
         (select r.minutes from public.call_time_request r where r.session_id = s.id and r.status = 'requested')
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type t on t.id = g.table_type_id
  cross join lateral (select private.has_feature(s.member_id, 'call_time.view') as sees_call_time) f
  where s.member_id = private.current_member_id() and s.ended_at is null;
$$;
create function public.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamptz, call_time_ends_at timestamptz,
               table_type_name text, small_blind_paise bigint, big_blind_paise bigint, time_request_minutes integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_seat(); $$;

revoke execute on function private.my_seat(), public.my_seat() from public, anon;
grant execute on function private.my_seat(), public.my_seat() to authenticated;

-- As 20261029170000_seat_self_service.sql made it, with a seat's request for more call time the floor has not decided.
drop function public.floor_seats(uuid);
drop function private.floor_seats(uuid);
create function private.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz, call_time_left integer, leaving_at timestamptz,
               top_up text, time_request_id uuid, time_request_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end,
         s.away_since, private.session_call_time(s, now()), s.leaving_at, private.top_up_state(s), r.id, r.minutes
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.member m on m.id = s.member_id
  join public.tier tr on tr.id = m.tier_id
  left join public.call_time_request r on r.session_id = s.id and r.status = 'requested'
  where s.venue_id = p_venue_id and s.ended_at is null and private.has_permission(p_venue_id, 'members.read')
  order by g.position, s.seat;
$$;
create function public.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz, call_time_left integer, leaving_at timestamptz,
               top_up text, time_request_id uuid, time_request_minutes integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_seats(p_venue_id); $$;

revoke execute on function private.floor_seats(uuid), public.floor_seats(uuid) from public, anon;
grant execute on function private.floor_seats(uuid), public.floor_seats(uuid) to authenticated;

-- The practice venue's seed keeps the new column (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
