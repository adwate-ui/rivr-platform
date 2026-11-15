-- The Door, Food and drink's orders, the ID checks' queue and open Feedback are read a page at a time, sorted, searched
-- and filtered on the server (redesign RD-30; slice 12, "Lists at scale"). Each loaded everything it had: a club with
-- several hundred check-ins and orders a day needs one page asked of the server.
--
-- One way for every such list (decision 0612). A list is named here with its rows as a statement and what a view may
-- sort, filter and search by (private.list_spec); private.list_json reads a page of it for a data table's view, and
-- public.list_choices what a column menu or a row of chips offers, with counts over every row. The view is the table's
-- own, {"query", "sort", "filters", "page", "page_size"}, with the screen's own choice beside it as "scope" (a day, a
-- state, a list). Every value typed or chosen goes in as a quoted literal or a parameter, never as SQL
-- (private.list_filter_sql, 20261118100700). Members keeps its own statement, built for fifty thousand rows.

-- Today's players asked whether the caller reads members once for every player; asked once now. Otherwise as it was.
create or replace function private.todays_players(p_venue_id uuid, p_day date default null)
returns table (member_id uuid, full_name text, member_number bigint, status text, checked_in_at timestamptz, checked_out_at timestamptz,
               waiting_seconds integer, tables jsonb)
language sql
stable
security definer
set search_path = ''
as $$
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
  -- Each stretch at one table, as private.session_tables splits a seat's time: an open one runs to now.
  stretches as (
    select s.member_id, t.o_table_id as table_id, t.o_from as from_at, least(t.o_to, now()) as to_at
    from sessions s cross join lateral private.session_tables(s.id) t
  ),
  per_table as (
    select st.member_id, g.name, g.position, floor(sum(greatest(0, extract(epoch from st.to_at - st.from_at))))::integer as seconds
    from stretches st join public.game_table g on g.id = st.table_id
    group by st.member_id, g.name, g.position
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
$$;

-- The day's check-ins, the day's waitlist and the checks waiting, each found by its index.
create index visit_venue_opened_idx on public.visit (venue_id, opened_at);
create index waitlist_entry_venue_joined_idx on public.waitlist_entry (venue_id, joined_at);
create index kyc_record_queue_idx on public.kyc_record (venue_id, updated_at) where status in ('needs_review', 'needs_pan', 'refused');

-- Each list a data table reads a page at a time: its rows as a statement over $1, the venue, and $2, the view (whose
-- "scope" is the screen's own choice); the columns a view may sort and filter by, each as SQL over those rows; the
-- columns the search reads; the order with no sort chosen; and the columns whose values are counted for a menu or
-- chips. Whether the caller may read the list is part of its statement, asked once. No row for any other name.
create function private.list_spec(p_list text, out o_source text, out o_columns jsonb, out o_search text[], out o_order text, out o_choices text[])
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
     array['full_name', 'member_number'], 'full_name, member_id', array['status', 'tier', 'kyc', 'list', 'arrived'])
  ) as s(list, source, columns, search, sorted, choices)
  where s.list = p_list;
$$;

-- What narrows a list for a view: the search over the list's search columns, and each column's filter, less one column's
-- own when its menu is being counted.
create function private.list_where_sql(p_columns jsonb, p_search text[], p_view jsonb, p_without text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_filters jsonb := case when jsonb_typeof(p_view -> 'filters') = 'object' then p_view -> 'filters' else '{}'::jsonb end;
  v_query text := btrim(coalesce(p_view ->> 'query', ''));
  v_where text := 'true';
  v_key text;
begin
  if v_query <> '' and coalesce(cardinality(p_search), 0) > 0 then
    v_where := v_where || format(' and (%s) ilike %L',
      (select string_agg(format('coalesce(%I::text, '''')', c), ' || '' '' || ') from unnest(p_search) c),
      '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%');
  end if;
  for v_key in select jsonb_object_keys(v_filters) loop
    continue when not (p_columns ? v_key) or v_key is not distinct from p_without;
    v_where := v_where || ' and ' || private.list_filter_sql(p_columns ->> v_key, v_filters -> v_key, private.club_day_of(now()));
  end loop;
  return v_where;
end;
$$;

-- One page of a list for a view, as {"total": <rows the view leaves>, "rows": [<a row with its place on the page, list_place>, ...]}: fifty
-- to a page unless the view says otherwise, a thousand at most. An unknown list is refused.
create function private.list_json(p_list text, p_venue_id uuid, p_view jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_view jsonb := coalesce(p_view, '{}'::jsonb);
  v_spec record;
  v_sort text := v_view #>> '{sort,key}';
  v_order text;
  v_size integer := least(greatest(coalesce((v_view ->> 'page_size')::integer, 50), 1), 1000);
  v_page integer := greatest(coalesce((v_view ->> 'page')::integer, 1), 1);
  v_found jsonb;
begin
  select * into v_spec from private.list_spec(p_list);
  if v_spec.o_source is null then raise exception 'No such list' using errcode = '22023'; end if;
  v_order := case when v_spec.o_columns ? v_sort
                  then format('(%s) %s nulls last, ', v_spec.o_columns ->> v_sort, case when v_view #>> '{sort,direction}' = 'descending' then 'desc' else 'asc' end)
                  else '' end || v_spec.o_order;
  execute format(
    'with src as materialized (%1$s), kept as (select * from src where %2$s)
     select jsonb_build_object(
       ''total'', (select count(*) from kept),
       ''rows'', coalesce((select jsonb_agg(to_jsonb(p) order by p.list_place)
                           from (select row_number() over (order by %3$s) as list_place, kept.* from kept order by %3$s limit %4$s offset %5$s) p), ''[]''::jsonb))',
    v_spec.o_source, private.list_where_sql(v_spec.o_columns, v_spec.o_search, v_view, null), v_order, v_size, (v_page - 1)::bigint * v_size)
    into v_found using p_venue_id, v_view;
  return v_found;
end;
$$;

-- What a list's column menus and chips offer, as [{"column_key", "value", "members"}, ...]: each value of the list's
-- counted columns with how many rows hold it, over every row the search and the other columns' filters leave; a
-- column's own filter is left out of its own counts. The 200 commonest values of each.
create function private.list_choices_json(p_list text, p_venue_id uuid, p_view jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_view jsonb := coalesce(p_view, '{}'::jsonb);
  v_spec record;
  v_key text;
  v_counted jsonb;
  v_all jsonb := '[]'::jsonb;
begin
  select * into v_spec from private.list_spec(p_list);
  if v_spec.o_source is null then raise exception 'No such list' using errcode = '22023'; end if;
  foreach v_key in array v_spec.o_choices loop
    execute format(
      'with src as materialized (%1$s)
       select coalesce(jsonb_agg(to_jsonb(top)), ''[]''::jsonb)
       from (select %2$L::text as column_key, counted.value, counted.members
             from (select (%3$s)::text as value, count(*) as members from src where %4$s group by 1) counted
             where counted.value is not null order by counted.members desc, counted.value limit 200) top',
      v_spec.o_source, v_key, v_spec.o_columns ->> v_key, private.list_where_sql(v_spec.o_columns, v_spec.o_search, v_view, v_key))
      into v_counted using p_venue_id, v_view;
    v_all := v_all || v_counted;
  end loop;
  return v_all;
end;
$$;

create function private.list_choices(p_list text, p_venue_id uuid, p_view jsonb)
returns table (column_key text, value text, members bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.column_key, r.value, r.members
  from jsonb_to_recordset(private.list_choices_json(p_list, p_venue_id, p_view)) as r(column_key text, value text, members bigint);
$$;

create function public.list_choices(p_list text, p_venue_id uuid, p_view jsonb default '{}')
returns table (column_key text, value text, members bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_choices(p_list, p_venue_id, p_view); $$;

-- One page of the open Feedback tickets (feedback.manage), each as private.open_feedback gave it, with the total.
create function private.feedback_open_page(p_venue_id uuid, p_view jsonb)
returns table (total bigint, id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               created_at timestamptz, topic text, ratings jsonb, nps smallint, tables text, wait_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  with page as materialized (select private.list_json('feedback_open', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.id, r.member_id, r.full_name, r.member_number, r.visit_closed_at, r.score, r.note, r.created_at, r.topic,
         r.ratings, r.nps, r.tables, r.wait_seconds
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
    created_at timestamptz, topic text, ratings jsonb, nps smallint, tables text, wait_seconds integer)
  order by r.list_place;
$$;

create function public.feedback_open_page(p_venue_id uuid, p_view jsonb default '{}')
returns table (total bigint, id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               created_at timestamptz, topic text, ratings jsonb, nps smallint, tables text, wait_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.feedback_open_page(p_venue_id, p_view); $$;

-- One page of the ID checks' queue (kyc.review), each check as private.kyc_review_queue gave it, with the total.
create function private.kyc_review_page(p_venue_id uuid, p_view jsonb)
returns table (total bigint, member_id uuid, full_name text, status text, method text, waiting_because text, date_of_birth date, masked_aadhaar text,
               pan text, address text, photo_path text, liveness_score smallint, face_match_score smallint, vendor_reference text, refusal text,
               clashes_with text[], updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with page as materialized (select private.list_json('kyc_review', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.member_id, r.full_name, r.status, r.method, r.waiting_because, r.date_of_birth, r.masked_aadhaar, r.pan,
         r.address, r.photo_path, r.liveness_score, r.face_match_score, r.vendor_reference, r.refusal, r.clashes_with, r.updated_at
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, member_id uuid, full_name text, status text, method text, waiting_because text, date_of_birth date, masked_aadhaar text,
    pan text, address text, photo_path text, liveness_score smallint, face_match_score smallint, vendor_reference text, refusal text,
    clashes_with text[], updated_at timestamptz)
  order by r.list_place;
$$;

create function public.kyc_review_page(p_venue_id uuid, p_view jsonb default '{}')
returns table (total bigint, member_id uuid, full_name text, status text, method text, waiting_because text, date_of_birth date, masked_aadhaar text,
               pan text, address text, photo_path text, liveness_score smallint, face_match_score smallint, vendor_reference text, refusal text,
               clashes_with text[], updated_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.kyc_review_page(p_venue_id, p_view); $$;

-- One page of a club day's orders for staff who serve (fnb.serve) or run food and drink (fnb.manage), each as
-- private.fnb_orders_tonight gave tonight's, with where it stands and the total.
create function private.fnb_orders_page(p_venue_id uuid, p_view jsonb)
returns table (total bigint, order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
               kot_print_failed boolean, seat_state text, state text)
language sql
stable
security definer
set search_path = ''
as $$
  with page as materialized (select private.list_json('fnb_orders', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.order_id, r.kot_number, r.table_name, r.seat, r.member_name, r.member_number, r.lines, r.is_comp, r.source,
         r.created_at, r.kot_sent_at, r.kot_sent_by, r.accepted_at, r.delivered_at, r.age_seconds, r.cancelled_at, r.cancel_reason, r.on_way_at,
         r.kot_print_failed, r.seat_state, r.state
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
    is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
    delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
    kot_print_failed boolean, seat_state text, state text)
  order by r.list_place;
$$;

create function public.fnb_orders_page(p_venue_id uuid, p_view jsonb default '{}')
returns table (total bigint, order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
               kot_print_failed boolean, seat_state text, state text)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_orders_page(p_venue_id, p_view); $$;

-- The KOTs members cancelled themselves tonight, the last three (F-048), so the bar can drop one it already holds.
create function private.fnb_member_cancelled_kots(p_venue_id uuid)
returns table (kot_number integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.kot_number from public.fnb_order o
  where o.venue_id = p_venue_id and o.club_day = private.club_day_now() and o.cancel_reason = 'Cancelled by the member'
    and (select private.may_serve_fnb(p_venue_id))
  order by o.kot_number desc
  limit 3;
$$;

create function public.fnb_member_cancelled_kots(p_venue_id uuid)
returns table (kot_number integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_member_cancelled_kots(p_venue_id); $$;

-- One page of the door's list for staff who read members: today's players with their tier, ID check, which of the
-- door's lists they are on and since when, and the total.
create function private.door_page(p_venue_id uuid, p_view jsonb)
returns table (total bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text,
               checked_in_at timestamptz, checked_out_at timestamptz, waiting_seconds integer, tables jsonb, played_seconds bigint,
               kyc_status text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with page as materialized (select private.list_json('door', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.member_id, r.full_name, r.member_number, r.tier_name, r.is_base_tier, r.status, r.list, r.checked_in_at,
         r.checked_out_at, r.waiting_seconds, r.tables, r.played_seconds, r.kyc_status, r.since
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text,
    checked_in_at timestamptz, checked_out_at timestamptz, waiting_seconds integer, tables jsonb, played_seconds bigint,
    kyc_status text, since timestamptz)
  order by r.list_place;
$$;

create function public.door_page(p_venue_id uuid, p_view jsonb default '{}')
returns table (total bigint, member_id uuid, full_name text, member_number bigint, tier_name text, is_base_tier boolean, status text, list text,
               checked_in_at timestamptz, checked_out_at timestamptz, waiting_seconds integer, tables jsonb, played_seconds bigint,
               kyc_status text, since timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.door_page(p_venue_id, p_view); $$;

revoke execute on function private.list_spec(text), private.list_where_sql(jsonb, text[], jsonb, text), private.list_json(text, uuid, jsonb),
  private.list_choices_json(text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function private.list_choices(text, uuid, jsonb), public.list_choices(text, uuid, jsonb),
  private.feedback_open_page(uuid, jsonb), public.feedback_open_page(uuid, jsonb), private.kyc_review_page(uuid, jsonb), public.kyc_review_page(uuid, jsonb),
  private.fnb_orders_page(uuid, jsonb), public.fnb_orders_page(uuid, jsonb), private.fnb_member_cancelled_kots(uuid), public.fnb_member_cancelled_kots(uuid),
  private.door_page(uuid, jsonb), public.door_page(uuid, jsonb) from public, anon;
grant execute on function private.list_choices(text, uuid, jsonb), public.list_choices(text, uuid, jsonb),
  private.feedback_open_page(uuid, jsonb), public.feedback_open_page(uuid, jsonb), private.kyc_review_page(uuid, jsonb), public.kyc_review_page(uuid, jsonb),
  private.fnb_orders_page(uuid, jsonb), public.fnb_orders_page(uuid, jsonb), private.fnb_member_cancelled_kots(uuid), public.fnb_member_cancelled_kots(uuid),
  private.door_page(uuid, jsonb), public.door_page(uuid, jsonb) to authenticated;
