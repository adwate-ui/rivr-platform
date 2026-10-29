-- At the table, from the app (#634; owner's feedback doc of 29 Oct, decision 0284). A seated member sees
-- how long they have played and their call time, now three hours. They extend it by an hour, leave the
-- seat, and ask the floor for a top-up: requested, then in progress, then back to asking. The floor
-- moves a request along or resets it. No amount: the chips are the floor's business at the table.

-- Call time is three hours from now, for every table type that had less. The setting still takes any
-- value, so the club changes it in Settings.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select tt.venue_id, 'call_time.minutes', tt.code, '{"minutes": 180}', now(), 'Call time is at least three hours (#634)'
from public.table_type tt
where coalesce((private.setting_at(tt.venue_id, 'call_time.minutes', tt.code, now()) ->> 'minutes')::integer, 0) < 180;

-- When the member asked for a top-up, and when the floor took it in hand; both cleared when the floor resets it.
alter table public.seat_session
  add column top_up_requested_at timestamptz,
  add column top_up_started_at timestamptz,
  add constraint seat_session_top_up_check check (top_up_started_at is null or top_up_requested_at is not null);

insert into public.feature (key, name, description, screens, is_gateable) values
  ('table.top_up', 'Top-up requests', 'Asking the floor for more chips from the seat.', '{player:home}', true);
insert into public.feature (key, name, description, screens, is_gateable) values
  ('table.leave', 'Leave the seat', 'Leaving the seat from the app.', '{player:home}', false);
-- Every tier of an existing venue has top-ups, as a new venue's tiers do (bootstrap_venue).
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, 'table.top_up', true, 'locked', '-infinity' from public.tier t;

insert into private.member_export_column (table_name, column_name, kind) values
  ('seat_session', 'top_up_requested_at', 'owed'), ('seat_session', 'top_up_started_at', 'owed');

-- A top-up's state: 'requested', 'in_progress', or null with none asked for.
create function private.top_up_state(p_session public.seat_session)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_session.top_up_started_at is not null then 'in_progress' when p_session.top_up_requested_at is not null then 'requested' end;
$$;

-- The signed-in member's open seat, locked for the change. Refusals: 22023 not seated, RVFRZ/RVMBR frozen.
create function private.my_open_seat()
returns public.seat_session
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s
  where s.member_id = private.current_member_id() and s.ended_at is null for update;
  if v_session.id is null then
    raise exception 'You are not seated' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  return v_session;
end;
$$;

-- An hour more call time on the member's seat, with call_time.view, while it still runs: a seat with none, or with it
-- done, gets none, so a member who met the rule never comes to owe time. Up to the day's 1,440 minutes. Refusals: 22023
-- none running, or beyond a day.
create function private.extend_my_call_time()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
begin
  if not private.has_feature(v_session.member_id, 'call_time.view') then
    raise exception 'Call time is not open to you' using errcode = '42501';
  end if;
  if coalesce(private.session_call_time(v_session, now()), 0) = 0 then
    raise exception 'No call time running to extend' using errcode = '22023';
  end if;
  if v_session.call_time_minutes + 60 > 1440 then
    raise exception 'Call time is at most a day' using errcode = '22023';
  end if;
  update public.seat_session set call_time_minutes = call_time_minutes + 60 where id = v_session.id;
end;
$$;

-- The member leaves their seat. With call time done, or none, the seat opens now, as end_seat does: 'left'. With call time
-- still owed, the floor's Leaving list shows them, and the seat opens when the floor lets them go: 'leaving'.
create function private.leave_my_seat()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
begin
  if not private.has_feature(v_session.member_id, 'table.leave') then
    raise exception 'Leaving from the app is not open to you' using errcode = '42501';
  end if;
  if coalesce(private.session_call_time(v_session, now()), 0) > 0 then
    update public.seat_session set leaving_at = coalesce(leaving_at, now()) where id = v_session.id;
    return 'leaving';
  end if;
  update public.seat_session set ended_at = now(), end_reason = 'left', away_since = null where id = v_session.id;
  update public.buy_in_request set status = 'withdrawn', decided_at = now() where session_id = v_session.id and status = 'waiting';
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', 'left'), 'seat.left:' || v_session.id);
  return 'left';
end;
$$;

-- The member asks the floor for a top-up, with table.top_up; asking again changes nothing.
create function private.request_top_up()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session := private.my_open_seat();
begin
  if not private.has_feature(v_session.member_id, 'table.top_up') then
    raise exception 'Top-up requests are not open to you' using errcode = '42501';
  end if;
  update public.seat_session set top_up_requested_at = coalesce(top_up_requested_at, now()) where id = v_session.id;
end;
$$;

-- The floor (waitlist.manage) takes a seat's top-up request in hand (true), or resets it, done or not (false).
-- Refusals: 42501 not the floor, 22023 the player no longer seated or no request to take in hand, RVFRZ/RVMBR frozen.
create function private.set_top_up(p_session_id uuid, p_in_progress boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor handles top-ups' using errcode = '42501';
  end if;
  if v_session.ended_at is not null or p_in_progress is null or (p_in_progress and v_session.top_up_requested_at is null) then
    raise exception 'No top-up to take in hand' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  update public.seat_session
  set top_up_started_at = case when p_in_progress then coalesce(top_up_started_at, now()) end,
      top_up_requested_at = case when p_in_progress then top_up_requested_at end
  where id = v_session.id;
end;
$$;

-- The TV's call-time board hears of an extension too (20261026090000_call_time_board.sql).
drop trigger seat_session_tv_signal_change on public.seat_session;
create trigger seat_session_tv_signal_change after update on public.seat_session
  for each row
  when ((old.table_id, old.seat, old.ended_at, old.away_since, old.leaving_at, old.call_time_minutes)
        is distinct from (new.table_id, new.seat, new.ended_at, new.away_since, new.leaving_at, new.call_time_minutes))
  execute function private.signal_call_time_change();

-- As in 20261019092100_call_time.sql, with how long the member has played, whether the member is on the Leaving list and their top-up.
drop function public.my_seat();
drop function private.my_seat();
create function private.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, s.seat, s.away_since is not null, s.call_time_minutes > 0,
         case when private.has_feature(s.member_id, 'call_time.view') then private.session_call_time(s, now()) end,
         floor(extract(epoch from now() - s.started_at))::integer, s.leaving_at is not null, private.top_up_state(s)
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  where s.member_id = private.current_member_id() and s.ended_at is null;
$$;
create function public.my_seat()
returns table (table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer,
               is_leaving boolean, top_up text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_seat(); $$;

-- As in 20261026090000_call_time_board.sql, with each seat's top-up.
drop function public.floor_seats(uuid);
drop function private.floor_seats(uuid);
create function private.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz, call_time_left integer, leaving_at timestamptz,
               top_up text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end,
         s.away_since, private.session_call_time(s, now()), s.leaving_at, private.top_up_state(s)
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.member m on m.id = s.member_id
  join public.tier tr on tr.id = m.tier_id
  where s.venue_id = p_venue_id and s.ended_at is null and private.has_permission(p_venue_id, 'members.read')
  order by g.position, s.seat;
$$;
create function public.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz, call_time_left integer, leaving_at timestamptz,
               top_up text)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_seats(p_venue_id); $$;

create function public.extend_my_call_time()
returns void language sql volatile security invoker set search_path = ''
as $$ select private.extend_my_call_time(); $$;
create function public.leave_my_seat()
returns text language sql volatile security invoker set search_path = ''
as $$ select private.leave_my_seat(); $$;
create function public.request_top_up()
returns void language sql volatile security invoker set search_path = ''
as $$ select private.request_top_up(); $$;
create function public.set_top_up(p_session_id uuid, p_in_progress boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_top_up(p_session_id, p_in_progress); $$;

revoke execute on function private.top_up_state(public.seat_session), private.my_open_seat() from public, anon, authenticated;
revoke execute on function private.extend_my_call_time(), private.leave_my_seat(), private.request_top_up(), private.set_top_up(uuid, boolean),
  private.my_seat(), private.floor_seats(uuid) from public, anon;
grant execute on function private.extend_my_call_time(), private.leave_my_seat(), private.request_top_up(), private.set_top_up(uuid, boolean),
  private.my_seat(), private.floor_seats(uuid) to authenticated;
revoke execute on function public.extend_my_call_time(), public.leave_my_seat(), public.request_top_up(), public.set_top_up(uuid, boolean),
  public.my_seat(), public.floor_seats(uuid) from public, anon;
grant execute on function public.extend_my_call_time(), public.leave_my_seat(), public.request_top_up(), public.set_top_up(uuid, boolean),
  public.my_seat(), public.floor_seats(uuid) to authenticated;
