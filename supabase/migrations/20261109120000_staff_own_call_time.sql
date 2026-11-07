-- A staff member who is also a member never cuts their own call time nor lets themselves leave before it (the security
-- review of 8 Nov): as 20261101090200_table_runs_and_call_time.sql and 20261019092700_call_time_at_cash_out.sql made them,
-- with RVOWN on their own record. Adding time to their own seat stays allowed.
create or replace function private.set_seat_call_time(p_session_id uuid, p_minutes integer)
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
    raise exception 'Only the floor changes a player''s call time' using errcode = '42501';
  end if;
  if v_session.ended_at is not null or v_session.call_time_completed_at is not null
     or (v_session.call_time_minutes > 0 and private.session_call_time(v_session, now()) = 0)
     or p_minutes is null or p_minutes not between 0 and 1440 then
    raise exception 'A seated player''s call time, not yet played out, is 0 to 1,440 minutes' using errcode = '22023';
  end if;
  if p_minutes < v_session.call_time_minutes and not private.has_permission(v_session.venue_id, 'call_time.override') then
    raise exception 'Only an admin cuts a player''s call time' using errcode = '42501';
  end if;
  if p_minutes < v_session.call_time_minutes and private.is_own_cage_record(v_session.member_id) then
    raise exception 'Staff never cut their own call time' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  update public.seat_session
  set call_time_minutes = p_minutes
  where id = v_session.id;
end;
$$;

create or replace function private.let_leave_early(p_venue_id uuid, p_member_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owed record;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'call_time.override') then
    raise exception 'Only an admin lets a player leave before call time' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if private.is_own_cage_record(p_member_id) then
    raise exception 'Staff never let themselves leave before call time' using errcode = 'RVOWN';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Say why, in 3 to 500 characters' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) = 0 then
    raise exception 'No call time owed: nothing to let go early' using errcode = 'RVCTD';
  end if;
  insert into public.early_departure (venue_id, member_id, visit_id, session_id, shortfall_seconds, reason, overridden_by_staff_id)
  values (p_venue_id, p_member_id, private.current_visit(p_member_id), v_owed.o_session_id, v_owed.o_seconds, btrim(p_reason),
          private.current_staff_id(p_venue_id))
  on conflict (session_id) do nothing
  returning id into v_id;
  return coalesce(v_id, (select e.id from public.early_departure e where e.session_id = v_owed.o_session_id));
end;
$$;
