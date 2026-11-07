-- The MIS "Tables" view (the owner, 8 Nov: "table level details, e.g. hours running, total players in an interval,
-- player hours, % utilisation"), money-free. For each table over a span of club days (06:00 to 06:00 IST): the seconds it
-- ran (its table runs, each clipped to the span); the members who sat there; the most seated at once; and the seconds
-- they sat there (each seat session's stints at the table, from private.session_tables, clipped to the span). Runs and
-- seats still open count up to now. How full it was is @rivr/domain tableUse, from these. For staff who read reports, at
-- the venue in use; a span of 1 to 92 club days.

create function private.table_metrics(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, table_name text, seats integer, run_seconds bigint, players integer, peak integer, player_seconds bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 91 then
    raise exception 'A span of 1 to 92 club days' using errcode = '22023';
  end if;
  return query
  with span as (
    select ((p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata') as from_at,
           least(((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata', now()) as to_at
  ),
  runs as (
    select r.table_id,
           sum(extract(epoch from (least(coalesce(r.closed_at, now()), s.to_at) - greatest(r.opened_at, s.from_at))))::bigint as seconds
    from public.table_run r cross join span s
    where r.venue_id = p_venue_id and r.opened_at < s.to_at and coalesce(r.closed_at, now()) > s.from_at
    group by r.table_id
  ),
  stints as (
    select st.o_table_id as table_id, ss.member_id, greatest(st.o_from, s.from_at) as from_at, least(st.o_to, now(), s.to_at) as to_at
    from public.seat_session ss cross join span s
    cross join lateral private.session_tables(ss.id) st
    where ss.venue_id = p_venue_id and ss.started_at < s.to_at and coalesce(ss.ended_at, now()) > s.from_at
  ),
  seated as (
    select * from stints where to_at > from_at
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
  )
  select g.id, g.name, g.seats, coalesce(r.seconds, 0)::bigint, coalesce(p.players, 0), coalesce(k.peak, 0), coalesce(p.seconds, 0)::bigint
  from public.game_table g
  left join runs r on r.table_id = g.id
  left join played p on p.table_id = g.id
  left join peaks k on k.table_id = g.id
  where g.venue_id = p_venue_id and private.has_permission(p_venue_id, 'reports.read')
    and (coalesce(r.seconds, 0) > 0 or coalesce(p.seconds, 0) > 0)
  order by g.position, g.name;
end;
$$;

create function public.table_metrics(p_venue_id uuid, p_from date, p_to date)
returns table (table_id uuid, table_name text, seats integer, run_seconds bigint, players integer, peak integer, player_seconds bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.table_metrics(p_venue_id, p_from, p_to); $$;

revoke execute on function private.table_metrics(uuid, date, date), public.table_metrics(uuid, date, date) from public, anon;
grant execute on function private.table_metrics(uuid, date, date), public.table_metrics(uuid, date, date) to authenticated;
