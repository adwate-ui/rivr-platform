-- Seat events from the dealer tablet (#59; scope-v1 module 4; design prompt flow 3): the dealer taps
-- a seat on the tablet's ring and asks the cage for a buy-in for that player (private.request_buy_in,
-- #57), marks the player away or back, or that they left. The tablet acts only at its own table; the
-- floor (waitlist.manage) may do the same anywhere.

alter table public.seat_session add column away_since timestamptz;
alter table public.seat_session add constraint seat_session_away check (away_since is null or ended_at is null);

-- A buy-in still with the cage when its player leaves is withdrawn (decision 0056): decided, by nobody.
alter table public.buy_in_request
  drop constraint buy_in_request_status,
  drop constraint buy_in_request_decided,
  add constraint buy_in_request_status check (status in ('waiting', 'approved', 'declined', 'withdrawn')),
  add constraint buy_in_request_decided check ((status = 'waiting') = (decided_at is null)
                                               and (status in ('approved', 'declined')) = (decided_by_staff_id is not null));

-- The floor, or the dealer tablet fixed to this table, may change who sits there.
create function private.may_change_seats(p_table_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.game_table g where g.id = p_table_id and private.has_permission(g.venue_id, 'waitlist.manage'))
      or exists (select 1 from public.device d join public.tablet_assignment a on a.device_id = d.id
                 where d.id = private.current_device_id() and d.kind = 'dealer_tablet' and a.table_id = p_table_id);
$$;

-- The tablet's seats, every one at its table: who sits there (null when open), away since when, the
-- table's minimum buy-in, and the buy-in already with the cage for that seat, if any.
create function private.tablet_seats()
returns table (seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamptz, minimum_paise bigint,
               pending_buy_in_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select n.seat, s.id, m.id, m.full_name, s.away_since, tt.buy_in_min_paise,
         (select r.amount_paise from public.buy_in_request r where r.session_id = s.id and r.status = 'waiting')
  from private.my_tablet_table() t
  join public.game_table g on g.id = t.o_table_id
  join public.table_type tt on tt.id = g.table_type_id
  cross join generate_series(1, g.seats) as n (seat)
  left join public.seat_session s on s.table_id = g.id and s.seat = n.seat and s.ended_at is null
  left join public.member m on m.id = s.member_id
  order by n.seat;
$$;

-- A player steps away from the table, or is back: the seat stays theirs.
create function private.set_seat_away(p_session_id uuid, p_is_away boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.may_change_seats(v_session.table_id) then
    raise exception 'Only the floor or the table''s tablet marks a player away' using errcode = '42501';
  end if;
  if v_session.ended_at is not null then
    raise exception 'That player has left the table' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id);
  if (v_session.away_since is not null) = coalesce(p_is_away, false) then return; end if;
  update public.seat_session set away_since = case when p_is_away then now() end where id = v_session.id;
  perform private.emit(v_session.venue_id, case when p_is_away then 'seat.away' else 'seat.back' end,
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat), (case when p_is_away then 'seat.away:' else 'seat.back:' end) || v_session.id || ':' || now());
end;
$$;

-- Leaving the table: as #77 built it, now also from the table's own tablet. A buy-in still with the
-- cage for that seat is withdrawn, so it cannot be paid once the player has gone.
create or replace function private.end_seat(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.may_change_seats(v_session.table_id) then
    raise exception 'Only the floor or the table''s tablet lets a player leave' using errcode = '42501';
  end if;
  if v_session.ended_at is not null then return; end if;
  if p_reason is null or p_reason not in ('left', 'away') then
    raise exception 'A player leaves, or is away for good' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id);
  update public.seat_session set ended_at = now(), end_reason = p_reason, away_since = null where id = v_session.id;
  update public.buy_in_request set status = 'withdrawn', decided_at = now() where session_id = v_session.id and status = 'waiting';
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', p_reason), 'seat.left:' || v_session.id);
end;
$$;

-- The seat map shows who is away (#77's floor_seats, with away_since).
drop function public.floor_seats(uuid);
drop function private.floor_seats(uuid);
create function private.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end,
         s.away_since
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.member m on m.id = s.member_id
  join public.tier tr on tr.id = m.tier_id
  where s.venue_id = p_venue_id and s.ended_at is null and private.has_permission(p_venue_id, 'members.read')
  order by g.position, s.seat;
$$;
create function public.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_seats(p_venue_id); $$;

revoke execute on function private.may_change_seats(uuid) from public, anon, authenticated;
revoke execute on function private.tablet_seats(), private.set_seat_away(uuid, boolean), private.floor_seats(uuid) from public, anon;
grant execute on function private.tablet_seats(), private.set_seat_away(uuid, boolean), private.floor_seats(uuid) to authenticated;

create function public.tablet_seats()
returns table (seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamptz, minimum_paise bigint,
               pending_buy_in_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tablet_seats(); $$;
create function public.set_seat_away(p_session_id uuid, p_is_away boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_seat_away(p_session_id, p_is_away); $$;

revoke execute on function public.tablet_seats(), public.set_seat_away(uuid, boolean), public.floor_seats(uuid) from public, anon;
grant execute on function public.tablet_seats(), public.set_seat_away(uuid, boolean), public.floor_seats(uuid) to authenticated;
