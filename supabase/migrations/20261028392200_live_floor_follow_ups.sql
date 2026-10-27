-- Live floor follow-ups from the #77 review (#333).
--   * A table is added only with named columns: never with a must-move link, which only set_must_move sets, with its checks.
--   * A table's seats never shrink below a seat someone sits in or is called to (RVOCC, as a taken seat).
--   * Seating a member from the console takes their waiting place for that game off its list (left, reason seated).
revoke insert on public.game_table from authenticated;
grant insert (venue_id, table_type_id, name, position, seats, is_open, room) on public.game_table to authenticated;

create function private.refuse_seats_below_taken()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.seats < old.seats
     and (exists (select 1 from public.seat_session s where s.table_id = new.id and s.ended_at is null and s.seat > new.seats)
          or exists (select 1 from public.waitlist_entry e where e.call_table_id = new.id and e.status = 'waiting' and e.call_seat > new.seats)) then
    raise exception 'Someone sits in, or is called to, a seat above %: move them first', new.seats using errcode = 'RVOCC';
  end if;
  return new;
end;
$$;

create trigger game_table_seats_not_below_taken before update of seats on public.game_table
  for each row execute function private.refuse_seats_below_taken();

alter table public.waitlist_entry drop constraint waitlist_entry_left_reason_check;
alter table public.waitlist_entry add constraint waitlist_entry_left_reason_check
  check (left_reason in ('left', 'missed', 'stepped_away', 'break', 'seated'));

-- As before (20261019091800_seat_sessions.sql), taking the member off the game's waitlist.
create or replace function private.seat_member(p_table_id uuid, p_seat integer, p_phone text)
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
  select m.id into v_member_id from public.member m
  where m.venue_id = v_table.venue_id and m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  v_id := private.start_seat_session(v_member_id, p_table_id, p_seat);
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

revoke execute on function private.refuse_seats_below_taken() from public, anon, authenticated;
