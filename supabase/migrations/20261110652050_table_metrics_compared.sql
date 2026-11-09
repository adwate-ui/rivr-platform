-- Reports › Tables over longer spans (8 Nov audit, I-77, F-107): every active table, at nothing when it did not run; each table's player
-- hours in the same number of club days just before, for the change; and one row for the whole room, in which a member at two tables
-- counts once and the most at once is across the room, so it cannot be added up from the tables'. Money-free, as before (owner, 8 Nov).

-- As 20261109200000_table_metrics.sql: who sat where over a span of club days (06:00 to 06:00 IST), each stint clipped to the span. `p_until` stops
-- it sooner, so a span still running is set against the one before only as far as the same point in it.
create function private.table_stints(p_venue_id uuid, p_from date, p_to date, p_until timestamptz default null)
returns table (table_id uuid, member_id uuid, from_at timestamptz, to_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with span as (
    select ((p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata') as from_at,
           least(((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata', coalesce(p_until, now())) as to_at
  ),
  stints as (
    select st.o_table_id as table_id, ss.member_id, greatest(st.o_from, s.from_at) as from_at, least(st.o_to, now(), s.to_at) as to_at
    from public.seat_session ss cross join span s
    cross join lateral private.session_tables(ss.id) st
    where ss.venue_id = p_venue_id and ss.started_at < s.to_at and coalesce(ss.ended_at, now()) > s.from_at
  )
  select i.table_id, i.member_id, i.from_at, i.to_at from stints i where i.to_at > i.from_at;
$$;

-- The seconds each table ran over the span, its runs clipped to it.
create function private.table_run_seconds(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, seconds bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with span as (
    select ((p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata') as from_at,
           least(((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata', now()) as to_at
  )
  select r.table_id, sum(extract(epoch from (least(coalesce(r.closed_at, now()), s.to_at) - greatest(r.opened_at, s.from_at))))::bigint
  from public.table_run r cross join span s
  where r.venue_id = p_venue_id and r.opened_at < s.to_at and coalesce(r.closed_at, now()) > s.from_at
  group by r.table_id;
$$;

-- Staff who read reports, and a span of 1 to 92 club days, as every report here (42501; 22023, the practice venue too).
create function private.assert_table_span(p_venue_id uuid, p_from date, p_to date)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_reports(p_venue_id);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 91 then
    raise exception 'A span of 1 to 92 club days' using errcode = '22023';
  end if;
end;
$$;

drop function public.table_metrics(uuid, date, date);
drop function private.table_metrics(uuid, date, date);

create function private.table_metrics(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, table_name text, seats integer, run_seconds bigint, players integer, peak integer, player_seconds bigint,
               previous_player_seconds bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  return query
  with seated as (
    select * from private.table_stints(p_venue_id, p_from, p_to)
  ),
  played as (
    select se.table_id, count(distinct se.member_id)::integer as players, sum(extract(epoch from (se.to_at - se.from_at)))::bigint as seconds
    from seated se group by se.table_id
  ),
  -- The most seated at once: each sit-down +1 and stand-up -1 in time order, a stand-up first at the same moment.
  edges as (
    select se.table_id, se.from_at as at, 1 as delta from seated se
    union all
    select se.table_id, se.to_at, -1 from seated se
  ),
  peaks as (
    select e.table_id, max(e.running)::integer as peak
    from (select ed.table_id, sum(ed.delta) over (partition by ed.table_id order by ed.at, ed.delta rows unbounded preceding) as running
          from edges ed) e
    group by e.table_id
  ),
  -- The span just before, of the same length, as far as the same point in it.
  earlier as (
    select b.table_id, sum(extract(epoch from (b.to_at - b.from_at)))::bigint as seconds
    from private.table_stints(p_venue_id, p_from - (p_to - p_from + 1), p_from - 1, now() - make_interval(days => p_to - p_from + 1)) b group by b.table_id
  )
  select g.id, g.name, g.seats, coalesce(r.seconds, 0)::bigint, coalesce(p.players, 0), coalesce(k.peak, 0), coalesce(p.seconds, 0)::bigint,
         coalesce(b.seconds, 0)::bigint
  from public.game_table g
  left join private.table_run_seconds(p_venue_id, p_from, p_to) r on r.table_id = g.id
  left join played p on p.table_id = g.id
  left join peaks k on k.table_id = g.id
  left join earlier b on b.table_id = g.id
  where g.venue_id = p_venue_id and (g.active or coalesce(r.seconds, 0) > 0 or coalesce(p.seconds, 0) > 0)
  order by g.position, g.name;
end;
$$;

-- The whole room: its seats, the seconds its tables ran and their seats' seconds for how full it was, the members who sat anywhere,
-- the most seated at once anywhere, and the seconds played now and just before. Over the tables `table_metrics` lists.
create function private.table_metrics_total(p_venue_id uuid, p_from date, p_to date)
returns table (seats bigint, run_seconds bigint, seat_seconds bigint, players bigint, peak bigint, player_seconds bigint, previous_player_seconds bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  return query
  with seated as (
    select * from private.table_stints(p_venue_id, p_from, p_to)
  ),
  edges as (
    select se.from_at as at, 1 as delta from seated se
    union all
    select se.to_at, -1 from seated se
  ),
  listed as (
    select g.seats, coalesce(r.seconds, 0)::bigint as seconds
    from public.game_table g
    left join private.table_run_seconds(p_venue_id, p_from, p_to) r on r.table_id = g.id
    where g.venue_id = p_venue_id
      and (g.active or coalesce(r.seconds, 0) > 0 or exists (select 1 from seated se where se.table_id = g.id))
  )
  select coalesce((select sum(l.seats) from listed l), 0)::bigint,
         coalesce((select sum(l.seconds) from listed l), 0)::bigint,
         coalesce((select sum(l.seats * l.seconds) from listed l), 0)::bigint,
         (select count(distinct se.member_id) from seated se)::bigint,
         coalesce((select max(e.running) from (select sum(ed.delta) over (order by ed.at, ed.delta rows unbounded preceding) as running from edges ed) e), 0)::bigint,
         coalesce((select sum(extract(epoch from (se.to_at - se.from_at))) from seated se), 0)::bigint,
         coalesce((select sum(extract(epoch from (b.to_at - b.from_at))) from private.table_stints(p_venue_id, p_from - (p_to - p_from + 1), p_from - 1, now() - make_interval(days => p_to - p_from + 1)) b), 0)::bigint;
end;
$$;

create function public.table_metrics(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, table_name text, seats integer, run_seconds bigint, players integer, peak integer, player_seconds bigint,
               previous_player_seconds bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.table_metrics(p_venue_id, p_from, p_to); $$;

create function public.table_metrics_total(p_venue_id uuid, p_from date, p_to date)
returns table (seats bigint, run_seconds bigint, seat_seconds bigint, players bigint, peak bigint, player_seconds bigint, previous_player_seconds bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.table_metrics_total(p_venue_id, p_from, p_to); $$;

revoke execute on function private.table_stints(uuid, date, date, timestamptz), private.table_run_seconds(uuid, date, date), private.assert_table_span(uuid, date, date),
  private.table_metrics(uuid, date, date), public.table_metrics(uuid, date, date),
  private.table_metrics_total(uuid, date, date), public.table_metrics_total(uuid, date, date) from public, anon;
grant execute on function private.table_metrics(uuid, date, date), public.table_metrics(uuid, date, date),
  private.table_metrics_total(uuid, date, date), public.table_metrics_total(uuid, date, date) to authenticated;
