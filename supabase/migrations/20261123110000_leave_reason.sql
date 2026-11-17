-- Why a player left the table, asked on every leave (#1060, the owner, 17 Nov): the floor's leave sheet and the dealer
-- tablet's Left pick one of a fixed list (@rivr/contracts LEAVE_REASONS), "Call time met" first and picked already when
-- it is. It was asked only when call time was owed, and kept as words on the early departure, which stays as it is.
-- A member who leaves from the app with nothing owed has met their call time, or had none, as staff screens call it.

alter table public.seat_session add column leave_reason text
  check (leave_reason in ('call_time_met', 'busted', 'emergency', 'unwell', 'table_broke', 'floor_decision'));
alter table public.seat_session add constraint seat_session_leave_reason_when_ended check (leave_reason is null or ended_at is not null);
-- One of a fixed list about the member's own seat, as end_reason is: their data export carries it.
insert into private.member_export_column (table_name, column_name, kind) values ('seat_session', 'leave_reason', 'owed');
comment on column public.seat_session.leave_reason is
  'Why the player left the table (#1060): one of LEAVE_REASONS, from the floor, the tablet, or call_time_met when they left from the app owing none.';

drop function public.end_seat(uuid, text);
drop function private.end_seat(uuid, text);

create function private.end_seat(p_session_id uuid, p_reason text, p_leave_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.may_change_seats(v_session.table_id) then
    raise exception 'Only the floor or the table''s tablet lets a player leave' using errcode = '42501';
  end if;
  if v_session.ended_at is not null then return; end if;
  if p_reason is null or p_reason not in ('left', 'away') then
    raise exception 'A player leaves, or is away for good' using errcode = '22023';
  end if;
  if p_leave_reason is not null
     and p_leave_reason not in ('call_time_met', 'busted', 'emergency', 'unwell', 'table_broke', 'floor_decision') then
    raise exception 'A reason to leave is one of the club''s list' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id);
  update public.seat_session
  set ended_at = private.seat_end_stamp(v_session.seated_here_at, now()), end_reason = p_reason, away_since = null, leave_reason = p_leave_reason
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', p_reason), 'seat.left:' || v_session.id || ':' || clock_timestamp());
end;
$$;

create function public.end_seat(p_session_id uuid, p_reason text, p_leave_reason text default null)
returns void
language sql
set search_path = ''
as $$ select private.end_seat(p_session_id, p_reason, p_leave_reason); $$;

revoke all on function private.end_seat(uuid, text, text) from public, anon;
grant execute on function private.end_seat(uuid, text, text) to authenticated;
revoke all on function public.end_seat(uuid, text, text) from public, anon;
grant execute on function public.end_seat(uuid, text, text) to authenticated;

-- From the app, owing nothing: the call time is met, or the seat had none, which staff screens call met too.
create or replace function private.leave_my_seat()
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
  update public.seat_session
  set ended_at = private.seat_end_stamp(v_session.seated_here_at, now()), end_reason = 'left', away_since = null,
      leave_reason = 'call_time_met'
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', 'left'), 'seat.left:' || v_session.id);
  return 'left';
end;
$$;

-- The member's visits on their record: also why they left each table in it, in order (task review).
drop function public.member_visits(uuid, uuid, integer);
drop function private.member_visits(uuid, uuid, integer);

create function private.member_visits(p_venue_id uuid, p_member_id uuid, p_limit integer)
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, tables text, minutes_played integer, call_time_met boolean,
               left_early boolean, leave_reasons text[])
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.opened_at, v.closed_at,
         -- A floor move overwrites the seat's table, so the tables it left are in seat_move.
         (select string_agg(t.name, ', ' order by t.name)
          from (select g.name from public.seat_session s join public.game_table g on g.id = s.table_id where s.visit_id = v.id
                union
                select g.name from public.seat_move mv
                join public.seat_session s on s.id = mv.session_id
                join public.game_table g on g.id = mv.from_table_id
                where s.visit_id = v.id) t),
         coalesce((select sum(private.minutes_played(s, now()))::integer from public.seat_session s where s.visit_id = v.id), 0),
         -- Null when no seat of the visit owed any call time, or while the seats that owe it are still running.
         (select bool_and(s.call_time_completed_at is not null) filter (where s.ended_at is not null or s.call_time_completed_at is not null)
          from public.seat_session s where s.visit_id = v.id and s.call_time_minutes > 0),
         -- A departure withdrawn as a mistake (decision 0500) does not count.
         exists (select 1 from public.early_departure e
                 where e.visit_id = v.id and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id)),
         -- Why they left each table of the visit, in order, those with a reason (#1060).
         array(select s.leave_reason from public.seat_session s where s.visit_id = v.id and s.leave_reason is not null
               order by s.ended_at, s.id)
  from public.visit v
  where v.member_id = p_member_id and v.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
  order by v.opened_at desc, v.id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$$;

create function public.member_visits(p_venue_id uuid, p_member_id uuid, p_limit integer default 20)
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, tables text, minutes_played integer, call_time_met boolean,
               left_early boolean, leave_reasons text[])
language sql
stable
set search_path = ''
as $$ select * from private.member_visits(p_venue_id, p_member_id, p_limit); $$;

revoke all on function private.member_visits(uuid, uuid, integer) from public, anon;
grant execute on function private.member_visits(uuid, uuid, integer) to authenticated;
revoke all on function public.member_visits(uuid, uuid, integer) from public, anon;
grant execute on function public.member_visits(uuid, uuid, integer) to authenticated;

-- Undo of a leave (decision 0480) opens the seat again, so it forgets why it was left.
create or replace function private.undo_leave(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_table public.game_table;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor undoes a leave' using errcode = '42501';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  select * into v_table from public.game_table t where t.id = v_session.table_id for no key update;
  if v_session.ended_at is null or v_session.end_reason <> 'left' or not private.is_undoable(v_session.ended_at)
     or not v_table.active or not v_table.is_open
     or exists (select 1 from public.early_departure e where e.session_id = v_session.id)
     or exists (select 1 from public.visit v where v.id = v_session.visit_id and v.closed_at is not null)
     or exists (select 1 from public.outbox_event e where e.venue_id = v_session.venue_id and e.idempotency_key = 'seat.left:' || v_session.id) then
    raise exception 'Only the floor''s leave of the last two minutes, at an open table, not let go early, is undone' using errcode = '22023';
  end if;
  if private.is_seat_held(v_table.id, v_session.seat, v_session.member_id) then
    raise exception 'That seat is held for a member called from the waitlist' using errcode = 'RVHLD';
  end if;
  if (select r.break_until from private.member_restrictions(v_session.member_id, now()) r) is not null then
    raise exception 'On a break: the member cannot be seated until it ends' using errcode = 'RVBRK';
  end if;
  begin
    update public.seat_session set ended_at = null, end_reason = null, leave_reason = null where id = v_session.id;
  exception when unique_violation then
    raise exception 'Someone sits in that seat, or the player sits elsewhere' using errcode = 'RVOCC';
  end;
  update public.top_up_request set closed_at = null, outcome = null
  where session_id = v_session.id and outcome = 'left' and closed_at = v_session.ended_at;
  update public.call_time_request set status = 'requested', decided_at = null
  where session_id = v_session.id and status = 'left' and decided_at = v_session.updated_at;
  perform private.emit(v_session.venue_id, 'seat.taken',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat), 'seat.taken:' || v_session.id || ':' || clock_timestamp());
end;
$function$

;
