-- No session reminders (#796; the owner, 3 Nov). The redesign took the reminder out of Profile (decision 0322), so a
-- member who set one could not stop it but by turning off push. Every reminder is cleared, and the minute sweep sends
-- none, whatever a member sets (nothing in the app sets one now).

update public.member_limit set session_reminder_hours = null where session_reminder_hours is not null;

-- As in 20261103210000_time_requests.sql, without the session reminder.
create or replace function private.sweep_seated_time()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_ending record;
begin
  for v_session in
    select * from public.seat_session s
    where s.ended_at is null and s.call_time_completed_at is null and s.call_time_minutes > 0 and private.session_call_time(s, now()) = 0
    for update skip locked
  loop
    update public.seat_session set call_time_completed_at = now() where id = v_session.id;
    perform private.emit(v_session.venue_id, 'call_time.completed',
                         jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                            'seat', v_session.seat), 'call_time.completed:' || v_session.id || ':' || v_session.call_time_minutes);
  end loop;
  for v_ending in
    select s.id, s.venue_id, s.member_id, s.seat, s.call_time_minutes, t.name as table_name,
           now() + make_interval(secs => private.session_call_time(s, now())) as ends_at
    from public.seat_session s
    join public.game_table t on t.id = s.table_id
    where s.ended_at is null and s.away_since is null and s.call_time_completed_at is null and s.ending_warned_at is null
      and s.call_time_minutes > 0 and private.session_call_time(s, now()) between 1 and 15 * 60
      -- Only a member who may see their call time hears it is ending (my_seat hides it otherwise).
      and private.has_feature(s.member_id, 'call_time.view')
    for update of s skip locked
  loop
    update public.seat_session set ending_warned_at = now() where id = v_ending.id;
    perform private.emit(v_ending.venue_id, 'call_time.ending',
                         jsonb_build_object('session_id', v_ending.id, 'member_id', v_ending.member_id, 'table_name', v_ending.table_name,
                                            'seat', v_ending.seat, 'ends_at', v_ending.ends_at),
                         'call_time.ending:' || v_ending.id || ':' || v_ending.call_time_minutes);
  end loop;
end;
$$;
