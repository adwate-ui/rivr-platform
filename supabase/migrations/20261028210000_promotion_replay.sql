-- Last week's events, for simulating a promotion before it is published (#144, scope-v1 module 7 controls;
-- decision 0214). Staff who manage promotions ask for the events a buy-in or hours-played rule would have
-- weighed in the last seven whole club days (06:00 to 06:00 IST), as the engine got them live:
-- - a buy-in at the cage (private.buy_in_promotions): its time, the table the member sat at then and its
--   stake, and the member's own money (₹0 when paid from bonus);
-- - a closed visit with hours played (private.weigh_hours_played): its close, the table played longest,
--   the hours and points earned; for a rule with days or times only the time inside its window, and a
--   visit with none there is left out (private.rule_in_window).
-- @rivr/domain simulatePromotion replays them with the engine's own rules. A member is a number within the
-- replay, enough for per-player limits, never an id or a name: marketing manages promotions without
-- reading members. Reading changes nothing, so it answers while the venue is frozen or promotions are off.

-- Last week's cage buy-ins, each at the table the member sat at when it was made.
create function private.replay_buy_ins(p_venue_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', b.created_at, 'member', b.member, 'tier_id', b.tier_id, 'table_id', b.table_id,
           'stake', b.stake, 'amount_paise', b.amount_paise, 'points', 0, 'hours_played', 0) order by b.created_at, b.id), '[]'::jsonb)
  from (
    select c.id, c.created_at, dense_rank() over (order by c.member_id) as member, m.tier_id, t.o_table_id as table_id, tt.code as stake,
           case when c.method = 'bonus' then 0 else c.amount_paise end as amount_paise
    from public.cage_transaction c
    join public.member m on m.id = c.member_id
    left join lateral (select st.o_table_id from private.session_tables(c.session_id) st
                       where st.o_from <= c.created_at order by st.o_from desc limit 1) t on true
    left join public.game_table g on g.id = t.o_table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where c.venue_id = p_venue_id and c.kind = 'buy_in' and c.created_at >= p_from and c.created_at < p_to
  ) b;
$$;

-- Last week's closed visits with hours played: all of each visit's, or for a rule with days or times only
-- the time inside its window, at the table played longest.
create function private.replay_hours_played(p_venue_id uuid, p_conditions jsonb, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', x.closed_at, 'member', x.member, 'tier_id', x.tier_id, 'table_id', x.table_id,
           'stake', x.stake, 'amount_paise', 0, 'points', x.points, 'hours_played', trunc(x.seconds / 3600.0, 2)) order by x.closed_at, x.id), '[]'::jsonb)
  from (
    select v.id, v.closed_at, dense_rank() over (order by v.member_id) as member, m.tier_id, t.table_id, tt.code as stake,
           case when p_conditions ?| array['days', 'from'] then win.o_seconds else h.o_played end as seconds,
           case when p_conditions ?| array['days', 'from'] then win.o_points else h.o_points end as points
    from public.visit v
    join public.member m on m.id = v.member_id
    cross join lateral private.visit_hours(v.id) h
    cross join lateral private.visit_window_time(v.id, p_conditions) win
    left join lateral (select e.table_id from public.points_earning e where e.visit_id = v.id and e.basis = 'hours'
                       group by e.table_id order by sum(e.played_seconds) desc, e.table_id limit 1) t on true
    left join public.game_table g on g.id = t.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where v.venue_id = p_venue_id and v.closed_at >= p_from and v.closed_at < p_to and h.o_played > 0
      and (not p_conditions ?| array['days', 'from'] or win.o_seconds > 0)
  ) x;
$$;

create function private.promotion_replay(p_venue_id uuid, p_trigger text, p_conditions jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_to timestamptz := private.tonight_began(now());
  v_from timestamptz := private.tonight_began(now()) - interval '7 days';
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'promotions.manage') then
    raise exception 'Only staff who manage promotions simulate one' using errcode = '42501';
  end if;
  if p_trigger is null or p_trigger not in ('buy_in', 'hours_played') or jsonb_typeof(p_conditions) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_conditions) k
                where k not in ('days', 'from', 'until', 'stakes', 'table_ids', 'tier_ids', 'first_n', 'min_hours')) then
    raise exception 'Only a buy-in or hours-played rule on days, times, stakes, tables, tiers, first N and hours is replayed'
      using errcode = '22023';
  end if;
  return jsonb_build_object('from', v_from, 'to', v_to, 'events', case when p_trigger = 'buy_in'
    then private.replay_buy_ins(p_venue_id, v_from, v_to) else private.replay_hours_played(p_venue_id, p_conditions, v_from, v_to) end);
end;
$$;

create function public.promotion_replay(p_venue_id uuid, p_trigger text, p_conditions jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.promotion_replay(p_venue_id, p_trigger, p_conditions);
$$;

revoke execute on function private.replay_buy_ins(uuid, timestamptz, timestamptz),
  private.replay_hours_played(uuid, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function private.promotion_replay(uuid, text, jsonb), public.promotion_replay(uuid, text, jsonb) from public, anon;
grant execute on function private.promotion_replay(uuid, text, jsonb), public.promotion_replay(uuid, text, jsonb) to authenticated;
