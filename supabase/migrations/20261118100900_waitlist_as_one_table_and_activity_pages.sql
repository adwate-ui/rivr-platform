-- The Waitlist as one table from the server, and Activity by numbered pages (redesign RD-31; slice 12, "Lists at scale").
--
-- The Waitlist screen held a card for each table's list and loaded every place. It is one data table now (the owner,
-- 15 Nov), a page at a time, with the table as a column and a filter: public.waitlist_page, a list like those of
-- 20261118100800 (decision 0612). The rule is unchanged: each table has its own list and its own order.
--
-- Activity kept its pages by "Show earlier", each after the last line shown. It gains the data table's foot, which
-- wants a page by its number and how many lines there are: public.activity_page. Both reads of the log now share
-- one statement of what a line is (the view private.activity_line), so they cannot drift apart.

-- As 20261118100800 left it, with the Waitlist.
create or replace function private.list_spec(p_list text, out o_source text, out o_columns jsonb, out o_search text[], out o_order text, out o_choices text[])
language sql
immutable
set search_path = ''
as $$
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
                coalesce(ov.opened_at, (select min(e.joined_at) from public.waitlist_entry e where e.member_id = tp.member_id and e.status = 'waiting')) as since
         from private.todays_players($1) tp
         join public.member m on m.id = tp.member_id
         join public.tier t on t.id = m.tier_id
         left join public.visit ov on ov.member_id = tp.member_id and ov.closed_at is null) listed
       where coalesce($2 #>> '{scope,list}', 'all') in ('all', listed.list)
     $src$, 'KYC_STATUS', private.members_column_sql('kyc')),
     '{"player": "full_name", "number": "member_number", "tier": "tier_name", "status": "status", "in": "checked_in_at", "out": "checked_out_at",
       "waited": "waiting_seconds / 3600.0", "table": "table_names", "played": "played_seconds / 3600.0", "kyc": "kyc_status",
       "list": "list", "arrived": "(checked_in_at is not null)"}'::jsonb,
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
     array['full_name'], 'table_position, table_name, place', array['table'])
  ) as s(list, source, columns, search, sorted, choices)
  where s.list = p_list;
$$;

-- One page of the Waitlist for the floor (waitlist.manage): each place as private.waitlist_board gives it, table by table
-- in place order unless the view says otherwise, with how many places the view leaves.
create function private.waitlist_page(p_venue_id uuid, p_view jsonb)
returns table (total bigint, entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer, added_by_floor boolean,
               priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz, away_until timestamptz, asked_table_id uuid,
               on_way_at timestamptz, needs_id_check boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with page as materialized (select private.list_json('waitlist', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.entry_id, r.table_type_id, r.member_id, r.full_name, r.joined_at, r.place, r.added_by_floor, r.priority_reason,
         r.call_table_name, r.call_seat, r.hold_until, r.away_until, r.asked_table_id, r.on_way_at, r.needs_id_check
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer, added_by_floor boolean,
    priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz, away_until timestamptz, asked_table_id uuid,
    on_way_at timestamptz, needs_id_check boolean)
  order by r.list_place;
$$;

create function public.waitlist_page(p_venue_id uuid, p_view jsonb default '{}')
returns table (total bigint, entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer, added_by_floor boolean,
               priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz, away_until timestamptz, asked_table_id uuid,
               on_way_at timestamptz, needs_id_check boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.waitlist_page(p_venue_id, p_view); $$;

-- What a line of the activity log is: who did what, about whom, why and when. A view, so that each read below takes
-- only the lines it asks for (a function with its own search path is read whole before its caller narrows it, which a
-- log of a year's lines cannot afford). The lines are private.activity_log's, as the newest migration before this one
-- left them. Nobody is granted it: only the two reads below, which ask who may read Activity, reach it.
create view private.activity_line with (security_invoker = true) as
  select l.venue_id, l.id, l.occurred_at, w.name as who, l.actor_user_id is null as is_system, l.action, l.entity,
         private.activity_kind(l.action, l.entity) as kind,
         coalesce(case when rm.erased_at is null then rm.full_name end, rs.full_name, case when l.entity = 'table' then l.entity_id end) as about,
         -- A reason can name the person, so an erased member's go; the erasure keeps its own.
         case when rm.erased_at is null or l.action = 'member.erase' then l.reason end as reason,
         -- How many bonus chips were given by hand.
         case when l.action = 'bonus.give' then (l.after ->> 'chips')::bigint end as amount
  from public.audit_log l
  left join public.staff s on s.user_id = l.actor_user_id and s.venue_id = l.venue_id
  left join public.member a on a.user_id = l.actor_user_id and a.venue_id = l.venue_id
  -- By the device the row names, as a revoked device has lost its login.
  left join public.device d on d.id = l.device_id and d.venue_id = l.venue_id
  cross join lateral (select coalesce(s.full_name, case when a.erased_at is null then a.full_name end, d.name) as name) w
  left join lateral (
    select coalesce(case when l.entity = 'member' then l.entity_id end, l.after ->> 'member_id', l.before ->> 'member_id') as member_id,
           coalesce(case when l.entity = 'staff' then l.entity_id end, l.after ->> 'staff_id', l.before ->> 'staff_id') as staff_id
  ) t on true
  left join public.member rm on rm.id = private.uuid_or_null(t.member_id) and rm.venue_id = l.venue_id
  left join public.staff rs on rs.id = private.uuid_or_null(t.staff_id) and rs.venue_id = l.venue_id;

revoke all on private.activity_line from public, anon, authenticated;

-- The page after a line, newest first, as before: now read from private.activity_line.
create or replace function private.activity_log(p_venue_id uuid, p_from date default null, p_to date default null, p_who text default null,
                                                p_kind text default null, p_before timestamptz default null, p_before_id bigint default null,
                                                p_limit integer default 50)
returns table (id bigint, occurred_at timestamptz, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.occurred_at, l.who, l.is_system, l.action, l.entity, l.kind, l.about, l.reason, l.amount
  from private.activity_line l
  where l.venue_id = p_venue_id and (select private.has_permission(p_venue_id, 'activity.read'))
    and (p_from is null or l.occurred_at >= (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_to is null or l.occurred_at < ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_who is null or position(lower(p_who) in lower(coalesce(l.who, ''))) > 0)
    and (p_kind is null or l.kind = p_kind)
    and (p_before is null or (l.occurred_at, l.id) < (p_before, p_before_id))
  order by l.occurred_at desc, l.id desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1);
$$;

-- A page of the log by its number, newest first, fifty lines unless asked otherwise (1,000 at most, for an export),
-- with how many lines the narrowing leaves: what the data table's foot needs. Narrowed as private.activity_log is.
create function private.activity_page(p_venue_id uuid, p_from date, p_to date, p_who text, p_kind text, p_page integer, p_page_size integer)
returns table (total bigint, id bigint, occurred_at timestamptz, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from private.activity_line c
          where c.venue_id = p_venue_id and (select private.has_permission(p_venue_id, 'activity.read'))
            and (p_from is null or c.occurred_at >= (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
            and (p_to is null or c.occurred_at < ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
            and (p_who is null or position(lower(p_who) in lower(coalesce(c.who, ''))) > 0)
            and (p_kind is null or c.kind = p_kind)),
         l.id, l.occurred_at, l.who, l.is_system, l.action, l.entity, l.kind, l.about, l.reason, l.amount
  from private.activity_line l
  where l.venue_id = p_venue_id and (select private.has_permission(p_venue_id, 'activity.read'))
    and (p_from is null or l.occurred_at >= (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_to is null or l.occurred_at < ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_who is null or position(lower(p_who) in lower(coalesce(l.who, ''))) > 0)
    and (p_kind is null or l.kind = p_kind)
  order by l.occurred_at desc, l.id desc
  limit least(greatest(coalesce(p_page_size, 50), 1), 1000)
  offset (greatest(coalesce(p_page, 1), 1) - 1)::bigint * least(greatest(coalesce(p_page_size, 50), 1), 1000);
$$;

create function public.activity_page(p_venue_id uuid, p_from date default null, p_to date default null, p_who text default null, p_kind text default null,
                                     p_page integer default 1, p_page_size integer default 50)
returns table (total bigint, id bigint, occurred_at timestamptz, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.activity_page(p_venue_id, p_from, p_to, p_who, p_kind, p_page, p_page_size); $$;

revoke execute on function private.waitlist_page(uuid, jsonb), public.waitlist_page(uuid, jsonb),
  private.activity_page(uuid, date, date, text, text, integer, integer), public.activity_page(uuid, date, date, text, text, integer, integer) from public, anon;
grant execute on function private.waitlist_page(uuid, jsonb), public.waitlist_page(uuid, jsonb),
  private.activity_page(uuid, date, date, text, text, integer, integer), public.activity_page(uuid, date, date, text, text, integer, integer) to authenticated;
