-- The Live floor live (console v3, phase 2; decision 0446), as the TV boards and the owner dashboard are (decisions 0051,
-- 0192): whatever the floor shows changing broadcasts once a statement on the venue's private topic floor:<venue id>,
-- naming nothing. The console reads its floor again shortly after. Only the venue's floor (waitlist.manage) hears it.
-- The practice venue's floor hears its own topic: a broadcast to staff consoles reaches no external system.

create function private.signal_floor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  for v_venue_id in select distinct c.venue_id from changed c loop
    perform realtime.send('{}'::jsonb, 'changed', 'floor:' || v_venue_id::text, true);
  end loop;
  return null;
end;
$$;

-- Seats taken, moved, left and undone; their top-ups, time and leaving.
create trigger seat_session_floor_signal after insert on public.seat_session
  referencing new table as changed for each statement execute function private.signal_floor();
create trigger seat_session_floor_signal_change after update on public.seat_session
  referencing new table as changed for each statement execute function private.signal_floor();
create trigger seat_session_floor_signal_undone after delete on public.seat_session
  referencing old table as changed for each statement execute function private.signal_floor();
-- Joins asked for, approved, declined, called and seated.
create trigger waitlist_entry_floor_signal after insert on public.waitlist_entry
  referencing new table as changed for each statement execute function private.signal_floor();
create trigger waitlist_entry_floor_signal_change after update on public.waitlist_entry
  referencing new table as changed for each statement execute function private.signal_floor();
-- Time asked for and decided; top-ups asked for, started and closed.
create trigger call_time_request_floor_signal after insert on public.call_time_request
  referencing new table as changed for each statement execute function private.signal_floor();
create trigger call_time_request_floor_signal_change after update on public.call_time_request
  referencing new table as changed for each statement execute function private.signal_floor();
create trigger top_up_request_floor_signal after insert on public.top_up_request
  referencing new table as changed for each statement execute function private.signal_floor();
create trigger top_up_request_floor_signal_change after update on public.top_up_request
  referencing new table as changed for each statement execute function private.signal_floor();
-- Tables opened, closed, linked to a main table; a player let go early leaves the left-before-call-time list.
create trigger game_table_floor_signal after update on public.game_table
  referencing new table as changed for each statement execute function private.signal_floor();
create trigger early_departure_floor_signal after insert on public.early_departure
  referencing new table as changed for each statement execute function private.signal_floor();

-- Only the venue's floor hears its topic: Realtime checks this as they subscribe.
create policy "a venue's floor hears its signals" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast'
         and case when (select realtime.topic()) ~ '^floor:[0-9a-f-]{36}$'
                  then private.has_permission(substr((select realtime.topic()), 7)::uuid, 'waitlist.manage')
                  else false end);

revoke execute on function private.signal_floor() from public, anon, authenticated;
