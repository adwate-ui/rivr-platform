-- The call time's 15-minute warning (decision 0320; brief 3.4 D and 6.5): once a seated player's call time has 15 minutes or
-- less to run (the twin of @rivr/domain CALL_TIME_ENDING_SECONDS, which turns the app's ring red and shows its banner), the
-- minute sweep emits call_time.ending once, which the push consumer sends as "Call time ends in 15 min"
-- with Add time to the member who keeps Call time on. Not while away (the clock stands still), not once complete
-- (call_time.completed says that). Time the floor adds clears ending_warned_at (20261103200200), so the new end is warned of
-- too; the key carries the call time, so that second warning is a new event.
create or replace function private.sweep_seated_time()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_due record;
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
                                            'seat', v_session.seat), 'call_time.completed:' || v_session.id);
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
  for v_due in
    select s.id, s.venue_id, s.member_id, r.session_reminder_hours as hours from public.seat_session s
    cross join lateral private.member_restrictions(s.member_id, now()) r
    where s.ended_at is null and s.reminded_at is null and r.session_reminder_hours is not null
      and s.started_at + make_interval(hours => r.session_reminder_hours) <= now()
    for update of s skip locked
  loop
    update public.seat_session set reminded_at = now() where id = v_due.id;
    perform private.emit(v_due.venue_id, 'session.reminder',
                         jsonb_build_object('session_id', v_due.id, 'member_id', v_due.member_id, 'hours', v_due.hours),
                         'session.reminder:' || v_due.id);
  end loop;
end;
$$;
revoke execute on function private.sweep_seated_time() from public, anon, authenticated;

-- Time added any way (the floor's approval, or the floor setting the call time) owes the warning again for the new end.
create function private.rearm_call_time_ending()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.call_time_minutes > old.call_time_minutes then
    new.ending_warned_at := null;
  end if;
  return new;
end;
$$;
create trigger seat_session_rearm_call_time_ending before update of call_time_minutes on public.seat_session
  for each row execute function private.rearm_call_time_ending();
revoke execute on function private.rearm_call_time_ending() from public, anon, authenticated;
