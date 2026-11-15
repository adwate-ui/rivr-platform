-- The high hand in the promotion builder (redesign of 15 Nov 2026, issue 966, RD-23): last week's hits replayed for a
-- version's simulation, as any reward's events are, and tonight's hits read for a promotion's record beside the list.

-- Last week replayed for a version, as 20261117210000 left it, with the high hands the floor logged: each hit as it was
-- logged and paid, every rule confirmed (a hit is kept only once each was), weighed again on the version's own hands.
CREATE OR REPLACE FUNCTION private.replay_version_events(p_version promotion_version, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with seats as (
    select s.id, s.started_at as at, s.member_id, s.visit_id, s.table_id, tt.code as stake,
           row_number() over (partition by s.visit_id order by s.started_at, s.id) as nth
    from public.seat_session s
    left join public.game_table g on g.id = s.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'seated'
      and s.venue_id = p_version.venue_id and s.started_at >= p_from and s.started_at < p_to
  ),
  played as (
    select v.id, v.closed_at as at, v.member_id, w.o_seconds, lt.table_id, tt.code as stake
    from public.visit v
    cross join lateral private.visit_schedule_time(v.id, p_version.schedule, p_version.eligibility) w
    left join lateral (select e.o_table_id as table_id from private.visit_table_time(v.id) e
                       group by e.o_table_id order by sum(e.o_played) desc, e.o_table_id limit 1) lt on true
    left join public.game_table g on g.id = lt.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) in ('time_played', 'hours_step')
      and v.venue_id = p_version.venue_id and v.closed_at >= p_from and v.closed_at < p_to and w.o_seconds > 0
  ),
  visits as (
    select v.id, v.opened_at as at, v.member_id,
           (select count(*) from public.visit x where x.member_id = v.member_id and x.opened_at <= v.opened_at
              and x.opened_at >= date_trunc('month', v.opened_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as in_month
    from public.visit v
    where private.promotion_event_kind(p_version.reward) = 'visit'
      and v.venue_id = p_version.venue_id and v.opened_at >= p_from and v.opened_at < p_to
  ),
  others as (
    select r.id, r.completed_at as at, side.member_id
    from public.referral r cross join lateral (values (r.member_id), (r.referrer_member_id)) side (member_id)
    where private.promotion_event_kind(p_version.reward) = 'referral'
      and r.venue_id = p_version.venue_id and r.completed_at >= p_from and r.completed_at < p_to
    union all
    select k.id, k.verified_at, k.member_id from public.kyc_record k
    where private.promotion_event_kind(p_version.reward) = 'signup'
      and k.venue_id = p_version.venue_id and k.status = 'verified' and k.verified_at >= p_from and k.verified_at < p_to
  ),
  hits as (
    select h.id, h.created_at as at, h.member_id, h.table_id, tt.code as stake, h.hand, h.rank
    from public.high_hand_hit h
    left join public.game_table g on g.id = h.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'high_hand'
      and h.venue_id = p_version.venue_id and h.created_at >= p_from and h.created_at < p_to
  ),
  entries as (
    select s.at, s.id::text as id, s.member_id, 'seated' as kind,
           jsonb_build_object('tableId', s.table_id, 'stake', s.stake, 'isFirstOfVisit', s.nth = 1, 'visitId', 'v' || dense_rank() over (order by s.visit_id)) as more
    from seats s
    union all
    select p.at, p.id::text, p.member_id, 'time_played',
           jsonb_build_object('tableId', p.table_id, 'stake', p.stake, 'minutes', p.o_seconds / 60,
                              'visitId', 'v' || dense_rank() over (order by p.id))
    from played p
    union all
    select v.at, v.id::text, v.member_id, 'visit', jsonb_build_object('visitInMonth', v.in_month, 'visitId', 'v' || dense_rank() over (order by v.id))
    from visits v
    union all
    select o.at, o.id::text || o.member_id::text, o.member_id, private.promotion_event_kind(p_version.reward), '{}'::jsonb
    from others o
    union all
    select h.at, h.id::text, h.member_id, 'high_hand',
           jsonb_build_object('tableId', h.table_id, 'stake', h.stake, 'hand', h.hand, 'rank', h.rank,
                              'confirmed', '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}'::jsonb)
    from hits h
  )
  select coalesce(jsonb_agg(private.replay_entry(e.kind, e.n, e.at, e.member_id, e.member_n, e.more) order by e.at, e.n), '[]'::jsonb)
  from (select x.*, row_number() over (order by x.at, x.id) as n, dense_rank() over (order by x.member_id) as member_n from entries x) e;
$function$
;

-- Tonight's high hands at a venue, the newest first, for staff who seat players or manage promotions: who, where, the hand
-- as it was paid, its Bonus and who logged it. Every row carries the night's count and Bonus in all, so a list cut short
-- still totals right. With a promotion, its hits alone, for its record: an ended one never shows the next one's. Nobody
-- else is told anything.
create function private.high_hand_tonight(p_venue_id uuid, p_promotion_id uuid, p_limit integer)
returns table (hit_id uuid, logged_at timestamptz, member_id uuid, member_name text, table_name text, seat integer, hand text, rank text, chips bigint,
               logged_by text, paid_count bigint, paid_chips bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.created_at, h.member_id, m.full_name, g.name, h.seat, h.hand, h.rank, h.chips, s.full_name,
         count(*) over (), (sum(h.chips) over ())::bigint
  from public.high_hand_hit h
  join public.member m on m.id = h.member_id
  join public.game_table g on g.id = h.table_id
  join public.staff s on s.id = h.logged_by_staff_id
  where h.venue_id = p_venue_id and h.created_at >= private.tonight_began(now())
    and (p_promotion_id is null or h.promotion_id = p_promotion_id)
    and (coalesce(private.has_permission(p_venue_id, 'waitlist.manage'), false) or coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false))
  order by h.created_at desc, h.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

create function public.high_hand_tonight(p_venue_id uuid, p_promotion_id uuid default null, p_limit integer default 50)
returns table (hit_id uuid, logged_at timestamptz, member_id uuid, member_name text, table_name text, seat integer, hand text, rank text, chips bigint,
               logged_by text, paid_count bigint, paid_chips bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.high_hand_tonight(p_venue_id, p_promotion_id, p_limit); $$;

revoke execute on function private.high_hand_tonight(uuid, uuid, integer), public.high_hand_tonight(uuid, uuid, integer) from public, anon;
grant execute on function private.high_hand_tonight(uuid, uuid, integer), public.high_hand_tonight(uuid, uuid, integer) to authenticated;
