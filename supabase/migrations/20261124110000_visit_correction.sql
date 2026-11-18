-- Correct a visit from Reports as from Bonus approvals (#1075, the owner, 18 Nov): a super admin moves a visit's check-in
-- and check-out as well as each seat's end and time away, in one call that both screens use. Every screen reads the same
-- rows, so the corrected times show on the Door, the Reports, History, Bonus approvals and the player's app. The Players
-- report's Visits carry each page row's visits for a super admin; Bonus approvals' rows carry the visit's check-in and
-- check-out.
-- Generated from the live definitions by gen1075.py.

-- A super admin corrects one visit (#1075): each listed seat's end and whole time away as private.correct_one_seat takes
-- them, and its check-in and check-out (null keeps either), with one reason kept in Activity. Check-in stays on its club day,
-- not ahead of now and not after the first seat; check-out, only for a visit that is over, falls after check-in, not ahead
-- of now, not before the last seat ends and not past the club day's end unless the visit already ran past it; the visit
-- runs into none of the member's others. The visit's play-time Bonus
-- is then weighed once on the corrected time, as private.correct_seat_sessions did (#1061): waiting steps it no longer
-- reaches are refused ('Session corrected'), steps it newly reaches wait, Bonus given stays and is counted.
create function private.correct_visit(p_visit_id uuid, p_seats jsonb, p_reason text, p_opened_at timestamptz default null,
                                      p_closed_at timestamptz default null)
returns table (o_refused integer, o_given_above integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_seats jsonb := coalesce(p_seats, '[]'::jsonb);
  v_visit public.visit;
  v_open timestamptz;
  v_close timestamptz;
  v_seat jsonb;
  v_done jsonb[] := array[]::jsonb[];
  v_refused uuid[];
  v_above integer;
begin
  select vi.* into v_visit from public.visit vi where vi.id = p_visit_id for update;
  if v_visit.id is null or not coalesce(private.is_super_admin(v_visit.venue_id), false) then
    raise exception 'Only a super admin corrects a visit' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_visit.member_id) or coalesce(private.is_own_kyc_check(v_visit.member_id), false) then
    raise exception 'Staff never correct a visit of their own record' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(v_visit.venue_id, null, v_visit.member_id);
  if length(v_reason) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(v_seats) is distinct from 'array' or jsonb_array_length(v_seats) > 20
     or (select count(distinct e ->> 'sessionId') from jsonb_array_elements(v_seats) e) <> jsonb_array_length(v_seats) then
    raise exception 'Up to twenty seats, each once' using errcode = '22023';
  end if;
  if p_closed_at is not null and v_visit.closed_at is null then
    raise exception 'A visit still open is checked out at the door, not here' using errcode = '22023';
  end if;
  v_open := coalesce(p_opened_at, v_visit.opened_at);
  v_close := coalesce(p_closed_at, v_visit.closed_at);
  if v_open = v_visit.opened_at and v_close is not distinct from v_visit.closed_at and jsonb_array_length(v_seats) = 0 then
    raise exception 'Nothing to correct' using errcode = '22023';
  end if;
  if v_open > now() or private.club_day_of(v_open) <> private.club_day_of(v_visit.opened_at) or v_close <= v_open or v_close > now() then
    raise exception 'Check-in stays on its club day; check-out falls after it, and neither ahead of now' using errcode = '22023';
  end if;
  -- A correction never stretches a visit past its club day's end, 06:00 IST the next morning, unless it already ran past it.
  if v_close > greatest((private.club_day_of(v_visit.opened_at) + 1 + time '06:00') at time zone 'Asia/Kolkata', v_visit.closed_at) then
    raise exception 'Check-out stays within the visit''s club day' using errcode = '22023';
  end if;
  if exists (select 1 from public.visit o where o.member_id = v_visit.member_id and o.id <> v_visit.id
             and o.opened_at < coalesce(v_close, 'infinity') and coalesce(o.closed_at, 'infinity') > v_open) then
    raise exception 'The visit runs into the member''s other visit' using errcode = '22023';
  end if;
  -- The visit first, so each seat's end is held to the corrected check-out.
  update public.visit set opened_at = v_open, closed_at = v_close
  where id = v_visit.id and (opened_at <> v_open or closed_at is distinct from v_close);
  for v_seat in select e from jsonb_array_elements(v_seats) e loop
    v_done := v_done || private.correct_one_seat(v_visit.id, (v_seat ->> 'sessionId')::uuid, (v_seat ->> 'awaySeconds')::integer,
                                                 (v_seat ->> 'endedAt')::timestamptz);
  end loop;
  if exists (select 1 from public.seat_session s where s.visit_id = v_visit.id and (s.started_at < v_open or s.ended_at > v_close)) then
    raise exception 'Check-in falls before the first seat, and check-out after the last' using errcode = '22023';
  end if;
  select array_agg(g.id order by g.created_at) filter (where g.status = 'waiting'), count(*) filter (where g.status = 'given')
    into v_refused, v_above
  from public.promotion_grant g
  join public.promotion_version pv on pv.id = g.promotion_version_id
  cross join lateral private.visit_schedule_time_at(v_visit.id, pv.schedule, pv.eligibility, coalesce(v_close, now())) t
  where g.venue_id = v_visit.venue_id and g.member_id = v_visit.member_id and g.trigger = 'hours_step'
    and g.status in ('waiting', 'given') and g.source_key like ('hours_step:' || v_visit.id || ':%')
    and t.o_seconds / 60 < (g.event ->> 'stepMinutes')::integer;
  if v_refused is not null then
    perform private.decide_promotion_bonus(v_visit.venue_id, v_refused, 'refused', 'Session corrected', gen_random_uuid());
  end if;
  perform private.weigh_hours_steps(v_visit.id, coalesce(v_close, now()));
  if v_open <> v_visit.opened_at or v_close is distinct from v_visit.closed_at then
    perform private.audit(v_visit.venue_id, 'visit.times_corrected', 'visit', v_visit.id::text,
                          jsonb_build_object('opened_at', v_visit.opened_at, 'closed_at', v_visit.closed_at),
                          jsonb_build_object('opened_at', v_open, 'closed_at', v_close, 'member_id', v_visit.member_id, 'given_above', v_above), v_reason);
  end if;
  foreach v_seat in array v_done loop
    perform private.audit(v_visit.venue_id, 'seat.session_corrected', 'seat_session', v_seat ->> 'session_id', v_seat -> 'before',
                          (v_seat -> 'after') || jsonb_build_object('member_id', v_visit.member_id, 'given_above', v_above), v_reason);
  end loop;
  return query select coalesce(cardinality(v_refused), 0), v_above;
end;
$$;

create function public.correct_visit(p_visit_id uuid, p_seats jsonb, p_reason text, p_opened_at timestamptz default null,
                                     p_closed_at timestamptz default null)
returns table (refused integer, given_above integer)
language sql
set search_path = ''
as $$ select o_refused, o_given_above from private.correct_visit(p_visit_id, p_seats, p_reason, p_opened_at, p_closed_at); $$;

revoke all on function private.correct_visit(uuid, jsonb, text, timestamptz, timestamptz) from public, anon;
grant execute on function private.correct_visit(uuid, jsonb, text, timestamptz, timestamptz) to authenticated;
revoke all on function public.correct_visit(uuid, jsonb, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.correct_visit(uuid, jsonb, text, timestamptz, timestamptz) to authenticated;

-- The seats-only correction (#1061) is now the visit's, its times kept: one to twenty seats of one visit. Kept for a
-- console still open from before this release.
create or replace function private.correct_seat_sessions(p_seats jsonb, p_reason text)
returns table (o_refused integer, o_given_above integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_seats) is distinct from 'array' or jsonb_array_length(p_seats) not between 1 and 20 then
    raise exception 'One to twenty seats, each once' using errcode = '22023';
  end if;
  return query select c.o_refused, c.o_given_above from private.correct_visit(
    (select s.visit_id from public.seat_session s where s.id = (p_seats -> 0 ->> 'sessionId')::uuid), p_seats, p_reason) c;
end;
$$;

-- Every list's source, with Bonus approvals' visit times.
CREATE OR REPLACE FUNCTION private.list_spec(p_list text, OUT o_source text, OUT o_columns jsonb, OUT o_search text[], OUT o_order text, OUT o_choices text[])
 RETURNS record
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select s.source, s.columns, s.search, s.sorted, s.choices
  from (values
    -- Open Feedback tickets (F-013), as private.open_feedback gives them, oldest first.
    ('feedback_open',
     $src$
       select f.id, m.id as member_id, m.full_name, m.member_number, v.closed_at as visit_closed_at, f.score, f.note, f.created_at, f.topic, f.ratings, f.nps,
              (select string_agg(distinct g.name, ', ' order by g.name)
               from public.seat_session s join public.game_table g on g.id = s.table_id where s.visit_id = f.visit_id) as tables,
              (select extract(epoch from min(s.started_at) - v.opened_at)::integer from public.seat_session s where s.visit_id = f.visit_id) as wait_seconds
       from public.feedback f
       join public.member m on m.id = f.member_id
       left join public.visit v on v.id = f.visit_id
       where f.venue_id = $1 and f.is_ticket and f.resolved_at is null and (select private.has_permission($1, 'feedback.manage'))
     $src$,
     '{"member": "full_name", "age": "extract(epoch from now() - created_at) / 3600.0", "rating": "coalesce(score, 0)", "visit": "tables", "note": "note"}'::jsonb,
     array['full_name', 'note', 'topic'], 'created_at, id', array['rating']),
    -- The ID checks' queue, as private.kyc_review_queue gives it: those to review first, then the unfinished and the
    -- refused of the last 90 days.
    ('kyc_review',
     $src$
       select k.member_id, m.full_name, k.status, k.method,
              case
                when k.status <> 'needs_review' then null
                when k.pan_recheck in ('pan_invalid', 'name_differs', 'date_of_birth_differs') then 'recheck_' || k.pan_recheck
                when k.method = 'pan' then 'pan_alone'
                when k.date_of_birth is null and k.pan is null and k.aadhaar_reference is null then 'nothing_kept'
                when k.date_of_birth is null then 'no_date_of_birth'
                when private.kyc_clashes(k.member_id) then 'clash'
              end as waiting_because,
              k.date_of_birth, k.masked_aadhaar, k.pan, k.address, k.photo_path, k.liveness_score, k.face_match_score, k.vendor_reference, k.refusal,
              array(select om.full_name from public.kyc_record o join public.member om on om.id = o.member_id
                    where private.kyc_records_clash(k, o) order by om.full_name) as clashes_with,
              k.updated_at
       from public.kyc_record k join public.member m on m.id = k.member_id
       where k.venue_id = $1 and k.status in ('needs_review', 'needs_pan', 'refused')
         and (k.status = 'needs_review' or k.updated_at > now() - interval '90 days')
         and (select private.has_permission($1, 'kyc.review'))
     $src$,
     '{"name": "full_name", "status": "status"}'::jsonb,
     array['full_name'], '(status = ''needs_review'') desc, updated_at, member_id', array['status']),
    -- A club day's orders, as private.fnb_orders_tonight gives tonight's: the day and the state are the screen's choice
    -- (today, and the orders still open, unless the view says otherwise). Open orders come oldest first; the rest newest.
    ('fnb_orders',
     $src$
       select listed.* from (
         select o.id as order_id, o.kot_number, g.name as table_name, o.seat, m.full_name as member_name, m.member_number, o.lines, o.is_comp, o.source,
                o.created_at, o.kot_sent_at, o.kot_sent_by, o.accepted_at, o.delivered_at,
                floor(extract(epoch from coalesce(o.delivered_at, o.cancelled_at, now()) - o.created_at))::integer as age_seconds,
                o.cancelled_at, o.cancel_reason, o.on_way_at,
                o.kot_sent_at is null and o.cancelled_at is null and o.accepted_at is null and o.delivered_at is null and exists (
                  select 1 from public.outbox_event e
                  join public.outbox_delivery d on d.event_id = e.id and d.venue_id = e.venue_id and d.consumer = 'bar_printer'
                  where e.venue_id = o.venue_id and e.event_type = 'fnb.ordered' and e.idempotency_key = 'fnb.ordered:' || o.id
                    and (d.status = 'failed' or d.status = 'delivered')) as kot_print_failed,
                coalesce((select case when s.leaving_at is null then 'seated' else 'leaving' end
                          from public.seat_session s
                          where s.venue_id = o.venue_id and s.member_id = o.member_id and s.ended_at is null), 'left') as seat_state,
                case when o.cancelled_at is not null then 'void' when o.delivered_at is not null then 'delivered'
                     when o.accepted_at is null then 'to_accept' else 'preparing' end as state
         from public.fnb_order o
         join public.game_table g on g.id = o.table_id
         join public.member m on m.id = o.member_id
         where o.venue_id = $1 and o.club_day = coalesce(nullif($2 #>> '{scope,day}', '')::date, private.club_day_now())
           and (select private.may_serve_fnb($1))) listed
       where case coalesce($2 #>> '{scope,state}', 'open') when 'open' then listed.state in ('to_accept', 'preparing')
                                                            when 'all' then true else listed.state = $2 #>> '{scope,state}' end
     $src$,
     '{"kot": "kot_number", "table": "table_name", "member": "member_name", "age": "age_seconds / 3600.0", "state": "state"}'::jsonb,
     array['member_name', 'table_name', 'kot_number', 'lines'],
     'case when state in (''to_accept'', ''preparing'') then created_at end, created_at desc, kot_number desc', array['state', 'table']),
    -- Everyone at the door today (#641, #72): today's players, each with their tier, their ID check and which of the
    -- door's lists they are on. In the club with a visit open; expected while on a waitlist and not yet in.
    -- KYC_STATUS stands for the ID check's words as the Members list has them (private.members_column_sql).
    ('door',
     replace($src$
       select listed.* from (
         select tp.member_id, tp.full_name, tp.member_number, t.name as tier_name,
                t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired) as is_base_tier,
                case when tp.status = 'waiting' and ov.id is null then 'expected' else tp.status end as status,
                case when ov.id is not null or tp.status = 'playing' then 'in_club' when tp.status = 'waiting' then 'expected'
                     when tp.status = 'left' then 'left' else 'not_arrived' end as list,
                tp.checked_in_at, tp.checked_out_at, tp.waiting_seconds, tp.tables,
                coalesce((select sum((x ->> 'seconds')::bigint) from jsonb_array_elements(tp.tables) x), 0)::bigint as played_seconds,
                (select string_agg(x ->> 'table', ', ') from jsonb_array_elements(tp.tables) x) as table_names,
                KYC_STATUS as kyc_status,
                coalesce(ov.opened_at, (select min(e.joined_at) from public.waitlist_entry e where e.member_id = tp.member_id and e.status = 'waiting')) as since,
                (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
                 where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.created_at) = private.club_day_now())::bigint as bonus_paise,
                -- The member's mobile for floor and up (#1073, members.phone); none for anyone else.
                case when (select private.has_permission($1, 'members.phone')) then m.phone end as phone
         from private.todays_players($1) tp
         join public.member m on m.id = tp.member_id
         join public.tier t on t.id = m.tier_id
         left join public.visit ov on ov.member_id = tp.member_id and ov.closed_at is null) listed
       where coalesce($2 #>> '{scope,list}', 'all') in ('all', listed.list)
     $src$, 'KYC_STATUS', private.members_column_sql('kyc')),
     '{"player": "full_name", "number": "member_number", "tier": "tier_name", "status": "status", "in": "checked_in_at", "out": "checked_out_at",
       "waited": "waiting_seconds / 3600.0", "table": "table_names", "played": "played_seconds / 3600.0", "kyc": "kyc_status",
       "list": "list", "arrived": "(checked_in_at is not null)", "bonus": "bonus_paise / 100",
       "status:sort": "array_position(array[''waiting'', ''expected'', ''playing'', ''in_room'', ''left'', ''never_arrived''], status)"}'::jsonb,
     array['full_name', 'member_number'], 'full_name, member_id', array['status', 'tier', 'kyc', 'list', 'arrived']),
    -- The Waitlist as one list (redesign RD-31; the owner, 15 Nov): every place on every table's list, as
    -- private.waitlist_board gives them, each with its table. Each table keeps its own list and its own order: the
    -- places come table by table, in place order. The screen may ask for one table's list alone.
    ('waitlist',
     $src$
       select b.entry_id, b.table_type_id, b.member_id, b.full_name, b.joined_at, b.place, b.added_by_floor, b.priority_reason, b.call_table_name,
              b.call_seat, b.hold_until, b.away_until, b.asked_table_id, b.on_way_at, b.needs_id_check, g.name as table_name, g.position as table_position
       from private.waitlist_board($1) b
       join public.game_table g on g.id = b.asked_table_id
       where coalesce(nullif($2 #>> '{scope,table}', '')::uuid, b.asked_table_id) = b.asked_table_id
     $src$,
     '{"player": "full_name", "table": "table_name", "place": "place", "waited": "extract(epoch from now() - joined_at) / 3600.0"}'::jsonb,
     array['full_name'], 'table_position, table_name, place', array['table']),
    -- Bonus a promotion calculated, waiting for a super admin (decision 0670), the oldest first. A super admin's own
    -- record's are not theirs to decide, so not listed; nor an erased member's.
    ('bonus_waiting',
     $src$
       select g.id as grant_id, g.member_id, m.full_name, m.member_number, g.promotion_id, coalesce(v.name, p.name) as promotion_name,
              g.cost_paise as amount_paise, g.trigger, coalesce((g.event ->> 'at')::timestamptz, g.created_at) as event_at,
              (g.event ->> 'stepMinutes')::integer as step_minutes, t.name as table_name, g.club_day,
              sess.visit_id, sess.sessions, sess.seated_at, sess.left_at, sess.away_seconds, sess.played_seconds, sess.visit_opened_at, sess.visit_closed_at
       from public.promotion_grant g
       join public.member m on m.id = g.member_id and m.erased_at is null
       join public.promotion p on p.id = g.promotion_id
       left join public.promotion_version v on v.id = g.promotion_version_id
       left join public.game_table t on t.id = g.table_id
       -- A play-time step's visit (#1061): its seats, when they sat and left, time away and time played, for the correction.
       left join lateral (
         select vi.id as visit_id, vi.opened_at as visit_opened_at, vi.closed_at as visit_closed_at,
                jsonb_agg(jsonb_build_object('id', s.id, 'table', st.name, 'startedAt', s.started_at, 'endedAt', s.ended_at,
                                             'awaySeconds', a.away) order by s.started_at) as sessions,
                min(s.started_at) as seated_at,
                case when bool_and(s.ended_at is not null) then max(s.ended_at) end as left_at,
                sum(a.away)::bigint as away_seconds,
                sum(greatest(0, floor(extract(epoch from coalesce(s.ended_at, now()) - s.started_at)) - a.away))::bigint as played_seconds
         from public.visit vi
         join public.seat_session s on s.visit_id = vi.id
         join public.game_table st on st.id = s.table_id
         -- Time away with any still running: a player away now is away until they come back.
         cross join lateral (select s.away_seconds + coalesce(floor(extract(epoch from now() - s.away_since))::integer, 0) as away) a
         where vi.venue_id = g.venue_id
           and vi.id = case when g.trigger = 'hours_step' and split_part(g.source_key, ':', 2) ~ '^[0-9a-f-]{36}$'
                            then split_part(g.source_key, ':', 2)::uuid end
         group by vi.id) sess on true
       where g.venue_id = $1 and g.status = 'waiting' and (select private.is_super_admin($1))
         and not private.is_own_cage_record(g.member_id) and not coalesce(private.is_own_kyc_check(g.member_id), false)
     $src$,
     '{"member": "full_name", "number": "member_number", "promotion": "promotion_name", "amount": "amount_paise / 100", "why": "trigger",
       "when": "club_day", "when:sort": "event_at"}'::jsonb,
     array['full_name', 'member_number', 'promotion_name'], 'event_at, full_name, grant_id', array['promotion', 'why']),
    -- Bonus given in a report's span (#1063, the owner, 17 Nov): each grant, newest first, with where it came from and who
    -- gave it: by hand, the staff member; a promotion, its name and the super admin who approved it; a high hand, who
    -- logged it; anything else, its reason alone. For staff who read reports; never the practice venue. The span is the
    -- screen's own choice, scope from and to as whole dates (YYYY-MM-DD), 92 club days at most counted from `from`.
    ('bonus_given',
     $src$
       select g.id as grant_id, g.created_at as given_at, m.id as member_id, m.full_name, m.member_number, g.amount_paise, g.reason,
              case when h.id is not null then 'high_hand' when pg.id is not null then 'promotion'
                   when g.idempotency_key like 'bonus.hand:%' then 'by_hand' else 'other' end as source,
              coalesce(pv.name, p.name) as promotion_name,
              coalesce(hs.full_name, ds.full_name, case when g.idempotency_key like 'bonus.hand:%' then gs.full_name end) as staff_name
       from public.bonus_grant g
       join public.member m on m.id = g.member_id
       left join public.high_hand_hit h on h.bonus_grant_id = g.id
       left join public.staff hs on hs.id = h.logged_by_staff_id
       left join public.promotion_grant pg on pg.bonus_grant_id = g.id
       left join public.promotion p on p.id = pg.promotion_id
       left join public.promotion_version pv on pv.id = pg.promotion_version_id
       left join public.promotion_bonus_decision d on d.id = pg.decision_id
       left join public.staff ds on ds.id = d.decided_by_staff_id
       left join public.ledger_transaction lt on lt.id = g.ledger_transaction_id
       left join public.staff gs on gs.user_id = lt.created_by_user_id and gs.venue_id = g.venue_id
       cross join (select case when $2 #>> '{scope,from}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,from}')::date end as from_day,
                          case when $2 #>> '{scope,to}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,to}')::date end as to_day) s
       where g.venue_id = $1 and (select private.has_permission($1, 'reports.read'))
         and not exists (select 1 from public.venue v where v.id = $1 and v.is_practice)
         and private.club_day_of(g.created_at) between s.from_day and least(s.to_day, s.from_day + 91)
     $src$,
     '{"when": "given_at", "member": "full_name", "number": "member_number", "amount": "amount_paise / 100", "by": "staff_name",
       "source": "source", "reason": "reason"}'::jsonb,
     array['full_name', 'member_number', 'staff_name', 'promotion_name', 'reason'], 'given_at desc, grant_id', array['source']),
    -- Every visit in a report's span (decision 0682): each member who came in on each club day, as the door's Today's
    -- players gives the day, for staff who read reports (and members, as private.todays_players asks); never the practice
    -- venue. One on a list from the app who never came in is no visit. The span is the screen's own choice, scope from and
    -- to as whole dates (YYYY-MM-DD), 92 club days at most counted from `from`: anything else is no day at all. Newest first.
    ('player_visits',
     replace($src$
       select tp_day.club_day, tp.member_id, tp.full_name, tp.member_number, t.name as tier_name,
              t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired) as is_base_tier,
              tp.checked_in_at, tp.checked_out_at, tp.waiting_seconds, tp.tables,
              coalesce((select sum((x ->> 'seconds')::bigint) from jsonb_array_elements(tp.tables) x), 0)::bigint as played_seconds,
              (select string_agg(x ->> 'table', ', ') from jsonb_array_elements(tp.tables) x) as table_names,
              KYC_STATUS as kyc_status,
              (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
               where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.created_at) = tp_day.club_day)::bigint as bonus_paise
       from (select s.from_day + n as club_day
             from (select case when $2 #>> '{scope,from}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,from}')::date end as from_day,
                          case when $2 #>> '{scope,to}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,to}')::date end as to_day) s
             -- least() passes over a null, and todays_players takes no day as today: a date missing is no day at all.
             cross join generate_series(0, least(s.to_day - s.from_day, 91)) n
             where s.from_day is not null and s.to_day is not null) tp_day
       cross join lateral private.todays_players($1, tp_day.club_day) tp
       join public.member m on m.id = tp.member_id
       join public.tier t on t.id = m.tier_id
       where (select private.has_permission($1, 'reports.read'))
         and not exists (select 1 from public.venue v where v.id = $1 and v.is_practice)
         and (tp.checked_in_at is not null or jsonb_array_length(tp.tables) > 0)
     $src$, 'KYC_STATUS', private.members_column_sql('kyc')),
     '{"date": "club_day", "player": "full_name", "number": "member_number", "tier": "tier_name", "in": "checked_in_at", "out": "checked_out_at",
       "waited": "waiting_seconds / 3600.0", "table": "table_names", "played": "played_seconds / 3600.0", "kyc": "kyc_status",
       "bonus": "bonus_paise / 100"}'::jsonb,
     array['full_name', 'member_number'], 'club_day desc, full_name, member_id', array['tier'])
  ) as s(list, source, columns, search, sorted, choices)
  where s.list = p_list;
$function$;

drop function public.player_visits_page(uuid, jsonb);
drop function private.player_visits_page(uuid, jsonb);
CREATE OR REPLACE FUNCTION private.player_visits_page(p_venue_id uuid, p_view jsonb)
 RETURNS TABLE(total bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint, visits jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with page as materialized (select private.list_json('player_visits', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.club_day, r.member_id, r.full_name, r.member_number, r.tier_name, r.is_base_tier, r.checked_in_at,
         r.checked_out_at, r.waiting_seconds, r.tables, r.played_seconds, r.kyc_status, r.bonus_paise,
         -- For a super admin, who corrects them (#1075): each row's visits that club day, built for the page's rows alone, each
         -- with its seats as Bonus approvals has them, time away with any still running. Null for anyone else.
         case when (select private.is_super_admin(p_venue_id)) then (
           select jsonb_agg(jsonb_build_object('visitId', vi.id, 'openedAt', vi.opened_at, 'closedAt', vi.closed_at, 'sessions', (
                    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'table', st.name, 'startedAt', s.started_at, 'endedAt', s.ended_at,
                             'awaySeconds', s.away_seconds + coalesce(floor(extract(epoch from now() - s.away_since))::integer, 0)) order by s.started_at), '[]'::jsonb)
                    from public.seat_session s join public.game_table st on st.id = s.table_id where s.visit_id = vi.id)) order by vi.opened_at)
           from public.visit vi
           where vi.venue_id = p_venue_id and vi.member_id = r.member_id
             and vi.opened_at >= (r.club_day + time '06:00') at time zone 'Asia/Kolkata'
             and vi.opened_at < (r.club_day + 1 + time '06:00') at time zone 'Asia/Kolkata') end
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean,
    checked_in_at timestamptz, checked_out_at timestamptz, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint)
  order by r.list_place;
$function$;

CREATE OR REPLACE FUNCTION public.player_visits_page(p_venue_id uuid, p_view jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint, visits jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.player_visits_page(p_venue_id, p_view); $function$;

revoke all on function private.player_visits_page(uuid, jsonb) from public, anon;
grant execute on function private.player_visits_page(uuid, jsonb) to authenticated;
revoke all on function public.player_visits_page(uuid, jsonb) from public, anon;
grant execute on function public.player_visits_page(uuid, jsonb) to authenticated;

drop function public.bonus_waiting_page(uuid, jsonb);
drop function private.bonus_waiting_page(uuid, jsonb);
CREATE OR REPLACE FUNCTION private.bonus_waiting_page(p_venue_id uuid, p_view jsonb)
 RETURNS TABLE(total bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text, amount_paise bigint, trigger text, event_at timestamp with time zone, step_minutes integer, table_name text, club_day date, visit_id uuid, sessions jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, away_seconds bigint, played_seconds bigint, visit_opened_at timestamp with time zone, visit_closed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with page as materialized (select private.list_json('bonus_waiting', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.grant_id, r.member_id, r.full_name, r.member_number, r.promotion_id, r.promotion_name,
         r.amount_paise, r.trigger, r.event_at, r.step_minutes, r.table_name, r.club_day, r.visit_id, r.sessions, r.seated_at, r.left_at, r.away_seconds, r.played_seconds, r.visit_opened_at, r.visit_closed_at
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text,
    amount_paise bigint, trigger text, event_at timestamptz, step_minutes integer, table_name text, club_day date,
    visit_id uuid, sessions jsonb, seated_at timestamptz, left_at timestamptz, away_seconds bigint, played_seconds bigint, visit_opened_at timestamp with time zone, visit_closed_at timestamp with time zone)
  order by r.list_place;
$function$;

CREATE OR REPLACE FUNCTION public.bonus_waiting_page(p_venue_id uuid, p_view jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text, amount_paise bigint, trigger text, event_at timestamp with time zone, step_minutes integer, table_name text, club_day date, visit_id uuid, sessions jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, away_seconds bigint, played_seconds bigint, visit_opened_at timestamp with time zone, visit_closed_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.bonus_waiting_page(p_venue_id, p_view); $function$;

revoke all on function private.bonus_waiting_page(uuid, jsonb) from public, anon;
grant execute on function private.bonus_waiting_page(uuid, jsonb) to authenticated;
revoke all on function public.bonus_waiting_page(uuid, jsonb) from public, anon;
grant execute on function public.bonus_waiting_page(uuid, jsonb) to authenticated;
