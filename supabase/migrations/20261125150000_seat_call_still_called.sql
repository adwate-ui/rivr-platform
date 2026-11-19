-- A seat call is told only while it stands (#864). The waitlist.called event now says when the call was made (called_at), and
-- the senders ask seat_call_in_force at send time: a call skipped, seated or released in the minute before the outbox claims
-- it is handled, unsent, instead of telling the member their seat is ready.

CREATE OR REPLACE FUNCTION private.put_call(p_entry_id uuid, p_table_id uuid, p_seat integer, p_notify boolean DEFAULT true)
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
                                            'seat', p_seat, 'hold_until', v_entry.hold_until, 'called_at', v_entry.called_at),
                         'waitlist.called:' || v_entry.id || ':' || v_entry.called_at);
  end if;
end;
$function$;

-- Whether a seat call still stands: the place is still waiting, called at that moment, at that venue, its hold not run out.
create function private.seat_call_in_force(p_venue_id uuid, p_entry_id uuid, p_called_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.waitlist_entry e
                 where e.id = p_entry_id and e.venue_id = p_venue_id and e.status = 'waiting'
                   and e.called_at = p_called_at and e.hold_until > now());
$$;
revoke all on function private.seat_call_in_force(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function private.seat_call_in_force(uuid, uuid, timestamptz) to service_role;

create function public.seat_call_in_force(p_venue_id uuid, p_entry_id uuid, p_called_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.seat_call_in_force(p_venue_id, p_entry_id, p_called_at);
$$;
revoke execute on function public.seat_call_in_force(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.seat_call_in_force(uuid, uuid, timestamptz) to service_role;
