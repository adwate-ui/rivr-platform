-- Seat sessions, the seat map, table open and close, must-move lists (#77; scope-v1 module 2; features
-- "Call time"). A member seated at a table and seat has a seat session inside their open visit (one is
-- opened if they came straight to the table). A seat move keeps the same session, so call time (#78)
-- runs across moves; each move is kept. A must-move table feeds a main table of the same game: its
-- players move up in the order they sat down there. A table closes only when nobody sits at it.

alter table public.game_table
  add column must_move_to_table_id uuid,
  add constraint game_table_must_move_fkey foreign key (must_move_to_table_id, venue_id) references public.game_table (id, venue_id),
  add constraint game_table_must_move_not_itself check (must_move_to_table_id is distinct from id);
create index game_table_must_move_idx on public.game_table (must_move_to_table_id, venue_id);

create table public.seat_session (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  visit_id uuid not null references public.visit (id),
  table_id uuid not null,
  seat integer not null check (seat between 1 and 10),
  -- When play began: call time runs from here, across moves.
  started_at timestamptz not null default now(),
  -- When they sat down at this table: a must-move list's order.
  seated_here_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('left', 'away', 'cash_out', 'table_closed')),
  seated_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (seated_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((ended_at is null) = (end_reason is null)),
  check (ended_at is null or ended_at >= started_at),
  check (seated_here_at >= started_at)
);

comment on table public.seat_session is 'A member''s play from seating to leaving, across seat moves, inside a visit (#77).';

-- One player per seat, one seat per player.
create unique index seat_session_seat_idx on public.seat_session (table_id, seat) where ended_at is null;
create unique index seat_session_member_idx on public.seat_session (member_id) where ended_at is null;
create index seat_session_member_venue_idx on public.seat_session (member_id, venue_id);
create index seat_session_table_venue_idx on public.seat_session (table_id, venue_id);
create index seat_session_visit_idx on public.seat_session (visit_id);
create index seat_session_staff_venue_idx on public.seat_session (seated_by_staff_id, venue_id);
create trigger seat_session_touch_updated_at before update on public.seat_session
  for each row execute function private.touch_updated_at();
create trigger seat_session_audit after insert or update or delete on public.seat_session
  for each row execute function private.audit_row_change();

create table public.seat_move (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  session_id uuid not null references public.seat_session (id),
  from_table_id uuid not null,
  from_seat integer not null,
  to_table_id uuid not null,
  to_seat integer not null,
  moved_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (from_table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (to_table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (moved_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.seat_move is 'A seat move within one seat session (#77); never changed.';

create index seat_move_session_idx on public.seat_move (session_id);
create index seat_move_venue_idx on public.seat_move (venue_id);
create index seat_move_from_idx on public.seat_move (from_table_id, venue_id);
create index seat_move_to_idx on public.seat_move (to_table_id, venue_id);
create index seat_move_staff_idx on public.seat_move (moved_by_staff_id, venue_id);
create trigger seat_move_never_changed before update or delete on public.seat_move
  for each row execute function private.refuse_change();
create trigger seat_move_audit after insert on public.seat_move
  for each row execute function private.audit_row_change();

alter table public.seat_session enable row level security;
alter table public.seat_move enable row level security;
grant select on public.seat_session, public.seat_move to authenticated;
create policy "members see their own seat sessions" on public.seat_session
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "staff who read members see the venue's seat sessions" on public.seat_session
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));
create policy "staff who read members see the venue's seat moves" on public.seat_move
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- A table's must-move link and whether it is open change only through the functions below.
revoke update (is_open) on public.game_table from authenticated;

-- The floor (waitlist.manage) at the table's venue; the table itself.
create function private.floor_table(p_table_id uuid)
returns public.game_table
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
begin
  select * into v_table from public.game_table t where t.id = p_table_id;
  if v_table.id is null or not private.has_permission(v_table.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor seats and moves players' using errcode = '42501';
  end if;
  return v_table;
end;
$$;

-- Whether a seat is held for a waitlist call (#63) of a member other than this one.
create function private.is_seat_held(p_table_id uuid, p_seat integer, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.waitlist_entry e
                 where e.call_table_id = p_table_id and e.call_seat = p_seat and e.status = 'waiting'
                   and e.called_at is not null and e.member_id <> p_member_id);
$$;

-- Starts a seat session at an open table's free seat, inside the member's open visit (opened now if
-- they came straight to the table). Shared by the floor's Seat and seating from the waitlist. The
-- table is locked first, so a close waits for the seating (and sees it), and a seat held for another
-- member's waitlist call is not given away.
create function private.start_seat_session(p_member_id uuid, p_table_id uuid, p_seat integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table := private.floor_table(p_table_id);
  v_visit uuid;
  v_id uuid;
begin
  select * into v_table from public.game_table t where t.id = v_table.id for no key update;
  if not v_table.is_open or p_seat is null or p_seat not between 1 and v_table.seats
     or not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = v_table.venue_id) then
    raise exception 'Seat a member of this venue at an open table, in a seat it has' using errcode = '22023';
  end if;
  perform private.assert_writable(v_table.venue_id, null, p_member_id);
  if not private.is_kyc_complete(p_member_id) then
    raise exception 'Finish the identity check to take a seat' using errcode = 'RVKYC';
  end if;
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: the member cannot be seated until it ends' using errcode = 'RVBRK';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  if exists (select 1 from public.seat_session s where s.member_id = p_member_id and s.ended_at is null) then
    raise exception 'Already seated: move the player instead' using errcode = 'RVSTD';
  end if;
  if private.is_seat_held(v_table.id, p_seat, p_member_id) then
    raise exception 'That seat is held for a member called from the waitlist' using errcode = 'RVHLD';
  end if;
  v_visit := private.current_visit(p_member_id);
  if v_visit is null then
    insert into public.visit (venue_id, member_id, opened_by_staff_id)
    values (v_table.venue_id, p_member_id, private.current_staff_id(v_table.venue_id)) returning id into v_visit;
    perform private.emit(v_table.venue_id, 'visit.opened', jsonb_build_object('visit_id', v_visit, 'member_id', p_member_id), 'visit.opened:' || v_visit);
  end if;
  begin
    insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, seated_by_staff_id)
    values (v_table.venue_id, p_member_id, v_visit, v_table.id, p_seat, private.current_staff_id(v_table.venue_id))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Someone sits in that seat' using errcode = 'RVOCC';
  end;
  return v_id;
end;
$$;

-- The floor seats a member found by their mobile number.
create function private.seat_member(p_table_id uuid, p_seat integer, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table := private.floor_table(p_table_id);
  v_member_id uuid;
  v_id uuid;
begin
  select m.id into v_member_id from public.member m
  where m.venue_id = v_table.venue_id and m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  v_id := private.start_seat_session(v_member_id, p_table_id, p_seat);
  perform private.emit(v_table.venue_id, 'seat.taken',
                       jsonb_build_object('session_id', v_id, 'member_id', v_member_id, 'table_id', v_table.id, 'seat', p_seat), 'seat.taken:' || v_id);
  return v_id;
end;
$$;

-- Moves a player to a free seat at an open table: the same session, so call time keeps running. As
-- when seating, the table is locked first and a seat held for another member's call is refused.
create function private.move_seat(p_session_id uuid, p_table_id uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_to public.game_table := private.floor_table(p_table_id);
begin
  select * into v_session from public.seat_session s where s.id = p_session_id and s.ended_at is null for update;
  select * into v_to from public.game_table t where t.id = v_to.id for no key update;
  if v_session.id is null or v_session.venue_id <> v_to.venue_id or not v_to.is_open or p_seat is null or p_seat not between 1 and v_to.seats
     or (v_session.table_id = v_to.id and v_session.seat = p_seat) then
    raise exception 'Move a seated player to another seat at an open table' using errcode = '22023';
  end if;
  perform private.assert_writable(v_to.venue_id, null, v_session.member_id);
  if private.is_seat_held(v_to.id, p_seat, v_session.member_id) then
    raise exception 'That seat is held for a member called from the waitlist' using errcode = 'RVHLD';
  end if;
  begin
    update public.seat_session
    set table_id = v_to.id, seat = p_seat, seated_here_at = case when table_id = v_to.id then seated_here_at else now() end
    where id = v_session.id;
  exception when unique_violation then
    raise exception 'Someone sits in that seat' using errcode = 'RVOCC';
  end;
  insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, moved_by_staff_id)
  values (v_to.venue_id, v_session.id, v_session.table_id, v_session.seat, v_to.id, p_seat, private.current_staff_id(v_to.venue_id));
  perform private.emit(v_to.venue_id, 'seat.moved',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_to.id, 'seat', p_seat),
                       'seat.moved:' || v_session.id || ':' || now());
end;
$$;

-- The player leaves the table (or is away for good): the session ends; the visit stays open.
create function private.end_seat(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Only the floor seats and moves players' using errcode = '42501';
  end if;
  perform private.floor_table(v_session.table_id);
  if v_session.ended_at is not null then return; end if;
  if p_reason is null or p_reason not in ('left', 'away') then
    raise exception 'A player leaves, or is away for good' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id);
  update public.seat_session set ended_at = now(), end_reason = p_reason where id = v_session.id;
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', p_reason), 'seat.left:' || v_session.id);
end;
$$;

-- Opens or closes a table (floor.manage); it closes only when nobody sits there and no seat is held for a call.
create function private.set_table_open(p_table_id uuid, p_is_open boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
begin
  select * into v_table from public.game_table t where t.id = p_table_id for update;
  if v_table.id is null or not private.has_permission(v_table.venue_id, 'floor.manage') then
    raise exception 'Only floor managers open and close tables' using errcode = '42501';
  end if;
  perform private.assert_writable(v_table.venue_id);
  if not p_is_open and (exists (select 1 from public.seat_session s where s.table_id = v_table.id and s.ended_at is null)
                        or exists (select 1 from public.waitlist_entry e where e.call_table_id = v_table.id and e.status = 'waiting' and e.called_at is not null)) then
    raise exception 'Move the players before closing the table' using errcode = 'RVSTD';
  end if;
  update public.game_table set is_open = p_is_open where id = v_table.id;
end;
$$;

-- Makes a table a must-move table feeding a main table of the same game, or a table of its own (null).
-- Both tables are locked in id order, so two managers cannot link them both ways at once; a table
-- others feed is a main table and feeds none itself.
create function private.set_must_move(p_table_id uuid, p_main_table_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
begin
  perform 1 from public.game_table t where t.id in (p_table_id, p_main_table_id) order by t.id for no key update;
  select * into v_table from public.game_table t where t.id = p_table_id;
  if v_table.id is null or not private.has_permission(v_table.venue_id, 'floor.manage') then
    raise exception 'Only floor managers set must-move tables' using errcode = '42501';
  end if;
  perform private.assert_writable(v_table.venue_id);
  if p_main_table_id is not null and (not exists (
       select 1 from public.game_table m
       where m.id = p_main_table_id and m.id <> v_table.id and m.venue_id = v_table.venue_id
         and m.table_type_id = v_table.table_type_id and m.must_move_to_table_id is null)
     or exists (select 1 from public.game_table f where f.must_move_to_table_id = v_table.id)) then
    raise exception 'A must-move table feeds a main table of the same game' using errcode = '22023';
  end if;
  update public.game_table set must_move_to_table_id = p_main_table_id where id = v_table.id;
end;
$$;

-- The seat map: who sits where at the venue's tables, for staff who read members; with the order a
-- must-move table's players move up in (1 first), null elsewhere.
create function private.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.member m on m.id = s.member_id
  join public.tier tr on tr.id = m.tier_id
  where s.venue_id = p_venue_id and s.ended_at is null and private.has_permission(p_venue_id, 'members.read')
  order by g.position, s.seat;
$$;

-- Seating from the waitlist (#63) now starts the seat session too, at the seat the member was called to.
create or replace function private.seat_from_waitlist(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
  v_session uuid;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id for update;
  if v_entry.id is null or not private.has_permission(v_entry.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor seats a member' using errcode = '42501';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, v_entry.member_id);
  if v_entry.status <> 'waiting' or v_entry.called_at is null
     or not exists (select 1 from public.game_table t where t.id = v_entry.call_table_id and t.is_open) then
    raise exception 'Seat a member who has been called, at a table still open' using errcode = '22023';
  end if;
  if v_entry.hold_until <= now() then
    raise exception 'The hold has run out' using errcode = 'RVLAT';
  end if;
  -- A player already at another table changes tables: the same session moves, so call time runs on.
  select s.id into v_session from public.seat_session s where s.member_id = v_entry.member_id and s.ended_at is null;
  if v_session is null then
    v_session := private.start_seat_session(v_entry.member_id, v_entry.call_table_id, v_entry.call_seat);
  else
    perform private.move_seat(v_session, v_entry.call_table_id, v_entry.call_seat);
  end if;
  update public.waitlist_entry set status = 'seated', seated_at = now() where id = v_entry.id;
  perform private.emit(v_entry.venue_id, 'seat.taken',
                       jsonb_build_object('entry_id', v_entry.id, 'session_id', v_session, 'member_id', v_entry.member_id,
                                          'table_id', v_entry.call_table_id, 'seat', v_entry.call_seat),
                       'seat.taken:' || v_entry.id);
end;
$$;

-- A call (#63) goes only to a free seat: the floor's Call is refused, and the roll-on stops, when
-- someone sits there. The table is locked as seating locks it.
create or replace function private.put_call(p_entry_id uuid, p_table_id uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
  v_table public.game_table;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id for update;
  select * into v_table from public.game_table t where t.id = p_table_id for no key update;
  if v_entry.status is distinct from 'waiting' or v_entry.called_at is not null or v_entry.stepped_away_at is not null
     or v_table.id is null or v_table.table_type_id <> v_entry.table_type_id or not v_table.is_open
     or p_seat is null or p_seat not between 1 and v_table.seats then
    raise exception 'Call a waiting member to an open table of their game, and a seat at it' using errcode = '22023';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, v_entry.member_id);
  -- Nobody reaches a seat without a finished identity check (scope-v1 module 1).
  if not private.is_kyc_complete(v_entry.member_id) then
    raise exception 'Finish the identity check to take a seat' using errcode = 'RVKYC';
  end if;
  if exists (select 1 from public.waitlist_entry e
             where e.call_table_id = v_table.id and e.call_seat = p_seat and e.status = 'waiting' and e.called_at is not null) then
    raise exception 'That seat is held for someone already called' using errcode = 'RVHLD';
  end if;
  if exists (select 1 from public.seat_session s where s.table_id = v_table.id and s.seat = p_seat and s.ended_at is null) then
    raise exception 'Someone sits in that seat' using errcode = 'RVOCC';
  end if;
  begin
    update public.waitlist_entry
    set called_at = now(), hold_until = now() + private.waitlist_hold(v_entry.venue_id, now()), call_table_id = v_table.id, call_seat = p_seat
    where id = v_entry.id
    returning * into v_entry;
  exception when unique_violation then
    -- Another call took the seat at the same moment.
    raise exception 'That seat is held for someone already called' using errcode = 'RVHLD';
  end;
  perform private.emit(v_entry.venue_id, 'waitlist.called',
                       jsonb_build_object('entry_id', v_entry.id, 'member_id', v_entry.member_id, 'table_name', v_table.name,
                                          'seat', p_seat, 'hold_until', v_entry.hold_until),
                       'waitlist.called:' || v_entry.id || ':' || v_entry.called_at);
end;
$$;

create or replace function private.roll_call_on(p_ended public.waitlist_entry)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next record;
begin
  for v_next in
    select r.entry_id
    from private.ranked_waitlist(array[p_ended.table_type_id]) r
    join public.waitlist_entry e on e.id = r.entry_id
    where e.called_at is null and e.stepped_away_at is null
    order by r.place
  loop
    begin
      perform private.put_call(v_next.entry_id, p_ended.call_table_id, p_ended.call_seat);
      return;
    exception when sqlstate 'RVFRZ' or sqlstate 'RVHLD' or sqlstate 'RVOCC' then
      -- The venue frozen, or the seat held for another call or taken since: nobody is called to it.
      return;
    when sqlstate 'RVMBR' or sqlstate 'RVKYC' or sqlstate '22023' then
      -- A frozen member, one without a finished check, or a table closed since the call: try the next.
      continue;
    end;
  end loop;
end;
$$;

-- Seats held for a waitlist call, so the live floor shows them and seats no one else there.
create function private.held_seats(p_venue_id uuid)
returns table (table_id uuid, seat integer, full_name text, hold_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.call_table_id, e.call_seat, m.full_name, e.hold_until
  from public.waitlist_entry e
  join public.member m on m.id = e.member_id
  where e.venue_id = p_venue_id and e.status = 'waiting' and e.called_at is not null
    and private.has_permission(p_venue_id, 'members.read')
  order by e.call_table_id, e.call_seat;
$$;

revoke execute on function private.floor_table(uuid), private.start_seat_session(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function private.is_seat_held(uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function private.held_seats(uuid) from public, anon;
grant execute on function private.held_seats(uuid) to authenticated;
revoke execute on function private.seat_member(uuid, integer, text), private.move_seat(uuid, uuid, integer), private.end_seat(uuid, text),
  private.set_table_open(uuid, boolean), private.set_must_move(uuid, uuid), private.floor_seats(uuid) from public, anon;
grant execute on function private.seat_member(uuid, integer, text), private.move_seat(uuid, uuid, integer), private.end_seat(uuid, text),
  private.set_table_open(uuid, boolean), private.set_must_move(uuid, uuid), private.floor_seats(uuid) to authenticated;

create function public.seat_member(p_table_id uuid, p_seat integer, p_phone text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.seat_member(p_table_id, p_seat, p_phone); $$;
create function public.move_seat(p_session_id uuid, p_table_id uuid, p_seat integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.move_seat(p_session_id, p_table_id, p_seat); $$;
create function public.end_seat(p_session_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.end_seat(p_session_id, p_reason); $$;
create function public.set_table_open(p_table_id uuid, p_is_open boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_table_open(p_table_id, p_is_open); $$;
create function public.set_must_move(p_table_id uuid, p_main_table_id uuid default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_must_move(p_table_id, p_main_table_id); $$;
create function public.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_seats(p_venue_id); $$;

create function public.held_seats(p_venue_id uuid)
returns table (table_id uuid, seat integer, full_name text, hold_until timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.held_seats(p_venue_id); $$;
revoke execute on function public.held_seats(uuid) from public, anon;
grant execute on function public.held_seats(uuid) to authenticated;

revoke execute on function public.seat_member(uuid, integer, text), public.move_seat(uuid, uuid, integer), public.end_seat(uuid, text),
  public.set_table_open(uuid, boolean), public.set_must_move(uuid, uuid), public.floor_seats(uuid) from public, anon;
grant execute on function public.seat_member(uuid, integer, text), public.move_seat(uuid, uuid, integer), public.end_seat(uuid, text),
  public.set_table_open(uuid, boolean), public.set_must_move(uuid, uuid), public.floor_seats(uuid) to authenticated;
