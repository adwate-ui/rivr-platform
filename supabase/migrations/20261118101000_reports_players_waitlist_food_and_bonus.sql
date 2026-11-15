-- Reports › Players, Waitlist, Food and drink and Bonus (redesign RD-27; slice 10), beside Tables. Each over 1 to 92 club days, computed here,
-- for staff who read reports (super admins and admins; investors and the practice venue are refused: private.assert_table_span). Each report
-- has four figures, a chart by the hour of one club day or by the day of a longer span, and a table of a few rows. No rupee figure: Bonus
-- is counted in its own paise, which the screens show as Bonus, never as money.

-- A span of club days as moments: a club day runs 06:00 to 06:00 IST, as every report here.
create function private.report_span(p_from date, p_to date)
returns table (from_at timestamptz, to_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata', ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata';
$$;

-- The chart's bars: the twenty-four hours of one club day, or each club day of a longer span (92 at most).
create function private.report_buckets(p_from date, p_to date)
returns table (from_at timestamptz, to_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select b.at, b.at + w.step
  from private.report_span(p_from, p_to) s
  cross join (select case when p_from = p_to then interval '1 hour' else interval '1 day' end as step) w
  cross join lateral generate_series(s.from_at, s.to_at - w.step, w.step) as b(at);
$$;

-- A report's chart: members seated (tables), check-ins (players), joins of a list (waitlist), orders placed (fnb) and Bonus given in paise
-- (bonus), a bar an hour or a day.
create function private.report_chart(p_venue_id uuid, p_report text, p_from date, p_to date)
returns table (bucket timestamptz, amount bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  if p_report is null or p_report not in ('tables', 'players', 'waitlist', 'fnb', 'bonus') then
    raise exception 'No such report' using errcode = '22023';
  end if;
  return query
  with span as materialized (
    select s.from_at, s.to_at from private.report_span(p_from, p_to) s
  ),
  seated as materialized (
    select st.member_id, st.from_at, st.to_at from private.table_stints(p_venue_id, p_from, p_to) st where p_report = 'tables'
  ),
  events as materialized (
    select v.opened_at as at, 1::bigint as amount from public.visit v, span s
    where p_report = 'players' and v.venue_id = p_venue_id and v.opened_at >= s.from_at and v.opened_at < s.to_at
    union all
    select w.joined_at, 1 from public.waitlist_entry w, span s
    where p_report = 'waitlist' and w.venue_id = p_venue_id and w.joined_at >= s.from_at and w.joined_at < s.to_at and w.left_reason is distinct from 'declined'
    union all
    select o.created_at, 1 from public.fnb_order o
    where p_report = 'fnb' and o.venue_id = p_venue_id and o.club_day between p_from and p_to
    union all
    select g.created_at, g.amount_paise from public.bonus_grant g, span s
    where p_report = 'bonus' and g.venue_id = p_venue_id and g.created_at >= s.from_at and g.created_at < s.to_at
  )
  select b.from_at,
         (case when p_report = 'tables'
               then (select count(distinct se.member_id) from seated se where se.from_at < b.to_at and se.to_at > b.from_at)
               else coalesce((select sum(e.amount) from events e where e.at >= b.from_at and e.at < b.to_at), 0) end)::bigint
  from private.report_buckets(p_from, p_to) b
  order by b.from_at;
end;
$$;

-- A report's four figures, each by its name. Times are whole seconds; Bonus is in paise.
--   players: check_ins, played (members who sat), new_members, session_seconds (a seat session's average)
--   waitlist: joined, seated, wait_seconds (the average to a seat), longest_seconds
--   fnb: orders, items, accept_seconds and serve_seconds (the averages from placing an order)
--   bonus: given, by_hand, used, and outstanding (what members hold now, whatever the span)
create function private.report_figures(p_venue_id uuid, p_report text, p_from date, p_to date)
returns table (figure text, amount bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
      ('session_seconds', (select coalesce(avg(extract(epoch from (coalesce(ss.ended_at, now()) - ss.started_at))), 0)::bigint
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
$$;

-- The joins of a list over a span, apart from requests the floor declined: whether the member got a seat (from the list, or seated another way
-- while on it) and how long they had waited by then.
create function private.waitlist_joins(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, got_seat boolean, has_left boolean, waited bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select w.table_id, w.seated_at is not null or w.left_reason = 'seated',
         w.status = 'left' and w.left_reason <> 'seated',
         extract(epoch from (coalesce(w.seated_at, w.left_at) - w.joined_at))::bigint
  from public.waitlist_entry w cross join private.report_span(p_from, p_to) s
  where w.venue_id = p_venue_id and w.joined_at >= s.from_at and w.joined_at < s.to_at and w.left_reason is distinct from 'declined';
$$;

-- The orders of a span of club days: how many items, whether void, and the seconds from placing it to accepting and to serving it.
create function private.fnb_orders_over(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, accepted_by_staff_id uuid, items bigint, is_void boolean, accept_seconds bigint, serve_seconds bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select o.table_id, o.accepted_by_staff_id,
         (select coalesce(sum((l.line ->> 'quantity')::integer), 0) from jsonb_array_elements(o.lines) as l(line))::bigint,
         o.cancelled_at is not null,
         extract(epoch from (o.accepted_at - o.created_at))::bigint, extract(epoch from (o.delivered_at - o.created_at))::bigint
  from public.fnb_order o
  where o.venue_id = p_venue_id and o.club_day between p_from and p_to;
$$;

-- Players: the members who played, the same by tier, those of them on a first visit, and the ID checks done; `label` is a tier's
-- name. Every count but the ID checks is of members who played, so each is a share of them and none passes the whole.
create function private.players_report(p_venue_id uuid, p_from date, p_to date)
returns table (place integer, measure text, label text, amount bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  return query
  with span as materialized (
    select s.from_at, s.to_at from private.report_span(p_from, p_to) s
  ),
  played as materialized (
    select distinct st.member_id from private.table_stints(p_venue_id, p_from, p_to) st
  )
  select r.place, r.measure, r.label, r.amount::bigint from (
    select 0 as place, 'played' as measure, null::text as label, (select count(*) from played) as amount
    union all
    select 1 + tr.rank, 'tier', tr.name, count(*)
    from played p join public.member m on m.id = p.member_id join public.tier tr on tr.id = m.tier_id
    group by tr.rank, tr.name
    union all
    select 1000, 'first_visit', null,
           (select count(*) from (select v.member_id from public.visit v
                                  where v.venue_id = p_venue_id and v.member_id in (select p.member_id from played p) group by v.member_id
                                  having min(v.opened_at) >= (select s.from_at from span s) and min(v.opened_at) < (select s.to_at from span s)) f)
    union all
    select 1001, 'id_checks', null,
           (select count(*) from public.kyc_record k, span s where k.venue_id = p_venue_id and k.verified_at >= s.from_at and k.verified_at < s.to_at)
  ) r
  order by r.place, r.label;
end;
$$;

-- Waitlist: each table's list over the span: who joined, who got a seat, who left the list, and the average and longest wait to a seat.
-- Every active table, and any other with a join.
create function private.waitlist_report(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, table_name text, joined bigint, seated bigint, left_list bigint, wait_seconds bigint, longest_seconds bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  return query
  with lists as (
    select w.table_id, count(*) as joined, count(*) filter (where w.got_seat) as seated, count(*) filter (where w.has_left) as left_list,
           coalesce(avg(w.waited) filter (where w.got_seat), 0)::bigint as wait, coalesce(max(w.waited) filter (where w.got_seat), 0)::bigint as longest
    from private.waitlist_joins(p_venue_id, p_from, p_to) w
    group by w.table_id
  )
  select g.id, g.name, coalesce(l.joined, 0)::bigint, coalesce(l.seated, 0)::bigint, coalesce(l.left_list, 0)::bigint,
         coalesce(l.wait, 0)::bigint, coalesce(l.longest, 0)::bigint
  from public.game_table g
  left join lists l on l.table_id = g.id
  where g.venue_id = p_venue_id and (g.active or l.joined > 0)
  order by g.position, g.name;
end;
$$;

-- Food and drink: the span's orders by table and by the staff member who accepted them (`grouped_by` 'table' or 'staff'; a null label is the
-- orders nobody accepted): orders, items, the average seconds to accept and to serve, and how many were void. Two hundred rows at most.
create function private.fnb_report(p_venue_id uuid, p_from date, p_to date)
returns table (grouped_by text, label text, orders bigint, items bigint, accept_seconds bigint, serve_seconds bigint, voided bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  return query
  with orders as materialized (
    select o.table_id, o.accepted_by_staff_id, o.items, o.is_void, o.accept_seconds, o.serve_seconds
    from private.fnb_orders_over(p_venue_id, p_from, p_to) o
  ),
  grouped as (
    select 'table' as grouped_by, g.name as label, g.position as place, o.items, o.is_void, o.accept_seconds, o.serve_seconds
    from orders o join public.game_table g on g.id = o.table_id
    union all
    select 'staff', st.full_name, 0, o.items, o.is_void, o.accept_seconds, o.serve_seconds
    from orders o left join public.staff st on st.id = o.accepted_by_staff_id
  )
  select g.grouped_by, g.label, count(*)::bigint, coalesce(sum(g.items) filter (where not g.is_void), 0)::bigint,
         coalesce(avg(g.accept_seconds), 0)::bigint, coalesce(avg(g.serve_seconds), 0)::bigint, count(*) filter (where g.is_void)::bigint
  from grouped g
  group by g.grouped_by, g.label, g.place
  order by g.grouped_by desc, g.place, count(*) desc, g.label
  limit 200;
end;
$$;

-- Bonus: what was given over the span by where it came from: a promotion (`source` 'promotion', `label` its name), by hand ('hand'), or
-- anything else by its reason ('other'); with how many members and grants. The most given first; two hundred rows at most.
create function private.bonus_report(p_venue_id uuid, p_from date, p_to date)
returns table (source text, label text, members bigint, grants bigint, given_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  return query
  with given as (
    select g.member_id, g.amount_paise,
           case when p.id is not null then 'promotion' when g.idempotency_key like 'bonus.hand:%' then 'hand' else 'other' end as source,
           case when p.id is not null then p.name when g.idempotency_key like 'bonus.hand:%' then null else g.reason end as label
    from public.bonus_grant g cross join private.report_span(p_from, p_to) s
    left join public.promotion_grant pg on pg.bonus_grant_id = g.id
    left join public.promotion p on p.id = pg.promotion_id
    where g.venue_id = p_venue_id and g.created_at >= s.from_at and g.created_at < s.to_at
  )
  select gv.source, gv.label, count(distinct gv.member_id)::bigint, count(*)::bigint, sum(gv.amount_paise)::bigint
  from given gv
  group by gv.source, gv.label
  order by sum(gv.amount_paise) desc, gv.source, gv.label
  limit 200;
end;
$$;

create function public.report_chart(p_venue_id uuid, p_report text, p_from date, p_to date)
returns table (bucket timestamptz, amount bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.report_chart(p_venue_id, p_report, p_from, p_to); $$;

create function public.report_figures(p_venue_id uuid, p_report text, p_from date, p_to date)
returns table (figure text, amount bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.report_figures(p_venue_id, p_report, p_from, p_to); $$;

create function public.players_report(p_venue_id uuid, p_from date, p_to date)
returns table (place integer, measure text, label text, amount bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.players_report(p_venue_id, p_from, p_to); $$;

create function public.waitlist_report(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, table_name text, joined bigint, seated bigint, left_list bigint, wait_seconds bigint, longest_seconds bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.waitlist_report(p_venue_id, p_from, p_to); $$;

create function public.fnb_report(p_venue_id uuid, p_from date, p_to date)
returns table (grouped_by text, label text, orders bigint, items bigint, accept_seconds bigint, serve_seconds bigint, voided bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_report(p_venue_id, p_from, p_to); $$;

create function public.bonus_report(p_venue_id uuid, p_from date, p_to date)
returns table (source text, label text, members bigint, grants bigint, given_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.bonus_report(p_venue_id, p_from, p_to); $$;

revoke execute on function private.report_span(date, date), private.report_buckets(date, date), private.waitlist_joins(uuid, date, date),
  private.fnb_orders_over(uuid, date, date),
  private.report_chart(uuid, text, date, date), public.report_chart(uuid, text, date, date),
  private.report_figures(uuid, text, date, date), public.report_figures(uuid, text, date, date),
  private.players_report(uuid, date, date), public.players_report(uuid, date, date),
  private.waitlist_report(uuid, date, date), public.waitlist_report(uuid, date, date),
  private.fnb_report(uuid, date, date), public.fnb_report(uuid, date, date),
  private.bonus_report(uuid, date, date), public.bonus_report(uuid, date, date) from public, anon;
grant execute on function private.report_chart(uuid, text, date, date), public.report_chart(uuid, text, date, date),
  private.report_figures(uuid, text, date, date), public.report_figures(uuid, text, date, date),
  private.players_report(uuid, date, date), public.players_report(uuid, date, date),
  private.waitlist_report(uuid, date, date), public.waitlist_report(uuid, date, date),
  private.fnb_report(uuid, date, date), public.fnb_report(uuid, date, date),
  private.bonus_report(uuid, date, date), public.bonus_report(uuid, date, date) to authenticated;
