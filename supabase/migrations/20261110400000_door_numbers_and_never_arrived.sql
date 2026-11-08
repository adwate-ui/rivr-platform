-- The door tells two members of one name apart (audit F-020): its rows carry the member number, and whether the tier is
-- the club's base one, which the row leaves out. The columns are new, so the list's function is made again.
--
-- Today's players says 'never_arrived' for someone who dropped off a list without checking in, and 'in_room' for someone
-- checked in with no seat or list (audit F-097), so 'left' means someone who went home.

drop function public.door_board(uuid);
drop function private.door_board(uuid);

create function private.door_board(p_venue_id uuid)
returns table (member_id uuid, full_name text, tier_name text, is_in_room boolean, since timestamptz, member_number bigint, is_base_tier boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, t.name, false, min(e.joined_at), m.member_number,
         t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired)
  from public.waitlist_entry e
  join public.member m on m.id = e.member_id
  join public.tier t on t.id = m.tier_id
  where e.venue_id = p_venue_id and e.status = 'waiting' and private.current_visit(m.id) is null
    and private.has_permission(p_venue_id, 'waitlist.manage')
  group by m.id, m.full_name, t.name, m.member_number, t.rank, t.venue_id
  union all
  select m.id, m.full_name, t.name, true, v.opened_at, m.member_number,
         t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired)
  from public.visit v
  join public.member m on m.id = v.member_id
  join public.tier t on t.id = m.tier_id
  where v.venue_id = p_venue_id and v.closed_at is null and private.has_permission(p_venue_id, 'waitlist.manage')
  order by 4, 5;
$$;

create function public.door_board(p_venue_id uuid)
returns table (member_id uuid, full_name text, tier_name text, is_in_room boolean, since timestamptz, member_number bigint, is_base_tier boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.door_board(p_venue_id); $$;

revoke execute on function private.door_board(uuid) from public, anon, authenticated, service_role;
grant execute on function private.door_board(uuid) to authenticated;
revoke execute on function public.door_board(uuid) from public, anon, authenticated, service_role;
grant execute on function public.door_board(uuid) to authenticated;

CREATE OR REPLACE FUNCTION private.todays_players(p_venue_id uuid, p_day date DEFAULT NULL::date)
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
  where private.has_permission(p_venue_id, 'members.read')
  order by m.full_name;
$function$;
