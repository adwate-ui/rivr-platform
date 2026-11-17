-- Correct a session from Bonus approvals (#1061, the owner, 17 Nov): a super admin changes when a player left and their time
-- away from the table, which is taken off the session's length, and the play-time Bonus is weighed again. Time played is
-- shown net of time away everywhere: the approvals list, Today's players and the Players report (which counted raw time),
-- and the report's average session. Generated from the live definitions by gen1061.py.

-- One seat's correction within a visit's (#1061): when the player left a table they have left, and their whole time away
-- from it, any still running included. Only the part of time away already over is stored, so the part still running is
-- counted once, when they come back. Refuses what does not fit; returns the seat as it was and as it is now, for Activity.
create function private.correct_one_seat(p_visit_id uuid, p_session_id uuid, p_away_seconds integer, p_ended_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_end timestamptz;
  v_running integer;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not coalesce(private.is_super_admin(v_session.venue_id), false) then
    raise exception 'Only a super admin corrects a session' using errcode = '42501';
  end if;
  if v_session.visit_id is distinct from p_visit_id then
    raise exception 'One visit''s seats at a time' using errcode = '22023';
  end if;
  if private.is_own_cage_record(v_session.member_id) or coalesce(private.is_own_kyc_check(v_session.member_id), false) then
    raise exception 'Staff never correct a session of their own record' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  -- Only a session that is over has an end to move: an open one ends at the table.
  if v_session.ended_at is null and p_ended_at is not null then
    raise exception 'A seat still taken ends at the table, not here' using errcode = '22023';
  end if;
  v_end := case when v_session.ended_at is null then null else coalesce(p_ended_at, v_session.ended_at) end;
  if v_end is not null and (v_end <= v_session.seated_here_at or v_end > now()) then
    raise exception 'The end falls after they sat at that table, and not ahead of now' using errcode = '22023';
  end if;
  if p_ended_at is not null and p_ended_at > (select coalesce(vi.closed_at, now()) from public.visit vi where vi.id = v_session.visit_id) then
    raise exception 'The end falls before the visit closed' using errcode = '22023';
  end if;
  if v_end is not null and exists (select 1 from public.seat_session o where o.member_id = v_session.member_id and o.id <> v_session.id
                                    and o.started_at >= v_session.started_at and o.started_at < v_end) then
    raise exception 'The end runs into the member''s next seat' using errcode = '22023';
  end if;
  if p_away_seconds is null or p_away_seconds < 0
     or p_away_seconds > floor(extract(epoch from (coalesce(v_end, now()) - v_session.started_at))) then
    raise exception 'Time away is within the session' using errcode = '22023';
  end if;
  v_running := coalesce(floor(extract(epoch from now() - v_session.away_since))::integer, 0);
  update public.seat_session set ended_at = v_end, away_seconds = greatest(0, p_away_seconds - v_running) where id = v_session.id;
  return jsonb_build_object('session_id', v_session.id,
                            'before', jsonb_build_object('ended_at', v_session.ended_at, 'away_seconds', v_session.away_seconds + v_running),
                            'after', jsonb_build_object('ended_at', v_end, 'away_seconds', p_away_seconds));
end;
$$;

-- A super admin corrects the seats of one visit from Bonus approvals (#1061, the owner, 17 Nov): when the player left each
-- table they have left and their time away from it, with one reason, kept in Activity for each seat. Every screen that
-- shows time played reads the seats' times, so the correction shows everywhere. The seats are saved together, then the
-- visit's play-time Bonus is weighed once on the corrected time, at the visit's close if it is over: waiting steps it no
-- longer reaches are refused ('Session corrected'), and steps it newly reaches wait for approval. Bonus already given
-- stays; how many given steps the corrected time no longer reaches is returned and kept with each seat's entry. p_seats
-- lists one to twenty seats of one visit, each with sessionId, endedAt (null keeps it) and awaySeconds.
create function private.correct_seat_sessions(p_seats jsonb, p_reason text)
returns table (o_refused integer, o_given_above integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_visit public.visit;
  v_seat jsonb;
  v_done jsonb[] := array[]::jsonb[];
  v_at timestamptz;
  v_refused uuid[];
  v_above integer;
begin
  if jsonb_typeof(p_seats) is distinct from 'array' or jsonb_array_length(p_seats) not between 1 and 20
     or (select count(distinct e ->> 'sessionId') from jsonb_array_elements(p_seats) e) <> jsonb_array_length(p_seats) then
    raise exception 'One to twenty seats, each once' using errcode = '22023';
  end if;
  select vi.* into v_visit from public.visit vi
  where vi.id = (select s.visit_id from public.seat_session s where s.id = (p_seats -> 0 ->> 'sessionId')::uuid)
  for update;
  if v_visit.id is null or not coalesce(private.is_super_admin(v_visit.venue_id), false) then
    raise exception 'Only a super admin corrects a session' using errcode = '42501';
  end if;
  if length(v_reason) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters' using errcode = '22023';
  end if;
  for v_seat in select e from jsonb_array_elements(p_seats) e loop
    v_done := v_done || private.correct_one_seat(v_visit.id, (v_seat ->> 'sessionId')::uuid, (v_seat ->> 'awaySeconds')::integer,
                                                 (v_seat ->> 'endedAt')::timestamptz);
  end loop;
  v_at := coalesce(v_visit.closed_at, now());
  select array_agg(g.id order by g.created_at) filter (where g.status = 'waiting'), count(*) filter (where g.status = 'given')
    into v_refused, v_above
  from public.promotion_grant g
  join public.promotion_version pv on pv.id = g.promotion_version_id
  cross join lateral private.visit_schedule_time_at(v_visit.id, pv.schedule, pv.eligibility, v_at) t
  where g.venue_id = v_visit.venue_id and g.member_id = v_visit.member_id and g.trigger = 'hours_step'
    and g.status in ('waiting', 'given') and g.source_key like ('hours_step:' || v_visit.id || ':%')
    and t.o_seconds / 60 < (g.event ->> 'stepMinutes')::integer;
  if v_refused is not null then
    perform private.decide_promotion_bonus(v_visit.venue_id, v_refused, 'refused', 'Session corrected', gen_random_uuid());
  end if;
  perform private.weigh_hours_steps(v_visit.id, v_at);
  foreach v_seat in array v_done loop
    perform private.audit(v_visit.venue_id, 'seat.session_corrected', 'seat_session', v_seat ->> 'session_id', v_seat -> 'before',
                          (v_seat -> 'after') || jsonb_build_object('member_id', v_visit.member_id, 'given_above', v_above), v_reason);
  end loop;
  return query select coalesce(cardinality(v_refused), 0), v_above;
end;
$$;

create function public.correct_seat_sessions(p_seats jsonb, p_reason text)
returns table (refused integer, given_above integer)
language sql
set search_path = ''
as $$ select o_refused, o_given_above from private.correct_seat_sessions(p_seats, p_reason); $$;

revoke all on function private.correct_one_seat(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function private.correct_seat_sessions(jsonb, text) from public, anon;
grant execute on function private.correct_seat_sessions(jsonb, text) to authenticated;
revoke all on function public.correct_seat_sessions(jsonb, text) from public, anon;
grant execute on function public.correct_seat_sessions(jsonb, text) to authenticated;

create or replace function private.list_spec(p_list text, OUT o_source text, OUT o_columns jsonb, OUT o_search text[], OUT o_order text, OUT o_choices text[])
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
                 where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.created_at) = private.club_day_now())::bigint as bonus_paise
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
              sess.visit_id, sess.sessions, sess.seated_at, sess.left_at, sess.away_seconds, sess.played_seconds
       from public.promotion_grant g
       join public.member m on m.id = g.member_id and m.erased_at is null
       join public.promotion p on p.id = g.promotion_id
       left join public.promotion_version v on v.id = g.promotion_version_id
       left join public.game_table t on t.id = g.table_id
       -- A play-time step's visit (#1061): its seats, when they sat and left, time away and time played, for the correction.
       left join lateral (
         select vi.id as visit_id,
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

drop function public.bonus_waiting_page(uuid, jsonb);
drop function private.bonus_waiting_page(uuid, jsonb);
create function private.bonus_waiting_page(p_venue_id uuid, p_view jsonb)
 RETURNS TABLE(total bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text, amount_paise bigint, trigger text, event_at timestamp with time zone, step_minutes integer, table_name text, club_day date, visit_id uuid, sessions jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, away_seconds bigint, played_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with page as materialized (select private.list_json('bonus_waiting', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.grant_id, r.member_id, r.full_name, r.member_number, r.promotion_id, r.promotion_name,
         r.amount_paise, r.trigger, r.event_at, r.step_minutes, r.table_name, r.club_day, r.visit_id, r.sessions, r.seated_at, r.left_at, r.away_seconds, r.played_seconds
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text,
    amount_paise bigint, trigger text, event_at timestamptz, step_minutes integer, table_name text, club_day date,
    visit_id uuid, sessions jsonb, seated_at timestamptz, left_at timestamptz, away_seconds bigint, played_seconds bigint)
  order by r.list_place;
$function$;
create function public.bonus_waiting_page(p_venue_id uuid, p_view jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text, amount_paise bigint, trigger text, event_at timestamp with time zone, step_minutes integer, table_name text, club_day date, visit_id uuid, sessions jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, away_seconds bigint, played_seconds bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.bonus_waiting_page(p_venue_id, p_view); $function$;
revoke all on function private.bonus_waiting_page(uuid, jsonb) from public, anon;
grant execute on function private.bonus_waiting_page(uuid, jsonb) to authenticated;
revoke all on function public.bonus_waiting_page(uuid, jsonb) from public, anon;
grant execute on function public.bonus_waiting_page(uuid, jsonb) to authenticated;

create or replace function private.todays_players(p_venue_id uuid, p_day date DEFAULT NULL::date)
 RETURNS TABLE(member_id uuid, full_name text, member_number bigint, status text, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with day as (
    select s.starts_at, s.starts_at + interval '1 day' as ends_at, p_day is null as is_today
    from (select coalesce((p_day + time '06:00') at time zone 'Asia/Kolkata', private.tonight_began(now())) as starts_at) s
  ),
  people as (
    select v.member_id from public.visit v, day where v.venue_id = p_venue_id
      and ((v.opened_at >= day.starts_at and v.opened_at < day.ends_at) or (day.is_today and v.closed_at is null))
    union select e.member_id from public.waitlist_entry e, day where e.venue_id = p_venue_id
      and ((e.joined_at >= day.starts_at and e.joined_at < day.ends_at) or (day.is_today and e.status = 'waiting'))
    union select s.member_id from public.seat_session s, day where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  sessions as (
    select s.* from public.seat_session s, day where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  -- Each stretch at one table, as private.session_tables splits a seat's time: an open one runs to now. Time away from the
  -- table is taken off, shared out over the session's tables as private.visit_table_time does (#1061).
  stretches as (
    select s.id as session_id, s.member_id, t.o_table_id as table_id, greatest(0, extract(epoch from least(t.o_to, now()) - t.o_from)) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)))::bigint as wall,
           s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                 then greatest(0, floor(extract(epoch from (now() - s.away_since))))::bigint else 0 end as away
    from sessions s cross join lateral private.session_tables(s.id) t
  ),
  per_session_table as (
    select st.member_id, st.table_id,
           private.table_played_seconds(least(floor(sum(st.seconds))::bigint, st.wall), st.wall, least(st.wall, greatest(0, st.wall - st.away))) as seconds
    from stretches st
    group by st.member_id, st.session_id, st.table_id, st.wall, st.away
  ),
  per_table as (
    select p.member_id, g.name, g.position, sum(p.seconds)::integer as seconds
    from per_session_table p join public.game_table g on g.id = p.table_id
    group by p.member_id, g.name, g.position
  )
  select m.id, m.full_name, m.member_number,
         case when exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'playing'
              when exists (select 1 from public.waitlist_entry e where e.member_id = m.id and e.status = 'waiting') then 'waiting'
              when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null) then 'in_room'
              when not exists (select 1 from public.visit v, day where v.member_id = m.id
                                 and v.opened_at < day.ends_at and (v.closed_at is null or v.closed_at >= day.starts_at))
                then 'never_arrived'
              else 'left' end,
         (select min(v.opened_at) from public.visit v, day where v.member_id = m.id and v.opened_at >= day.starts_at and v.opened_at < day.ends_at),
         -- Checked out once the day's every visit is closed: the last close.
         (select case when bool_and(v.closed_at is not null) then max(v.closed_at) end from public.visit v, day
          where v.member_id = m.id and v.opened_at >= day.starts_at and v.opened_at < day.ends_at),
         coalesce((select floor(sum(extract(epoch from coalesce(e.left_at, e.seated_at, now()) - e.joined_at)))::integer
                   from public.waitlist_entry e, day where e.member_id = m.id and e.joined_at >= day.starts_at and e.joined_at < day.ends_at), 0),
         coalesce((select jsonb_agg(jsonb_build_object('table', pt.name, 'seconds', pt.seconds) order by pt.position)
                   from per_table pt where pt.member_id = m.id), '[]'::jsonb)
  from people p
  join public.member m on m.id = p.member_id
  where (select private.has_permission(p_venue_id, 'members.read'))
  order by m.full_name;
$function$;

create or replace function private.report_figures(p_venue_id uuid, p_report text, p_from date, p_to date)
 RETURNS TABLE(figure text, amount bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_from timestamptz;
  v_to timestamptz;
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  select s.from_at, s.to_at into v_from, v_to from private.report_span(p_from, p_to) s;
  if p_report = 'players' then
    return query
    select f.figure, f.amount::bigint from (values
      ('check_ins', (select count(*) from public.visit v where v.venue_id = p_venue_id and v.opened_at >= v_from and v.opened_at < v_to)),
      ('played', (select count(distinct st.member_id) from private.table_stints(p_venue_id, p_from, p_to) st)),
      ('new_members', (select count(*) from public.member m where m.venue_id = p_venue_id and m.created_at >= v_from and m.created_at < v_to)),
      ('session_seconds', (select coalesce(avg(greatest(0, extract(epoch from (coalesce(ss.ended_at, now()) - ss.started_at)) - ss.away_seconds)), 0)::bigint
                           from public.seat_session ss where ss.venue_id = p_venue_id and ss.started_at >= v_from and ss.started_at < v_to))
    ) as f(figure, amount);
  elsif p_report = 'waitlist' then
    return query
    select f.figure, f.amount::bigint
    from (select count(*) as joined, count(*) filter (where w.got_seat) as seated,
                 coalesce(avg(w.waited) filter (where w.got_seat), 0)::bigint as wait, coalesce(max(w.waited) filter (where w.got_seat), 0)::bigint as longest
          from private.waitlist_joins(p_venue_id, p_from, p_to) w) t
    cross join lateral (values ('joined', t.joined), ('seated', t.seated), ('wait_seconds', t.wait), ('longest_seconds', t.longest)) as f(figure, amount);
  elsif p_report = 'fnb' then
    return query
    select f.figure, f.amount::bigint
    from (select count(*) as orders, coalesce(sum(o.items) filter (where not o.is_void), 0) as items,
                 coalesce(avg(o.accept_seconds), 0)::bigint as accept, coalesce(avg(o.serve_seconds), 0)::bigint as serve
          from private.fnb_orders_over(p_venue_id, p_from, p_to) o) t
    cross join lateral (values ('orders', t.orders), ('items', t.items), ('accept_seconds', t.accept), ('serve_seconds', t.serve)) as f(figure, amount);
  elsif p_report = 'bonus' then
    return query
    select f.figure, f.amount::bigint from (values
      ('given', (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
                 where g.venue_id = p_venue_id and g.created_at >= v_from and g.created_at < v_to)),
      ('by_hand', (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
                   where g.venue_id = p_venue_id and g.created_at >= v_from and g.created_at < v_to and g.idempotency_key like 'bonus.hand:%')),
      ('used', (select coalesce(sum(r.amount_paise), 0) from public.bonus_redemption r
                where r.venue_id = p_venue_id and r.created_at >= v_from and r.created_at < v_to)),
      ('outstanding', (select coalesce(sum(g.remaining_paise), 0) from public.bonus_grant g where g.venue_id = p_venue_id and g.expired_at is null))
    ) as f(figure, amount);
  else
    raise exception 'No such report' using errcode = '22023';
  end if;
end;
$function$;
