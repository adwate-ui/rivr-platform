-- Hours-played promotions count the seated time inside their window (#457; the owner's answer on
-- question #445; decision 0186).
--
-- A playing-time promotion pays when a visit closes (decision 0164). Until now a rule with days or times,
-- such as "Thursday 14:00 to 20:00, double points at 100/200", was weighed at the moment of the close, so
-- a player who played 14:00 to 20:00 and scanned out at 20:30 got nothing. Now such a rule weighs only
-- the seated time inside its window, and at its stakes or tables when it names them, whenever the visit
-- closes: the hours played and the points earned are that time's, and the rule's days, times, stakes and
-- tables are then met. No such time, no promotion. Rules without days or times, and every other trigger,
-- are weighed as before.
--
-- Time away is not known by the clock, so each table's time inside the window bears its share of it, and
-- earns points at that table's rate, as points do (private.table_played_seconds, private.points_for_time).
-- @rivr/domain secondsInWindow and playedSecondsInWindow are the twins, proved equal on
-- packages/testing/golden/promotionWindow.json.

-- The whole seconds from p_from to p_to inside a rule's window: on each club day (06:00 to 06:00 IST)
-- the span touches that the rule's days allow, the part between its from and until. No times is the
-- whole day; no days is every day.
create function private.seconds_in_window(p_from timestamptz, p_to timestamptz, p_conditions jsonb)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(floor(sum(greatest(0, extract(epoch from least(c.ends, d.day + make_interval(mins => c.high))
                                                         - greatest(c.starts, d.day + make_interval(mins => c.low)))))), 0)::bigint
  from (select p_from at time zone 'Asia/Kolkata' - interval '6 hours' as starts,
               p_to at time zone 'Asia/Kolkata' - interval '6 hours' as ends,
               case when p_conditions ? 'from' and p_conditions ? 'until'
                    then private.club_minute(p_conditions ->> 'from') else 0 end as low,
               case when p_conditions ? 'from' and p_conditions ? 'until'
                    then coalesce(nullif(private.club_minute(p_conditions ->> 'until'), 0), 1440) else 1440 end as high) c
  cross join lateral generate_series(date_trunc('day', c.starts), c.ends, interval '1 day') d(day)
  where d.day < c.ends
    and (not p_conditions ? 'days' or p_conditions -> 'days' @> to_jsonb(extract(isodow from d.day)::integer));
$$;

-- The seconds a closed visit was played inside a rule's window, at the rule's stakes and tables if it
-- names them, and the points they earned: by session, table and rate, as private.visit_table_time counts
-- the time played, each table's stints inside the window less its share of the time away, at its rate.
create function private.visit_window_time(p_visit_id uuid, p_conditions jsonb)
returns table (o_seconds bigint, o_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_window(t.o_from, least(t.o_to, v.closed_at), p_conditions) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at
  ),
  rated as (
    select st.*, coalesce((private.setting_at(st.venue_id, 'points.per_hour', tt.code, st.o_from) ->> 'points')::integer, 0) as rate
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where (not p_conditions ? 'stakes' or p_conditions -> 'stakes' ? tt.code)
      and (not p_conditions ? 'table_ids' or p_conditions -> 'table_ids' ? st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds, r.rate
    from rated r
    group by r.session_id, r.table_id, r.rate, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint, coalesce(sum(private.points_for_time(p.seconds, p.rate)), 0)::bigint from played p;
$$;

-- How a rule weighs the event: an hours-played rule with days or times weighs the visit's time inside its
-- window (o_counts is false when there is none), its days, times, stakes and tables dropped as met, with
-- that time's hours played and points. Any other rule passes through as it is, with the event's points.
create function private.rule_in_window(p_conditions jsonb, p_trigger text, p_context jsonb)
returns table (o_counts boolean, o_conditions jsonb, o_facts jsonb, o_points bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_visit_id uuid := (p_context ->> 'visit_id')::uuid;
  v_time record;
begin
  if p_trigger <> 'hours_played' or v_visit_id is null or not p_conditions ?| array['days', 'from'] then
    return query select true, p_conditions, '{}'::jsonb, (p_context ->> 'points')::bigint;
    return;
  end if;
  select * into v_time from private.visit_window_time(v_visit_id, p_conditions);
  return query select v_time.o_seconds > 0, p_conditions - array['days', 'from', 'until', 'stakes', 'table_ids'],
    jsonb_build_object('hours_played', trunc(v_time.o_seconds / 3600.0, 2)), v_time.o_points;
end;
$$;

-- As before (20261020145904_promotions_engine.sql), but each rule weighs the event as
-- private.rule_in_window says.
create or replace function private.promotion_candidate(p_promotion public.promotion, p_trigger text, p_facts jsonb, p_context jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_day date := (p_facts ->> 'club_day')::date;
  v_given public.promotion_grant;
  v_rule public.promotion_rule;
  v_window record;
  v_reward record;
  v_budget public.promotion_budget;
begin
  select * into v_given from public.promotion_grant g
  where g.promotion_id = p_promotion.id and g.member_id = v_member_id and g.source_key = p_context ->> 'key';
  if v_given.id is not null then
    return jsonb_build_object('promotion', p_promotion.id, 'stacks', p_promotion.stacks, 'cost_paise', v_given.cost_paise, 'is_given', true);
  end if;
  select r.* into v_rule from public.promotion_rule r
  cross join lateral private.rule_in_window(r.conditions, p_trigger, p_context) w
  where r.promotion_id = p_promotion.id and r.trigger = p_trigger and w.o_counts
    and private.promotion_applies(w.o_conditions, p_facts || w.o_facts || jsonb_build_object(
      'granted_today', (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id and g.club_day = v_day),
      'granted_today_at_table', (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id and g.club_day = v_day
                                 and g.table_id = (p_facts ->> 'table_id')::uuid)))
  order by r.position limit 1;
  if v_rule.id is null then
    return null;
  end if;
  select * into v_window from private.rule_in_window(v_rule.conditions, p_trigger, p_context);
  select * into v_reward from private.promotion_reward(v_rule.effect,
    case when p_context ->> 'method' = 'bonus' then 0 else (p_context ->> 'amount_paise')::bigint end, v_window.o_points);
  if not found then
    return null;
  end if;
  select * into v_budget from public.promotion_budget b where b.promotion_id = p_promotion.id;
  return jsonb_build_object('promotion', p_promotion.id, 'name', p_promotion.name, 'venue_id', p_promotion.venue_id, 'rule', v_rule.id,
    'trigger', v_rule.trigger, 'effect', v_rule.effect, 'stacks', p_promotion.stacks, 'cost_paise', v_reward.cost_paise, 'points', v_reward.points,
    'budget_left_paise', v_budget.cap_paise - (select coalesce(sum(g.cost_paise), 0) from public.promotion_grant g where g.promotion_id = p_promotion.id),
    'grants_left', v_budget.cap_count - (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id),
    'player_left', p_promotion.per_player_limit - (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id
                                                   and g.member_id = v_member_id and (p_promotion.per_player_period = 'promotion' or g.club_day = v_day)));
end;
$$;

-- As before (20261026100000_door_kiosk.sql), but the event names the visit, for a rule's window.
create or replace function private.weigh_hours_played(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_hours record;
  v_table uuid;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id;
  select * into v_hours from private.visit_hours(p_visit_id);
  if v_visit.closed_at is null or v_hours.o_played <= 0 then return; end if;
  select e.table_id into v_table from public.points_earning e where e.visit_id = p_visit_id and e.basis = 'hours'
  group by e.table_id order by sum(e.played_seconds) desc, e.table_id limit 1;
  perform private.evaluate_promotions(v_visit.venue_id, 'hours_played', jsonb_build_object(
    'member_id', v_visit.member_id, 'table_id', v_table, 'key', 'hours_played:' || p_visit_id, 'visit_id', p_visit_id,
    'hours_played', trunc(v_hours.o_played / 3600.0, 2), 'points', v_hours.o_points));
end;
$$;

revoke execute on function private.seconds_in_window(timestamptz, timestamptz, jsonb), private.visit_window_time(uuid, jsonb),
  private.rule_in_window(jsonb, text, jsonb) from public, anon, authenticated;
