-- A member let in by their selfie waits before the desk has checked them (the owner, 5 Nov; decision 0503, after 0502):
-- they join a list from the app, or the floor adds them, and a call may go to them; seating still needs a finished
-- identity check (seat_from_waitlist and start_seat_session stay on private.is_kyc_complete), so the floor checks their ID
-- at the desk before they sit. The floor's lists say who needs it.

-- Whether a member may wait on a list: their identity check is finished, or their selfie let them in to be checked at
-- the club and the desk has not decided it yet.
create function private.may_wait(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_kyc_complete(p_member_id)
      or exists (select 1 from public.kyc_record k
                 where k.member_id = p_member_id and k.status = 'started' and k.at_club_from is not null);
$$;
revoke execute on function private.may_wait(uuid) from public, anon, authenticated;

-- As 20261107010000_waitlist_per_table.sql made it, with private.may_wait for the identity check.
create or replace function private.put_on_waitlist(p_member_id uuid, p_table_id uuid, p_idempotency_key uuid, p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_table public.game_table;
  v_id uuid;
  v_place public.waitlist_entry;
  v_replay public.waitlist_entry;
begin
  select * into v_replay from public.waitlist_entry e where e.venue_id = v_venue_id and e.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> p_member_id or v_replay.table_id is distinct from p_table_id then
      raise exception 'That request id was used for another place' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  -- Held against the table being deactivated or deleted meanwhile (decision 0466).
  select * into v_table from public.game_table g where g.id = p_table_id and g.venue_id = v_venue_id and g.active for key share;
  if v_table.id is null then
    raise exception 'No such table at this venue' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id, null, p_member_id);
  -- One at a time per member with start_break (#56).
  perform 1 from public.member m where m.id = p_member_id for update;
  if not private.may_wait(p_member_id) then
    raise exception 'Finish the identity check to join a waitlist' using errcode = 'RVKYC';
  end if;
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: waitlists are closed until it ends' using errcode = 'RVBRK';
  end if;
  select * into v_place from public.waitlist_entry e where e.member_id = p_member_id and e.status = 'waiting';
  if v_place.table_id = v_table.id then
    if p_staff_id is not null and v_place.approved_at is null then
      update public.waitlist_entry set approved_at = now(), approved_by_staff_id = p_staff_id where id = v_place.id;
    end if;
    return v_place.id;
  end if;
  if v_place.id is not null then
    raise exception 'One list at a time: leave the other list first' using errcode = 'RVONE';
  end if;
  insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, added_by_staff_id, approved_at, approved_by_staff_id)
  values (v_venue_id, p_member_id, v_table.table_type_id, v_table.id, p_idempotency_key, p_staff_id, case when p_staff_id is not null then now() end, p_staff_id)
  returning id into v_id;
  if not exists (select 1 from public.outbox_event o
                 where o.venue_id = v_venue_id and o.event_type = 'waitlist.joined' and o.occurred_at > now() - interval '1 hour'
                   and o.payload ->> 'member_id' = p_member_id::text and o.payload ->> 'table_type_id' = v_table.table_type_id::text) then
    perform private.emit(v_venue_id, 'waitlist.joined',
                         jsonb_build_object('entry_id', v_id, 'member_id', p_member_id, 'table_type_id', v_table.table_type_id, 'table_id', v_table.id),
                         'waitlist.joined:' || v_id);
  end if;
  return v_id;
end;
$$;
revoke execute on function private.put_on_waitlist(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- As 20261107010000_waitlist_per_table.sql made it, with private.may_wait: a member waiting for the desk may be called
-- (roll_call_on calls them too), and seat_from_waitlist refuses them until the desk has checked them.
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
     or v_table.id is null or v_table.id <> v_entry.table_id or not v_table.is_open
     or p_seat is null or p_seat not between 1 and v_table.seats then
    raise exception 'Call a waiting member to their list''s table while it is open, and a seat at it' using errcode = '22023';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, v_entry.member_id);
  if not private.may_wait(v_entry.member_id) then
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

-- As 20261103200100_waitlist_at_a_table.sql made it, saying which places wait for the desk's identity check.
drop function public.waitlist_board(uuid);
drop function private.waitlist_board(uuid);
create function private.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean, priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, asked_table_id uuid, on_way_at timestamptz, needs_id_check boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.entry_id, r.table_type_id, m.id, m.full_name, r.joined_at, r.place, r.added_by_staff_id is not null, r.priority_reason,
         ct.name, e.call_seat, e.hold_until, private.away_until(e.venue_id, e.stepped_away_at, e.away_used), e.table_id,
         case when e.on_way_at >= e.called_at then e.on_way_at end,
         not private.is_kyc_complete(m.id)
  from private.ranked_waitlist(array(select t.id from public.table_type t where t.venue_id = p_venue_id)) r
  join public.waitlist_entry e on e.id = r.entry_id
  join public.member m on m.id = r.member_id
  left join public.game_table ct on ct.id = e.call_table_id
  where private.has_permission(p_venue_id, 'waitlist.manage')
  order by r.table_type_id, r.place;
$$;
create function public.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean, priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, asked_table_id uuid, on_way_at timestamptz, needs_id_check boolean)
language sql security invoker set search_path = ''
as $$ select * from private.waitlist_board(p_venue_id); $$;

revoke execute on function private.waitlist_board(uuid), public.waitlist_board(uuid) from public, anon;
grant execute on function private.waitlist_board(uuid), public.waitlist_board(uuid) to authenticated;
