-- Bonus on the door's and Players visits' rows a seat each (the owner, 19 Nov): each seat row has the Bonus used at that
-- seat (bonus_redemption: the buy-in redeemed as they sat, private.redeem_bonus_at_seat, or a use added later), and the
-- day's Bonus given (by hand, promotions, less reversals), which no seat holds, sits on the member's first row of the day
-- alone, so a moved member's rows add up to the day's figures and an export never counts either twice. Rows now come in
-- the order sat, rows without a seat last. A seat's wait is the list's entry that ended in it, seated from the waitlist
-- or left as seated (private.seat_member); a visit of the day with no seat has a row of its own, so a member back the same
-- night shows that visit. private.players_by_seat gives each row's Bonus used, whether it is the first, its seat session
-- and visit (the rows' keys), and the member's id for a link to their account, none once erased; the two list sources
-- and their pages carry them. Otherwise each is as the database had it.
drop function public.door_page(uuid, jsonb);
drop function private.door_page(uuid, jsonb);
drop function public.player_visits_page(uuid, jsonb);
drop function private.player_visits_page(uuid, jsonb);
drop function private.players_by_seat(uuid, date);

CREATE FUNCTION private.players_by_seat(p_venue_id uuid, p_day date DEFAULT NULL::date)
 RETURNS TABLE(member_id uuid, full_name text, member_number bigint, status text, session_id uuid, table_name text, tables jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, played_seconds bigint, away_seconds bigint, is_first_row boolean, bonus_used_paise bigint, visit_id uuid, linked_member_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with day as (
    select s.starts_at, s.starts_at + interval '1 day' as ends_at, p_day is null as is_today
    from (select coalesce((p_day + time '06:00') at time zone 'Asia/Kolkata', private.tonight_began(now())) as starts_at) s
  ),
  players as (select * from private.todays_players(p_venue_id, p_day)),
  -- The day's visits: opened that club day, or still open today.
  visits as (
    select v.id, v.member_id, v.opened_at, v.closed_at
    from public.visit v cross join day
    where v.venue_id = p_venue_id
      and ((v.opened_at >= day.starts_at and v.opened_at < day.ends_at) or (day.is_today and v.closed_at is null))
  ),
  seats as (
    select s.member_id, s.id as session_id, s.visit_id, t.o_table_id as table_id, t.o_from as seated_at, nullif(t.o_to, 'infinity') as left_at,
           least(floor(greatest(0, extract(epoch from least(t.o_to, now()) - t.o_from)))::bigint, w.wall) as seconds, w.wall, w.away
    from public.seat_session s
    cross join day
    cross join lateral (
      select floor(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)))::bigint as wall,
             s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                   then greatest(0, floor(extract(epoch from (now() - s.away_since))))::bigint else 0 end as away) w
    cross join lateral private.session_tables(s.id) t
    where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  -- Bonus used at a seat (private.redeem_bonus_at_seat, private.add_bonus_use): each use on the stretch of its seat session at
  -- its table that began last by the time it was used; one used before any such stretch, on the session's last.
  uses as (
    select r.amount_paise, r.session_id, at_seat.table_id, at_seat.seated_at
    from public.bonus_redemption r
    cross join lateral (
      select st.table_id, st.seated_at from seats st
      where st.session_id = r.session_id
      order by (st.table_id = r.table_id and st.seated_at <= coalesce(r.used_at, r.created_at)) desc, st.seated_at desc
      limit 1) at_seat
    where r.venue_id = p_venue_id and r.session_id in (select st.session_id from seats st)
  ),
  seat_rows as (
  select p.member_id, p.full_name, p.member_number, p.status, st.session_id, g.name as table_name,
         jsonb_build_array(jsonb_build_object('table', g.name, 'seconds', played.seconds)) as tables,
         st.seated_at, st.left_at, v.opened_at as checked_in_at, v.closed_at as checked_out_at,
         -- The wait that ended in this seat: the list's entry seated as the seat began, from the waitlist, or ended as seated
         -- when the floor seated the member by name or number (private.seat_member), in the same moment.
         (select private.wait_after_check_in(p_venue_id, e.member_id, e.joined_at, coalesce(e.seated_at, e.left_at))
          from public.waitlist_entry e
          where e.venue_id = p_venue_id and e.member_id = st.member_id
            and (e.seated_at = st.seated_at or (e.left_reason = 'seated' and e.left_at = st.seated_at))
          order by e.joined_at limit 1) as waiting_seconds,
         played.seconds as played_seconds, st.seconds - played.seconds as away_seconds,
         (select coalesce(sum(u.amount_paise), 0) from uses u
          where u.session_id = st.session_id and u.table_id = st.table_id and u.seated_at = st.seated_at)::bigint as bonus_used_paise,
         st.visit_id
  from players p
  join seats st on st.member_id = p.member_id
  join public.game_table g on g.id = st.table_id
  join public.visit v on v.id = st.visit_id
  cross join lateral (select private.table_played_seconds(st.seconds, st.wall, least(st.wall, greatest(0, st.wall - st.away))) as seconds) played
  union all
  -- A row without a seat: each visit of the day with none, the open one too while the member waits again for a seat, and
  -- one for a member with no visit that day (on a list from the app, never in).
  select p.member_id, p.full_name, p.member_number, p.status, null, null, '[]'::jsonb, null, null, sv.opened_at, sv.closed_at,
         last_wait.seconds, 0, null, null, sv.id
  from players p
  cross join day
  left join visits sv on sv.member_id = p.member_id
  -- The visit's current wait, else its last: one still running first, then the one that ended latest; one that ended in a
  -- seat only when there is no other.
  left join lateral (
    select private.wait_after_check_in(p_venue_id, e.member_id, e.joined_at, coalesce(e.left_at, e.seated_at, now())) as seconds
    from public.waitlist_entry e
    where e.venue_id = p_venue_id and e.member_id = p.member_id
      and ((e.joined_at >= day.starts_at and e.joined_at < day.ends_at) or (day.is_today and e.status = 'waiting'))
      and (sv.id is null or (coalesce(e.left_at, e.seated_at, now()) >= sv.opened_at and e.joined_at <= coalesce(sv.closed_at, now())))
    order by (e.seated_at is null and e.left_reason is distinct from 'seated') desc, coalesce(e.left_at, e.seated_at, 'infinity') desc,
             e.joined_at
    limit 1) last_wait on true
  where (sv.id is null and not exists (select 1 from seats st where st.member_id = p.member_id))
     or (sv.id is not null and not exists (select 1 from seats st where st.visit_id = sv.id))
     or (day.is_today and p.status = 'waiting' and sv.closed_at is null and sv.id is not null)
  )
  -- The member's first row that day, by when they sat, rows without a seat last by check-in: it carries what is not a
  -- seat's own. An erased member's name links nowhere.
  select r.member_id, r.full_name, r.member_number, r.status, r.session_id, r.table_name, r.tables, r.seated_at, r.left_at,
         r.checked_in_at, r.checked_out_at, r.waiting_seconds, r.played_seconds, r.away_seconds,
         row_number() over (partition by r.member_id order by r.seated_at nulls last, r.checked_in_at nulls last, r.table_name) = 1,
         r.bonus_used_paise, r.visit_id, case when m.erased_at is null then r.member_id end
  from seat_rows r
  join public.member m on m.id = r.member_id;
$function$;

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
    -- Everyone at the door today (#641, #72): today's players a row per seat (the owner, 19 Nov), each with their tier,
    -- their ID check and which of the door's lists they are on; the menus and chips count players, not rows. In the club with a visit open; expected while on a waitlist and not yet in.
    -- KYC_STATUS stands for the ID check's words as the Members list has them (private.members_column_sql).
    ('door',
     replace($src$
       select listed.* from (
         select tp.member_id, tp.full_name, tp.member_number, t.name as tier_name,
                t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired) as is_base_tier,
                case when tp.status = 'waiting' and ov.id is null then 'expected' else tp.status end as status,
                case when ov.id is not null or tp.status = 'playing' then 'in_club' when tp.status = 'waiting' then 'expected'
                     when tp.status = 'left' then 'left' else 'not_arrived' end as list,
                tp.checked_in_at, tp.checked_out_at, tp.waiting_seconds, tp.tables, tp.played_seconds, tp.table_name as table_names,
                tp.seated_at, tp.left_at, tp.session_id, tp.visit_id, tp.linked_member_id,
                KYC_STATUS as kyc_status,
                coalesce(ov.opened_at, (select min(e.joined_at) from public.waitlist_entry e where e.member_id = tp.member_id and e.status = 'waiting')) as since,
                -- The day's Bonus given, by hand or by promotions, on the member's first row alone, so no export counts it twice;
                -- each seat's own Bonus used beside it (the owner, 19 Nov).
                case when tp.is_first_row then
                  (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
                   where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.created_at) = private.club_day_now())::bigint
                   - (select coalesce(sum(g.reversal_paise), 0) from public.bonus_grant g
                      where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.reversed_at) = private.club_day_now())::bigint
                end as bonus_paise,
                tp.bonus_used_paise,
                -- The member's mobile for floor and up (#1073, members.phone); none for anyone else.
                case when (select private.has_permission($1, 'members.phone')) then m.phone end as phone
         from private.players_by_seat($1) tp
         join public.member m on m.id = tp.member_id
         join public.tier t on t.id = m.tier_id
         left join public.visit ov on ov.member_id = tp.member_id and ov.closed_at is null) listed
       where coalesce($2 #>> '{scope,list}', 'all') in ('all', listed.list)
     $src$, 'KYC_STATUS', private.members_column_sql('kyc')),
     '{"player": "full_name", "number": "member_number", "tier": "tier_name", "status": "status", "in": "checked_in_at", "out": "checked_out_at",
       "waited": "waiting_seconds / 3600.0", "table": "table_names", "played": "played_seconds / 3600.0", "kyc": "kyc_status",
       "seated": "seated_at", "left": "left_at", "bonus_used": "bonus_used_paise / 100", "choices:count": "member_id",
       "list": "list", "arrived": "(checked_in_at is not null)", "bonus": "bonus_paise / 100",
       "status:sort": "array_position(array[''waiting'', ''expected'', ''playing'', ''in_room'', ''left'', ''never_arrived''], status)"}'::jsonb,
     array['full_name', 'member_number'], 'full_name, member_id, seated_at nulls last, checked_in_at nulls last, table_names', array['status', 'tier', 'kyc', 'list', 'arrived']),
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
       union all
       -- A reversal on its own day, below nothing, by whom and why (the owner, 19 Nov); its row is its transaction.
       select g.reversal_transaction_id, g.reversed_at, m.id, m.full_name, m.member_number, -g.reversal_paise, g.reversal_reason, 'reversed',
              coalesce(pv.name, p.name), rs.full_name
       from public.bonus_grant g
       join public.member m on m.id = g.member_id
       left join public.promotion_grant pg on pg.bonus_grant_id = g.id
       left join public.promotion p on p.id = pg.promotion_id
       left join public.promotion_version pv on pv.id = pg.promotion_version_id
       left join public.staff rs on rs.id = g.reversed_by_staff_id
       cross join (select case when $2 #>> '{scope,from}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,from}')::date end as from_day,
                          case when $2 #>> '{scope,to}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,to}')::date end as to_day) s
       where g.venue_id = $1 and g.reversed_at is not null and (select private.has_permission($1, 'reports.read'))
         and not exists (select 1 from public.venue v where v.id = $1 and v.is_practice)
         and private.club_day_of(g.reversed_at) between s.from_day and least(s.to_day, s.from_day + 91)
     $src$,
     '{"when": "given_at", "member": "full_name", "number": "member_number", "amount": "amount_paise / 100", "by": "staff_name",
       "source": "source", "reason": "reason"}'::jsonb,
     array['full_name', 'member_number', 'staff_name', 'promotion_name', 'reason'], 'given_at desc, grant_id', array['source']),
    -- Every visit in a report's span (decision 0682): each member who came in on each club day, a row per seat as the
    -- door's Today's players gives the day, for staff who read reports (and members, as private.todays_players asks); never the practice
    -- venue. One on a list from the app who never came in is no visit. The span is the screen's own choice, scope from and
    -- to as whole dates (YYYY-MM-DD), 92 club days at most counted from `from`: anything else is no day at all. Newest first.
    ('player_visits',
     replace($src$
       select tp_day.club_day, tp.member_id, tp.full_name, tp.member_number, t.name as tier_name,
              t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired) as is_base_tier,
              tp.checked_in_at, tp.checked_out_at, tp.waiting_seconds, tp.tables, tp.played_seconds, tp.table_name as table_names,
              tp.seated_at, tp.left_at, tp.away_seconds, tp.session_id, tp.visit_id, tp.linked_member_id,
              KYC_STATUS as kyc_status,
              -- As the door: the day's Bonus given on the visit's first row alone, each seat's Bonus used on its own.
              case when tp.is_first_row then
                (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
                 where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.created_at) = tp_day.club_day)::bigint
                 - (select coalesce(sum(g.reversal_paise), 0) from public.bonus_grant g
                    where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.reversed_at) = tp_day.club_day)::bigint
              end as bonus_paise,
              tp.bonus_used_paise
       from (select s.from_day + n as club_day
             from (select case when $2 #>> '{scope,from}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,from}')::date end as from_day,
                          case when $2 #>> '{scope,to}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,to}')::date end as to_day) s
             -- least() passes over a null, and todays_players takes no day as today: a date missing is no day at all.
             cross join generate_series(0, least(s.to_day - s.from_day, 91)) n
             where s.from_day is not null and s.to_day is not null) tp_day
       cross join lateral private.players_by_seat($1, tp_day.club_day) tp
       join public.member m on m.id = tp.member_id
       join public.tier t on t.id = m.tier_id
       where (select private.has_permission($1, 'reports.read'))
         and not exists (select 1 from public.venue v where v.id = $1 and v.is_practice)
         and (tp.checked_in_at is not null or tp.session_id is not null)
     $src$, 'KYC_STATUS', private.members_column_sql('kyc')),
     '{"date": "club_day", "player": "full_name", "number": "member_number", "tier": "tier_name", "in": "checked_in_at", "out": "checked_out_at",
       "waited": "waiting_seconds / 3600.0", "table": "table_names", "played": "played_seconds / 3600.0", "kyc": "kyc_status",
       "bonus": "bonus_paise / 100", "seated": "seated_at", "left": "left_at", "away": "away_seconds / 3600.0", "bonus_used": "bonus_used_paise / 100",
       "choices:count": "(club_day, member_id)"}'::jsonb,
     array['full_name', 'member_number'], 'club_day desc, full_name, member_id, seated_at nulls last, checked_in_at nulls last, table_names', array['tier'])
  ) as s(list, source, columns, search, sorted, choices)
  where s.list = p_list;
$function$;

CREATE OR REPLACE FUNCTION private.door_page(p_venue_id uuid, p_view jsonb)
 RETURNS TABLE(total bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, since timestamp with time zone, bonus_paise bigint, phone text, seated_at timestamp with time zone, left_at timestamp with time zone, bonus_used_paise bigint, session_id uuid, visit_id uuid, linked_member_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with page as materialized (select private.list_json('door', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.member_id, r.full_name, r.member_number, r.tier_name, r.is_base_tier, r.status, r.list, r.checked_in_at,
         r.checked_out_at, r.waiting_seconds, r.tables, r.played_seconds, r.kyc_status, r.since, r.bonus_paise, r.phone,
         r.seated_at, r.left_at, r.bonus_used_paise, r.session_id, r.visit_id, r.linked_member_id
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text,
    checked_in_at timestamptz, checked_out_at timestamptz, waiting_seconds integer, tables jsonb, played_seconds bigint,
    kyc_status text, since timestamptz, bonus_paise bigint, phone text, seated_at timestamptz, left_at timestamptz, bonus_used_paise bigint, session_id uuid, visit_id uuid, linked_member_id uuid)
  order by r.list_place;
$function$;

CREATE OR REPLACE FUNCTION public.door_page(p_venue_id uuid, p_view jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, since timestamp with time zone, bonus_paise bigint, phone text, seated_at timestamp with time zone, left_at timestamp with time zone, bonus_used_paise bigint, session_id uuid, visit_id uuid, linked_member_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.door_page(p_venue_id, p_view); $function$;

CREATE OR REPLACE FUNCTION private.player_visits_page(p_venue_id uuid, p_view jsonb)
 RETURNS TABLE(total bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint, visits jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, away_seconds bigint, bonus_used_paise bigint, session_id uuid, visit_id uuid, linked_member_id uuid)
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
             and vi.opened_at < (r.club_day + 1 + time '06:00') at time zone 'Asia/Kolkata') end,
         r.seated_at, r.left_at, r.away_seconds, r.bonus_used_paise, r.session_id, r.visit_id, r.linked_member_id
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean,
    checked_in_at timestamptz, checked_out_at timestamptz, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint,
    seated_at timestamptz, left_at timestamptz, away_seconds bigint, bonus_used_paise bigint, session_id uuid, visit_id uuid, linked_member_id uuid)
  order by r.list_place;
$function$;

CREATE OR REPLACE FUNCTION public.player_visits_page(p_venue_id uuid, p_view jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint, visits jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, away_seconds bigint, bonus_used_paise bigint, session_id uuid, visit_id uuid, linked_member_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.player_visits_page(p_venue_id, p_view); $function$;

revoke all on function private.players_by_seat(uuid, date) from public, anon, authenticated;
revoke all on function private.door_page(uuid, jsonb), public.door_page(uuid, jsonb),
  private.player_visits_page(uuid, jsonb), public.player_visits_page(uuid, jsonb) from public, anon;
grant execute on function private.door_page(uuid, jsonb), public.door_page(uuid, jsonb),
  private.player_visits_page(uuid, jsonb), public.player_visits_page(uuid, jsonb) to authenticated;
