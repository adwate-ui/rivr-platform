-- Assign from the waitlist, and seat by membership number, each with the player's call time (owner, 2 Nov; decision
-- 0299): "Waitlist - CALL to ASSIGN", "CALL / ASSIGN > Seat him automatically", "Seat a player by MEMBERSHIP ID" and "Add
-- player call time when they are seated by floor. 180, 240, 300, custom."

-- Assigns a waiting member to a seat at an open table of their game and seats them at once: the call (whose seat-ready
-- message still goes out) and the seating in one step, with the call time the floor chose for a new session. A player
-- already seated, changing tables, keeps the call time they have. Refusals as call_from_waitlist, seat_from_waitlist and
-- set_seat_call_time: 42501, 22023, RVKYC, RVFRZ/RVMBR.
create function private.assign_from_waitlist(p_entry_id uuid, p_table_id uuid, p_seat integer, p_call_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (select e.member_id from public.waitlist_entry e where e.id = p_entry_id);
  -- Seated already, the member changes tables in the same session, keeping their call time.
  v_was_seated boolean := exists (select 1 from public.seat_session s where s.member_id = v_member_id and s.ended_at is null);
begin
  perform private.call_from_waitlist(p_entry_id, p_table_id, p_seat);
  perform private.seat_from_waitlist(p_entry_id);
  if not v_was_seated then
    perform private.set_seat_call_time((select s.id from public.seat_session s where s.member_id = v_member_id and s.ended_at is null), p_call_minutes);
  end if;
end;
$$;

create function public.assign_from_waitlist(p_entry_id uuid, p_table_id uuid, p_seat integer, p_call_minutes integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.assign_from_waitlist(p_entry_id, p_table_id, p_seat, p_call_minutes); $$;

revoke execute on function private.assign_from_waitlist(uuid, uuid, integer, integer), public.assign_from_waitlist(uuid, uuid, integer, integer)
  from public, anon;
grant execute on function private.assign_from_waitlist(uuid, uuid, integer, integer), public.assign_from_waitlist(uuid, uuid, integer, integer)
  to authenticated;

-- Seating by mobile number or by membership number, with the call time the floor chose. As 20261028392200 made it
-- otherwise: off the game's waitlist, a seat they were called to passing to the next name. Without a call time the stake's
-- own stands. Refusals: 22023 not exactly one of the two numbers; RVNOM no member has it; as start_seat_session and
-- set_seat_call_time otherwise.
drop function public.seat_member(uuid, integer, text);
drop function private.seat_member(uuid, integer, text);
create function private.seat_member(p_table_id uuid, p_seat integer, p_phone text default null, p_member_number bigint default null,
                                    p_call_minutes integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table := private.floor_table(p_table_id);
  v_member_id uuid;
  v_id uuid;
  v_entry public.waitlist_entry;
begin
  if (p_phone is null) = (p_member_number is null) then
    raise exception 'Seat by a mobile number or a membership number' using errcode = '22023';
  end if;
  select m.id into v_member_id from public.member m
  where m.venue_id = v_table.venue_id
    and (m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10) or m.member_number = p_member_number);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  v_id := private.start_seat_session(v_member_id, p_table_id, p_seat);
  if p_call_minutes is not null then
    perform private.set_seat_call_time(v_id, p_call_minutes);
  end if;
  -- Seated at this game, so off its waitlist: the floor calls nobody already playing it. A seat they were called to goes
  -- to the next name, as when a member leaves the list (leave_waitlist).
  for v_entry in update public.waitlist_entry e set status = 'left', left_at = now(), left_reason = 'seated'
                 where e.member_id = v_member_id and e.table_type_id = v_table.table_type_id and e.status = 'waiting'
                 returning e.* loop
    if v_entry.called_at is not null then perform private.roll_call_on(v_entry); end if;
  end loop;
  perform private.emit(v_table.venue_id, 'seat.taken',
                       jsonb_build_object('session_id', v_id, 'member_id', v_member_id, 'table_id', v_table.id, 'seat', p_seat), 'seat.taken:' || v_id);
  return v_id;
end;
$$;

create function public.seat_member(p_table_id uuid, p_seat integer, p_phone text default null, p_member_number bigint default null,
                                   p_call_minutes integer default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.seat_member(p_table_id, p_seat, p_phone, p_member_number, p_call_minutes); $$;

revoke execute on function private.seat_member(uuid, integer, text, bigint, integer), public.seat_member(uuid, integer, text, bigint, integer)
  from public, anon;
grant execute on function private.seat_member(uuid, integer, text, bigint, integer), public.seat_member(uuid, integer, text, bigint, integer)
  to authenticated;
