-- The floor's one-tap Call, and seating from a list that sends nothing (audit of 8 Nov 2026, F-050, F-166; the owner, 8 Nov).
-- Every seating from a list went through a call, so it sent "Your seat is ready, hold expires" to a member already sitting
-- down, and nothing else ever placed a call, so the hold, "I'm on my way" and the next-name roll-on could not run. Now the
-- floor's Call holds the first free seat at the list's table for the member, for the club's hold (20 minutes), and tells
-- them by WhatsApp and push; seating them from the list says nothing.

-- As 20261019090600_waitlist_call_and_seat.sql and later made it, with whether the member is told.
drop function private.put_call(uuid, uuid, integer);
CREATE FUNCTION private.put_call(p_entry_id uuid, p_table_id uuid, p_seat integer, p_notify boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Five seat calls an hour at most for one member: a loop of calls and skips cannot flood them or hold up the queue.
  if p_notify and (select count(*) from public.outbox_event o
                   where o.event_type = 'waitlist.called' and o.occurred_at > now() - interval '1 hour'
                     and o.payload ->> 'member_id' = v_entry.member_id::text) < 5 then
    perform private.emit(v_entry.venue_id, 'waitlist.called',
                         jsonb_build_object('entry_id', v_entry.id, 'member_id', v_entry.member_id, 'table_name', v_table.name,
                                            'seat', p_seat, 'hold_until', v_entry.hold_until),
                         'waitlist.called:' || v_entry.id || ':' || v_entry.called_at);
  end if;
end;
$function$;

revoke execute on function private.put_call(uuid, uuid, integer, boolean) from public, anon, authenticated;

-- As 20261109090000_bonus_chips.sql made it: the place held and taken in one step, with no call sent.
CREATE OR REPLACE FUNCTION private.assign_from_waitlist(p_entry_id uuid, p_table_id uuid, p_seat integer, p_call_minutes integer, p_bonus_chips integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member_id uuid := (select e.member_id from public.waitlist_entry e where e.id = p_entry_id);
  -- Seated already, the member changes tables in the same session, keeping their call time.
  v_was_seated boolean := exists (select 1 from public.seat_session s where s.member_id = v_member_id and s.ended_at is null);
  v_session_id uuid;
begin
  if v_member_id is null or not private.has_permission((select e.venue_id from public.waitlist_entry e where e.id = p_entry_id), 'waitlist.manage') then
    raise exception 'Only the floor calls a member' using errcode = '42501';
  end if;
  -- Seated at once: the member is told nothing, as "your seat is ready" would only mislead them. One the floor called to this
  -- seat is seated in it, with the call time and bonus chips chosen now.
  if not exists (select 1 from public.waitlist_entry e
                 where e.id = p_entry_id and e.called_at is not null and e.call_table_id = p_table_id and e.call_seat = p_seat) then
    perform private.put_call(p_entry_id, p_table_id, p_seat, false);
  end if;
  perform private.seat_from_waitlist(p_entry_id);
  v_session_id := (select s.id from public.seat_session s where s.member_id = v_member_id and s.ended_at is null);
  if not v_was_seated then
    perform private.set_seat_call_time(v_session_id, p_call_minutes);
  end if;
  perform private.redeem_bonus_at_seat(v_session_id, p_bonus_chips);
end;
$function$;

-- Call (the owner, 8 Nov): the first seat at the list's own table that nobody sits in or is held for, held for this member,
-- who is told. The table is locked first, so two calls at once take two seats. Returns the seat.
create function private.call_to_seat(p_entry_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
  v_seat integer;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id;
  if v_entry.id is null or not private.has_permission(v_entry.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor calls a member' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_entry.member_id) is true then
    raise exception 'Not for your own member record' using errcode = 'RVOWN';
  end if;
  -- The place first, as put_call locks them, then the table, so two calls at once take two seats.
  perform 1 from public.waitlist_entry e where e.id = p_entry_id for update;
  perform 1 from public.game_table t where t.id = v_entry.table_id for no key update;
  select n into v_seat
  from public.game_table t cross join generate_series(1, t.seats) n
  where t.id = v_entry.table_id
    and not exists (select 1 from public.seat_session s where s.table_id = t.id and s.seat = n and s.ended_at is null)
    and not exists (select 1 from public.waitlist_entry e where e.call_table_id = t.id and e.call_seat = n and e.status = 'waiting' and e.called_at is not null)
  order by n
  limit 1;
  if v_seat is null then
    raise exception 'Every seat at this table is taken or held' using errcode = 'RVOCC';
  end if;
  perform private.put_call(p_entry_id, v_entry.table_id, v_seat);
  return v_seat;
end;
$$;

create function public.call_to_seat(p_entry_id uuid)
returns integer
language sql
set search_path = ''
as $$ select private.call_to_seat(p_entry_id); $$;

revoke execute on function private.call_to_seat(uuid), public.call_to_seat(uuid) from public, anon;
grant execute on function private.call_to_seat(uuid), public.call_to_seat(uuid) to authenticated;

-- The floor taps Call (the owner, 8 Nov): a call that ends, by its hold running out, a Skip or the member leaving, frees the
-- seat and calls nobody. It rolled to the next name, which sent them all a message with no floor tap. Kept as the one place
-- its callers (expire_waitlist_holds, step_away, leave_waitlist, start_break, close_visit, seat_member) reach.
create or replace function private.roll_call_on(p_ended public.waitlist_entry)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nothing rolls on: the seat stays free for the floor's next Call.
  perform p_ended.id;
end;
$$;
