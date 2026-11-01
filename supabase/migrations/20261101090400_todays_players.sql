-- Today's players (#641; owner's feedback doc of 29 Oct): every member at the club on a club day (06:00 to 06:00 IST; today
-- unless another day is given; today keeps anyone still in the room or waiting from before 06:00), for staff who read members. Each with their status now (playing, waiting or left), when
-- they checked in and out, how long they waited for a seat, and the tables they played on with the seconds on each: a seat
-- moved to another table counts there.

create function private.todays_players(p_venue_id uuid, p_day date default null)
returns table (member_id uuid, full_name text, member_number bigint, status text, checked_in_at timestamptz,
               checked_out_at timestamptz, waiting_seconds integer, tables jsonb)
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
  -- Each stretch at one table, as points split a seat's time (private.session_tables): an open one runs to now.
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
  where private.has_permission(p_venue_id, 'members.read')
  order by m.full_name;
$$;
create function public.todays_players(p_venue_id uuid, p_day date default null)
returns table (member_id uuid, full_name text, member_number bigint, status text, checked_in_at timestamptz,
               checked_out_at timestamptz, waiting_seconds integer, tables jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.todays_players(p_venue_id, p_day); $$;

revoke execute on function private.todays_players(uuid, date), public.todays_players(uuid, date) from public, anon;
grant execute on function private.todays_players(uuid, date), public.todays_players(uuid, date) to authenticated;
