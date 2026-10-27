-- The dealers' board (#124; scope-v1 module 10; decision 0252), for staff who run the floor (floor.manage): each
-- table's dealer now and how long they have dealt, due for rotation once past dealer.rotation_minutes (30 when it is
-- not set); the dealers resting, the longest rested first; and, over a period, each dealer's time at the tables,
-- hands, hands per hour, rake logged and drop-box variance. Tips belong to dealers and RIVR holds none: the screen's
-- export shares the tip pool by time dealt (@rivr/domain hourShares).

insert into public.setting_key (key, description, scope, value_schema) values
  ('dealer.rotation_minutes',
   'How long a dealer deals at one table before the floor rotates them, in minutes (scope-v1 module 10). 30 when not set.',
   'venue',
   '{"type":"object","properties":{"minutes":{"type":"integer","minimum":10,"maximum":120}},"required":["minutes"],"additionalProperties":false}');

-- The board: every dealer dealing now (state dealing: their table, since their down began, due once past the
-- rotation's minutes), then every active dealer resting who dealt in the last twelve hours or is on a rostered shift
-- now not marked absent (state resting: since their last down ended, or their shift began). Dealing, the due first and the longest at
-- the table first; then resting, the longest rested first. Nothing without floor.manage there.
create function private.dealer_rotation(p_venue_id uuid)
returns table (state text, staff_id uuid, dealer_name text, table_id uuid, table_name text, since timestamptz, minutes integer, is_due boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with rotation as (
    select coalesce((private.setting_at(p_venue_id, 'dealer.rotation_minutes', '', now()) ->> 'minutes')::integer, 30) as minutes
  ),
  dealing as (
    select d.staff_id, s.full_name, d.table_id, g.name as table_name, d.started_at
    from public.dealer_down d join public.staff s on s.id = d.staff_id join public.game_table g on g.id = d.table_id
    where d.venue_id = p_venue_id and d.ended_at is null
  ),
  resting as (
    select s.id as staff_id, s.full_name,
           coalesce((select max(d.ended_at) from public.dealer_down d
                     where d.staff_id = s.id and d.venue_id = p_venue_id and d.ended_at > now() - interval '12 hours'),
                    (select min(h.starts_at) from public.staff_shift h
                     where h.staff_id = s.id and h.venue_id = p_venue_id and now() >= h.starts_at and now() < h.ends_at
                       and not exists (select 1 from public.staff_attendance a where a.shift_id = h.id and a.status = 'absent'))) as since
    from public.staff s
    where s.venue_id = p_venue_id and s.is_active and s.role = 'dealer'
      and not exists (select 1 from dealing x where x.staff_id = s.id)
  )
  select b.state, b.staff_id, b.dealer_name, b.table_id, b.table_name, b.since, b.minutes, b.is_due
  from (
    select 'dealing' as state, x.staff_id, x.full_name as dealer_name, x.table_id, x.table_name, x.started_at as since,
           floor(extract(epoch from now() - x.started_at) / 60)::integer as minutes,
           now() - x.started_at >= make_interval(mins => r.minutes) as is_due
    from dealing x cross join rotation r
    union all
    select 'resting', z.staff_id, z.full_name, null, null, z.since, floor(extract(epoch from now() - z.since) / 60)::integer, false
    from resting z where z.since is not null
  ) b
  where private.has_permission(p_venue_id, 'floor.manage')
  order by b.state, b.is_due desc, b.since, b.dealer_name;
$$;

-- Each dealer's downs over [p_from, p_until), for staff who run the floor and read the ledger (floor.manage and
-- ledger.read): how many, the seconds of them inside the period (a down still open runs to now), the hands they dealt
-- then and per hour dealt (to one place), the rake those hands logged, and the drop-box variance of the downs that
-- ended in the period and were counted (count less logged; null with none counted), so a down across two periods
-- counts its variance once. By name.
create function private.dealer_nights(p_venue_id uuid, p_from timestamptz, p_until timestamptz)
returns table (staff_id uuid, dealer_name text, downs integer, dealt_seconds integer, hands integer, hands_per_hour numeric,
               rake_paise bigint, variance_paise bigint, counted_downs integer)
language sql
stable
security definer
set search_path = ''
as $$
  with downs as (
    select d.id, d.staff_id, d.ended_at >= p_from and d.ended_at < p_until as ended_inside,
           greatest(0, floor(extract(epoch from least(coalesce(d.ended_at, now()), p_until) - greatest(d.started_at, p_from))))::integer as seconds
    from public.dealer_down d
    where d.venue_id = p_venue_id and d.started_at < p_until and coalesce(d.ended_at, now()) > p_from
  ),
  dealt as (
    select w.staff_id, count(*)::integer as downs, sum(w.seconds)::integer as seconds,
           (count(c.down_id) filter (where w.ended_inside))::integer as counted,
           (sum(c.variance_paise) filter (where w.ended_inside))::bigint as variance
    from downs w left join public.down_count c on c.down_id = w.id
    group by w.staff_id
  ),
  played as (
    select h.staff_id, count(*)::integer as hands, coalesce(sum(h.rake_paise), 0)::bigint as rake
    from public.hand h
    where h.venue_id = p_venue_id and h.played_at >= p_from and h.played_at < p_until
    group by h.staff_id
  )
  select s.id, s.full_name, w.downs, w.seconds, coalesce(p.hands, 0),
         case when w.seconds > 0 then round(coalesce(p.hands, 0) * 3600.0 / w.seconds, 1) end,
         coalesce(p.rake, 0), w.variance, w.counted
  from dealt w join public.staff s on s.id = w.staff_id left join played p on p.staff_id = w.staff_id
  where private.has_permission(p_venue_id, 'floor.manage') and private.has_permission(p_venue_id, 'ledger.read')
  order by s.full_name, s.id;
$$;

create function public.dealer_rotation(p_venue_id uuid)
returns table (state text, staff_id uuid, dealer_name text, table_id uuid, table_name text, since timestamptz, minutes integer, is_due boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.dealer_rotation(p_venue_id); $$;
create function public.dealer_nights(p_venue_id uuid, p_from timestamptz, p_until timestamptz)
returns table (staff_id uuid, dealer_name text, downs integer, dealt_seconds integer, hands integer, hands_per_hour numeric,
               rake_paise bigint, variance_paise bigint, counted_downs integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.dealer_nights(p_venue_id, p_from, p_until); $$;

revoke execute on function private.dealer_rotation(uuid), private.dealer_nights(uuid, timestamptz, timestamptz),
  public.dealer_rotation(uuid), public.dealer_nights(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function private.dealer_rotation(uuid), private.dealer_nights(uuid, timestamptz, timestamptz),
  public.dealer_rotation(uuid), public.dealer_nights(uuid, timestamptz, timestamptz) to authenticated;
