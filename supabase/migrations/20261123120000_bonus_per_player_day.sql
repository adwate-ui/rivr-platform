-- Bonus given each session (#1062, the owner, 17 Nov): the Door's Today's players and the Players report's visits gain a
-- Bonus column. A row there is a member on a club day (decision 0682), and Bonus by hand names no seat, so it is the Bonus
-- given to that member that club day: by hand, promotions once approved, the high hand. Bonus waiting or refused is no
-- bonus_grant, so it is not counted. Generated from the live definitions by scratchpad-gen1062.py: only these lines change.

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
              (g.event ->> 'stepMinutes')::integer as step_minutes, t.name as table_name, g.club_day
       from public.promotion_grant g
       join public.member m on m.id = g.member_id and m.erased_at is null
       join public.promotion p on p.id = g.promotion_id
       left join public.promotion_version v on v.id = g.promotion_version_id
       left join public.game_table t on t.id = g.table_id
       where g.venue_id = $1 and g.status = 'waiting' and (select private.is_super_admin($1))
         and not private.is_own_cage_record(g.member_id) and not coalesce(private.is_own_kyc_check(g.member_id), false)
     $src$,
     '{"member": "full_name", "number": "member_number", "promotion": "promotion_name", "amount": "amount_paise / 100", "why": "trigger",
       "when": "club_day", "when:sort": "event_at"}'::jsonb,
     array['full_name', 'member_number', 'promotion_name'], 'event_at, full_name, grant_id', array['promotion', 'why']),
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

drop function public.door_page(uuid, jsonb);
drop function private.door_page(uuid, jsonb);
create function private.door_page(p_venue_id uuid, p_view jsonb)
 RETURNS TABLE(total bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, since timestamp with time zone, bonus_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with page as materialized (select private.list_json('door', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.member_id, r.full_name, r.member_number, r.tier_name, r.is_base_tier, r.status, r.list, r.checked_in_at,
         r.checked_out_at, r.waiting_seconds, r.tables, r.played_seconds, r.kyc_status, r.since, r.bonus_paise
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text,
    checked_in_at timestamptz, checked_out_at timestamptz, waiting_seconds integer, tables jsonb, played_seconds bigint,
    kyc_status text, since timestamptz, bonus_paise bigint)
  order by r.list_place;
$function$;
create function public.door_page(p_venue_id uuid, p_view jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, since timestamp with time zone, bonus_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.door_page(p_venue_id, p_view); $function$;
revoke all on function private.door_page(uuid, jsonb) from public, anon;
grant execute on function private.door_page(uuid, jsonb) to authenticated;
revoke all on function public.door_page(uuid, jsonb) from public, anon;
grant execute on function public.door_page(uuid, jsonb) to authenticated;

drop function public.player_visits_page(uuid, jsonb);
drop function private.player_visits_page(uuid, jsonb);
create function private.player_visits_page(p_venue_id uuid, p_view jsonb)
 RETURNS TABLE(total bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with page as materialized (select private.list_json('player_visits', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.club_day, r.member_id, r.full_name, r.member_number, r.tier_name, r.is_base_tier, r.checked_in_at,
         r.checked_out_at, r.waiting_seconds, r.tables, r.played_seconds, r.kyc_status, r.bonus_paise
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean,
    checked_in_at timestamptz, checked_out_at timestamptz, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint)
  order by r.list_place;
$function$;
create function public.player_visits_page(p_venue_id uuid, p_view jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, club_day date, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb, played_seconds bigint, kyc_status text, bonus_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.player_visits_page(p_venue_id, p_view); $function$;
revoke all on function private.player_visits_page(uuid, jsonb) from public, anon;
grant execute on function private.player_visits_page(uuid, jsonb) to authenticated;
revoke all on function public.player_visits_page(uuid, jsonb) from public, anon;
grant execute on function public.player_visits_page(uuid, jsonb) to authenticated;
