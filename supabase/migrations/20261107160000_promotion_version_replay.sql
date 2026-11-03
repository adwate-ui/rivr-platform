-- Last week replayed for a version (console v3 phase 7; as decision 0214 did for rules). Staff who manage promotions ask
-- for the events of the last seven whole club days that the version's reward is given for, as @rivr/contracts
-- promotionEventSchema and memberFactsSchema have them, and @rivr/domain simulate weighs them in the browser: buy-ins,
-- closed visits' time inside its schedule at its stakes and tables, check-ins, referrals (both sides) or sign-ups. A
-- member, a visit and an event's key are numbers within the replay, never ids or names: marketing reads no members.
-- Reading changes nothing, so it answers while the venue is frozen or promotions are off.

-- What a version would have known of the member at a moment: tier (today's), days since joining and since the last
-- visit before then.
create function private.replay_member_facts(p_member_id uuid, p_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tierId', m.tier_id,
    'daysSinceJoined', greatest(private.club_day_of(p_at) - private.club_day_of(m.created_at), 0),
    'daysSinceLastVisit', (select floor(extract(epoch from p_at - max(v.opened_at)) / 86400)::integer from public.visit v
                           where v.member_id = m.id and v.opened_at < p_at - interval '12 hours'),
    'isWoman', null)
  from public.member m where m.id = p_member_id;
$$;

-- One replayed event with its member: the member, visit and key as numbers within the replay, and its time to the minute,
-- so an event cannot be matched to the cage's or the floor's records.
create function private.replay_entry(p_kind text, p_n bigint, p_at timestamptz, p_member_id uuid, p_member_n bigint, p_more jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event', jsonb_build_object('kind', p_kind, 'key', p_kind || ':' || p_n, 'at', date_trunc('minute', p_at), 'memberId', 'm' || p_member_n, 'visitId', null,
                                'tableId', null, 'stake', null) || p_more,
    'member', private.replay_member_facts(p_member_id, p_at));
$$;

-- The events a version's reward is given for, in the window.
create function private.replay_version_events(p_version public.promotion_version, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with buy_ins as (
    select c.id, c.created_at as at, c.member_id, vis.id as visit_id, t.o_table_id as table_id, tt.code as stake,
           case when c.method = 'bonus' then 0 else c.amount_paise / 100 end as own_chips,
           row_number() over (partition by c.member_id, coalesce(vis.id::text, private.club_day_of(c.created_at)::text) order by c.created_at, c.id) as nth
    from public.cage_transaction c
    left join lateral (select v.id from public.visit v where v.member_id = c.member_id and v.opened_at <= c.created_at
                       order by v.opened_at desc limit 1) vis on true
    left join lateral (select st.o_table_id from private.session_tables(c.session_id) st where st.o_from <= c.created_at
                       order by st.o_from desc limit 1) t on true
    left join public.game_table g on g.id = t.o_table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'buy_in'
      and c.venue_id = p_version.venue_id and c.kind = 'buy_in' and c.created_at >= p_from and c.created_at < p_to
  ),
  played as (
    select v.id, v.closed_at as at, v.member_id, w.o_seconds, w.o_points, lt.table_id, tt.code as stake
    from public.visit v
    cross join lateral private.visit_schedule_time(v.id, p_version.schedule, p_version.eligibility) w
    left join lateral (select e.table_id from public.points_earning e where e.visit_id = v.id and e.basis = 'hours'
                       group by e.table_id order by sum(e.played_seconds) desc, e.table_id limit 1) lt on true
    left join public.game_table g on g.id = lt.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'time_played'
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
  entries as (
    select b.at, b.id::text as id, b.member_id, 'buy_in' as kind,
           jsonb_build_object('tableId', b.table_id, 'stake', b.stake, 'ownChips', b.own_chips, 'isFirstOfVisit', b.nth = 1,
                              'visitId', 'v' || dense_rank() over (order by b.visit_id)) as more
    from buy_ins b
    union all
    select p.at, p.id::text, p.member_id, 'time_played',
           jsonb_build_object('tableId', p.table_id, 'stake', p.stake, 'minutes', p.o_seconds / 60, 'points', p.o_points,
                              'visitId', 'v' || dense_rank() over (order by p.id))
    from played p
    union all
    select v.at, v.id::text, v.member_id, 'visit', jsonb_build_object('visitInMonth', v.in_month, 'visitId', 'v' || dense_rank() over (order by v.id))
    from visits v
    union all
    select o.at, o.id::text || o.member_id::text, o.member_id, private.promotion_event_kind(p_version.reward), '{}'::jsonb
    from others o
  )
  select coalesce(jsonb_agg(private.replay_entry(e.kind, e.n, e.at, e.member_id, e.member_n, e.more) order by e.at, e.n), '[]'::jsonb)
  from (select x.*, row_number() over (order by x.at, x.id) as n, dense_rank() over (order by x.member_id) as member_n from entries x) e;
$$;

create function private.promotion_version_replay(p_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version;
  v_to timestamptz := private.tonight_began(now());
begin
  select * into v_version from public.promotion_version v where v.id = p_version_id;
  if v_version.id is null or not coalesce(private.has_permission(v_version.venue_id, 'promotions.manage'), false) then
    raise exception 'Only staff who manage promotions simulate one' using errcode = '42501';
  end if;
  return jsonb_build_object('from', v_to - interval '7 days', 'to', v_to,
                            'events', private.replay_version_events(v_version, v_to - interval '7 days', v_to));
end;
$$;

create function public.promotion_version_replay(p_version_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.promotion_version_replay(p_version_id); $$;

revoke execute on function private.replay_member_facts(uuid, timestamptz), private.replay_entry(text, bigint, timestamptz, uuid, bigint, jsonb),
  private.replay_version_events(public.promotion_version, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function private.promotion_version_replay(uuid), public.promotion_version_replay(uuid) from public, anon;
grant execute on function private.promotion_version_replay(uuid), public.promotion_version_replay(uuid) to authenticated;
