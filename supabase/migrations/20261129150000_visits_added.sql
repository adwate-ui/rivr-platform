-- Visits added by hand from the console (the owner, 25 Nov; #1134): a past visit, its check-in, check-out and one table,
-- which counts like a real one (History, Reports, visit counts, cab eligibility) and whose play-time Bonus waits in Bonus
-- approvals as an Edit's does. A super admin's add counts at once; the floor's and an admin's waits until a super admin
-- approves it, or refuses it with a reason. Every add is a visit_request row, approved at once for a super admin, so where
-- a visit came from and a retry are kept in one place. An added visit is one seat at its table for the whole visit, with no
-- call time owed, closed 'by_hand'; it sends no visit.opened or visit.closed, and gives no check-in or seat Bonus.

alter table public.visit drop constraint visit_close_reason_check;
alter table public.visit add constraint visit_close_reason_check check (close_reason in ('door', 'cash_out', 'end_of_day', 'by_hand'));

insert into public.role_permission (role, permission)
select 'floor', permission from unnest(array['visits.add']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['visits.add']) as permission;
insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['visits.add']) as permission;

create table public.visit_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  table_id uuid not null,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 3 and 200),
  status text not null check (status in ('waiting', 'approved', 'refused')),
  requested_by_staff_id uuid not null,
  requested_at timestamptz not null default now(),
  decided_by_staff_id uuid,
  decided_at timestamptz,
  -- Why a super admin refused it.
  refusal text check (refusal is null or length(btrim(refusal)) between 3 and 200),
  -- The visit it made, once approved.
  visit_id uuid references public.visit (id),
  -- The add's request id, and its line: 1 by hand, the file's line from a file.
  request_id uuid not null,
  line integer not null default 1 check (line >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, request_id, line),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (requested_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id),
  check (closed_at > opened_at),
  check ((status = 'waiting') = (decided_at is null)),
  check ((status = 'approved') = (visit_id is not null)),
  check ((status = 'refused') = (refusal is not null))
);
comment on table public.visit_request is 'A past visit added by hand or from a file (the owner, 25 Nov): approved at once for a super admin, else waiting for one.';
alter table public.visit_request enable row level security;
create trigger visit_request_touch_updated_at before update on public.visit_request for each row execute function private.touch_updated_at();
create index visit_request_waiting_idx on public.visit_request (venue_id) where status = 'waiting';
create index visit_request_member_id_idx on public.visit_request (member_id);
create index visit_request_table_id_idx on public.visit_request (table_id);
create index visit_request_visit_id_idx on public.visit_request (visit_id);
create index visit_request_requested_by_idx on public.visit_request (requested_by_staff_id);
create index visit_request_decided_by_idx on public.visit_request (decided_by_staff_id);
-- A member's export carries their added visits, as their visits; why staff added or refused one is the staff's note.
insert into private.member_export_column (table_name, column_name, kind)
select 'visit_request', c, 'owed' from unnest(array['id', 'venue_id', 'member_id', 'table_id', 'opened_at', 'closed_at', 'status',
  'requested_by_staff_id', 'requested_at', 'decided_by_staff_id', 'decided_at', 'visit_id', 'request_id', 'line', 'created_at',
  'updated_at']) as c;
insert into private.member_export_column (table_name, column_name, kind)
select 'visit_request', c, 'note' from unnest(array['reason', 'refusal']) as c;

-- The rules a visit added must keep, as an Edit keeps them: a member of the venue (RVNOM) not the staff member's own
-- (RVOWN); a table of the venue (RVTBL); a reason of 3 to 200 characters (22023); check-out after check-in and neither
-- ahead of now (RVVTM); check-out by 06:00 IST after the check-in's club day (RVVDY); and no clash with the member's other
-- visits (RVVCL).
create function private.assert_visit_to_add(p_venue_id uuid, p_member_id uuid, p_table_id uuid, p_opened_at timestamptz, p_closed_at timestamptz,
                                            p_reason text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id and m.erased_at is null) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if private.is_own_cage_record(p_member_id) or coalesce(private.is_own_kyc_check(p_member_id), false) then
    raise exception 'Staff never add a visit to their own record' using errcode = 'RVOWN';
  end if;
  if not exists (select 1 from public.game_table g where g.id = p_table_id and g.venue_id = p_venue_id) then
    raise exception 'No such table here' using errcode = 'RVTBL';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 200 or p_reason ~ '[[:cntrl:]]' then
    raise exception 'A reason of 3 to 200 characters, on one line' using errcode = '22023';
  end if;
  if p_opened_at is null or p_closed_at is null or p_closed_at <= p_opened_at or p_closed_at > now() then
    raise exception 'Check-out falls after check-in, and neither ahead of now' using errcode = 'RVVTM';
  end if;
  if p_closed_at > (private.club_day_of(p_opened_at) + 1 + time '06:00') at time zone 'Asia/Kolkata' then
    raise exception 'Check-out stays within the visit''s club day' using errcode = 'RVVDY';
  end if;
  if exists (select 1 from public.visit o where o.member_id = p_member_id
             and o.opened_at < p_closed_at and coalesce(o.closed_at, 'infinity') > p_opened_at) then
    raise exception 'The visit runs into the member''s other visit' using errcode = 'RVVCL';
  end if;
end;
$$;

-- The visit an add makes: closed 'by_hand', checked in by the staff member who asked; one seat at its table for the whole
-- visit with no call time owed, which the minute's seat Bonus sweep never weighs (no seat Bonus for an added visit); its
-- play-time Bonus weighed once on its own times, waiting in Bonus approvals; and the member's referral, if this is their
-- first seat. Refused while promotions are stopped (RVKIL), as nothing weighs a closed visit's Bonus or its referral
-- later. Its id.
create function private.insert_added_visit(p_venue_id uuid, p_member_id uuid, p_table_id uuid, p_opened_at timestamptz, p_closed_at timestamptz,
                                           p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit uuid;
  v_seat uuid;
begin
  perform private.assert_writable(p_venue_id, 'promotions', p_member_id);
  insert into public.visit (venue_id, member_id, opened_at, opened_by_staff_id, closed_at, close_reason)
  values (p_venue_id, p_member_id, p_opened_at, p_staff_id, p_closed_at, 'by_hand')
  returning id into v_visit;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  values (p_venue_id, p_member_id, v_visit, p_table_id, 1, p_opened_at, p_opened_at, p_closed_at, 'left')
  returning id into v_seat;
  -- Seating gives the table's minimum playing time; a seat added after the night owes none.
  update public.seat_session set call_time_minutes = 0, call_time_completed_at = null where id = v_seat;
  insert into private.seat_bonus_weighed (seat_session_id) values (v_seat) on conflict do nothing;
  perform private.weigh_hours_steps(v_visit, p_closed_at);
  perform private.complete_referral(p_venue_id, p_member_id, v_seat);
  return v_visit;
end;
$$;
revoke all on function private.assert_visit_to_add(uuid, uuid, uuid, timestamptz, timestamptz, text),
  private.insert_added_visit(uuid, uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- Staff who add visits (visits.add: super admins, admins and the floor) add a past one to a member's record: 'added' with
-- its visit for a super admin, 'waiting' for anyone else until a super admin decides; the same request id again gives the
-- same answer ('refused' once refused). Refusals: 42501 not one who adds visits; 22023 no request id, or one for another
-- visit; the venue or member frozen (assert_writable); the rules of private.assert_visit_to_add; too many at once (RVRAT);
-- and, for a super admin's add, promotions stopped (RVKIL).
create function private.add_visit(p_venue_id uuid, p_member_id uuid, p_table_id uuid, p_opened_at timestamptz, p_closed_at timestamptz,
                                  p_reason text, p_request_id uuid)
returns table (o_status text, o_visit_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done public.visit_request;
  v_staff uuid := private.current_staff_id(p_venue_id);
  v_visit uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'visits.add'), false) or v_staff is null then
    raise exception 'Only the floor and up add a visit' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'A visit is added with a request id' using errcode = '22023';
  end if;
  select * into v_done from public.visit_request r where r.venue_id = p_venue_id and r.request_id = p_request_id and r.line = 1;
  if v_done.id is not null then
    if v_done.member_id <> p_member_id or v_done.table_id <> p_table_id or v_done.opened_at <> p_opened_at or v_done.closed_at <> p_closed_at then
      raise exception 'That request id was for another visit' using errcode = '22023';
    end if;
    return query select case v_done.status when 'approved' then 'added' else v_done.status end, v_done.visit_id;
    return;
  end if;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  perform private.assert_visit_to_add(p_venue_id, p_member_id, p_table_id, p_opened_at, p_closed_at, p_reason);
  perform private.assert_rate(p_venue_id, 'visits.add');
  if coalesce(private.is_super_admin(p_venue_id), false) then
    v_visit := private.insert_added_visit(p_venue_id, p_member_id, p_table_id, p_opened_at, p_closed_at, v_staff);
  end if;
  insert into public.visit_request (venue_id, member_id, table_id, opened_at, closed_at, reason, status, requested_by_staff_id,
                                    decided_by_staff_id, decided_at, visit_id, request_id)
  values (p_venue_id, p_member_id, p_table_id, p_opened_at, p_closed_at, btrim(p_reason), case when v_visit is null then 'waiting' else 'approved' end,
          v_staff, case when v_visit is not null then v_staff end, case when v_visit is not null then now() end, v_visit, p_request_id);
  perform private.audit(p_venue_id, case when v_visit is null then 'visit.add_asked' else 'visit.added' end, 'member', p_member_id::text, null,
                        jsonb_build_object('visit_id', v_visit, 'table_id', p_table_id, 'opened_at', p_opened_at, 'closed_at', p_closed_at),
                        btrim(p_reason));
  return query select case when v_visit is null then 'waiting' else 'added' end, v_visit;
end;
$$;
create function public.add_visit(p_venue_id uuid, p_member_id uuid, p_table_id uuid, p_opened_at timestamptz, p_closed_at timestamptz,
                                 p_reason text, p_request_id uuid)
returns table (o_status text, o_visit_id uuid)
language sql volatile security invoker set search_path = ''
as $$ select * from private.add_visit(p_venue_id, p_member_id, p_table_id, p_opened_at, p_closed_at, p_reason, p_request_id); $$;
revoke all on function private.add_visit(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid),
  public.add_visit(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function private.add_visit(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid),
  public.add_visit(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid) to authenticated;

-- A super admin approves a waiting visit, which adds it as their own add would, held to the same rules now, or refuses it
-- with a reason of 3 to 200 characters. The visit approved, or null. Deciding it again the same way changes nothing.
-- Refusals: 42501 not a super admin of its venue; RVOWN their own record; RVVDD decided the other way already; 22023 no
-- reason; the venue or member frozen; and, approving, the rules of private.assert_visit_to_add and promotions stopped.
create function private.decide_visit_request(p_request_id uuid, p_approve boolean, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.visit_request;
  v_visit uuid;
begin
  select * into v_request from public.visit_request r where r.id = p_request_id for update;
  if v_request.id is null or not coalesce(private.is_super_admin(v_request.venue_id), false) then
    raise exception 'Only a super admin decides an added visit' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_request.member_id) or coalesce(private.is_own_kyc_check(v_request.member_id), false) then
    raise exception 'Staff never decide a visit of their own record' using errcode = 'RVOWN';
  end if;
  if v_request.status = 'approved' and p_approve then
    return v_request.visit_id;
  end if;
  if v_request.status = 'refused' and not p_approve then
    return null;
  end if;
  if v_request.status <> 'waiting' then
    raise exception 'That visit was decided already' using errcode = 'RVVDD';
  end if;
  perform private.assert_writable(v_request.venue_id, null, v_request.member_id);
  if p_approve then
    perform private.assert_visit_to_add(v_request.venue_id, v_request.member_id, v_request.table_id, v_request.opened_at, v_request.closed_at,
                                        v_request.reason);
    v_visit := private.insert_added_visit(v_request.venue_id, v_request.member_id, v_request.table_id, v_request.opened_at,
                                          v_request.closed_at, v_request.requested_by_staff_id);
    update public.visit_request set status = 'approved', decided_by_staff_id = private.current_staff_id(v_request.venue_id), decided_at = now(),
                                    visit_id = v_visit
    where id = v_request.id;
  else
    if length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
      raise exception 'A reason of 3 to 200 characters' using errcode = '22023';
    end if;
    update public.visit_request set status = 'refused', decided_by_staff_id = private.current_staff_id(v_request.venue_id), decided_at = now(),
                                    refusal = btrim(p_reason)
    where id = v_request.id;
  end if;
  perform private.audit(v_request.venue_id, case when p_approve then 'visit.add_approved' else 'visit.add_refused' end, 'member',
                        v_request.member_id::text, null, jsonb_build_object('visit_request_id', v_request.id, 'visit_id', v_visit),
                        case when p_approve then null else btrim(p_reason) end);
  return v_visit;
end;
$$;
create function public.decide_visit_request(p_request_id uuid, p_approve boolean, p_reason text default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.decide_visit_request(p_request_id, p_approve, p_reason); $$;
revoke all on function private.decide_visit_request(uuid, boolean, text), public.decide_visit_request(uuid, boolean, text) from public, anon;
grant execute on function private.decide_visit_request(uuid, boolean, text), public.decide_visit_request(uuid, boolean, text) to authenticated;

-- The visits waiting for a super admin, oldest asked first: the member, the table, the times, why, and who asked. For the
-- venue's super admins, less their own records; nothing for anyone else.
create function private.visits_waiting(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, member_number bigint, full_name text, table_name text, opened_at timestamptz,
               closed_at timestamptz, reason text, requested_by text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, m.id, m.member_number, m.full_name, g.name, r.opened_at, r.closed_at, r.reason, s.full_name, r.requested_at
  from public.visit_request r
  join public.member m on m.id = r.member_id and m.erased_at is null
  join public.game_table g on g.id = r.table_id
  join public.staff s on s.id = r.requested_by_staff_id
  where r.venue_id = p_venue_id and r.status = 'waiting' and coalesce(private.is_super_admin(p_venue_id), false)
    and not private.is_own_cage_record(r.member_id) and not coalesce(private.is_own_kyc_check(r.member_id), false)
  order by r.requested_at, r.id;
$$;
create function public.visits_waiting(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, member_number bigint, full_name text, table_name text, opened_at timestamptz,
               closed_at timestamptz, reason text, requested_by text, requested_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.visits_waiting(p_venue_id); $$;
revoke all on function private.visits_waiting(uuid), public.visits_waiting(uuid) from public, anon;
grant execute on function private.visits_waiting(uuid), public.visits_waiting(uuid) to authenticated;

-- A member's added visits not yet counted, for staff who add visits: those waiting, and those refused in the last seven
-- days with why, newest first.
create function private.member_visit_requests(p_venue_id uuid, p_member_id uuid)
returns table (request_id uuid, table_name text, opened_at timestamptz, closed_at timestamptz, status text, refusal text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, g.name, r.opened_at, r.closed_at, r.status, r.refusal, r.requested_at
  from public.visit_request r
  join public.game_table g on g.id = r.table_id
  where r.venue_id = p_venue_id and r.member_id = p_member_id and coalesce(private.has_permission(p_venue_id, 'visits.add'), false)
    and (r.status = 'waiting' or (r.status = 'refused' and r.decided_at > now() - interval '7 days'))
  order by r.opened_at desc, r.id;
$$;
create function public.member_visit_requests(p_venue_id uuid, p_member_id uuid)
returns table (request_id uuid, table_name text, opened_at timestamptz, closed_at timestamptz, status text, refusal text, requested_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_visit_requests(p_venue_id, p_member_id); $$;
revoke all on function private.member_visit_requests(uuid, uuid), public.member_visit_requests(uuid, uuid) from public, anon;
grant execute on function private.member_visit_requests(uuid, uuid), public.member_visit_requests(uuid, uuid) to authenticated;

-- Each visit on a member's record, as 20261124120000 left it, with its check-out and, for a super admin who edits it, its
-- seats as Bonus approvals has them (#1134); null for anyone else.
drop function public.member_visits(uuid, uuid, integer);
drop function private.member_visits(uuid, uuid, integer);
create function private.member_visits(p_venue_id uuid, p_member_id uuid, p_limit integer)
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, tables text, minutes_played integer, call_time_met boolean,
               left_early boolean, leave_reasons text[], sessions jsonb)
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
          from public.seat_session s where s.visit_id = v.id and s.call_time_minutes > 0)
           -- Let go before call time is not call time met, though the time was counted for promotions (#1076).
           and not exists (select 1 from public.early_departure e
                           where e.visit_id = v.id and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id)),
         -- A departure withdrawn as a mistake (decision 0500) does not count.
         exists (select 1 from public.early_departure e
                 where e.visit_id = v.id and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id)),
         -- Why they left each table of the visit, in order, those with a reason (#1060).
         array(select s.leave_reason from public.seat_session s where s.visit_id = v.id and s.leave_reason is not null
               order by s.ended_at, s.id),
         case when coalesce(private.is_super_admin(p_venue_id), false) then (
           select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'table', st.name, 'startedAt', s.started_at, 'endedAt', s.ended_at,
                    'awaySeconds', s.away_seconds + coalesce(floor(extract(epoch from now() - s.away_since))::integer, 0)) order by s.started_at), '[]'::jsonb)
           from public.seat_session s join public.game_table st on st.id = s.table_id where s.visit_id = v.id) end
  from public.visit v
  where v.member_id = p_member_id and v.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
  order by v.opened_at desc, v.id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$$;
create function public.member_visits(p_venue_id uuid, p_member_id uuid, p_limit integer default 20)
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, tables text, minutes_played integer, call_time_met boolean,
               left_early boolean, leave_reasons text[], sessions jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_visits(p_venue_id, p_member_id, p_limit); $$;
revoke all on function private.member_visits(uuid, uuid, integer), public.member_visits(uuid, uuid, integer) from public, anon;
grant execute on function private.member_visits(uuid, uuid, integer), public.member_visits(uuid, uuid, integer) to authenticated;
