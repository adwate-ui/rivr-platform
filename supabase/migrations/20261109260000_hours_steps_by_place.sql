-- A play-time step keeps its place across a promotion's versions (the owner, 9 Nov: "a step paid under any version of the
-- same promotion counts toward its limit, so an edit never pays it twice"). A step's grant was keyed by its period and
-- '@' its minutes, so a version that moved a step from 2 h to 3 h made it a new step and paid it again. It is now keyed by
-- its place among the promotion's steps, the first 1, as @rivr/domain periodKey (packages/testing/golden/
-- promotionRewards.json); with no limit set, a step's period is its visit, as a step is paid once a visit. A step is paid
-- once a visit by its place, whatever its minutes in the version that paid it, and its grant's source is its visit and
-- place ('hours_step:<visit>:@<place>'), so the database holds it to once a visit (money audit, 9 Nov). Grants already
-- given are keyed again the same way. A live bonus's steps keep their places: the builder adds or removes a step only
-- at the end (the owner, 9 Nov: "Lock step count").

-- Where a play-time step stands among its reward's steps, the first 1; its minutes where the reward has no such step.
create function private.promo_step_key(p_reward jsonb, p_step_minutes integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_step_minutes is null then null
              else coalesce((select s.n::integer from private.promo_hours_steps(p_reward) with ordinality as s (o_after_minutes, o_chips, n)
                             where p_reward ->> 'kind' = 'hours_bonus' and s.o_after_minutes = p_step_minutes), p_step_minutes) end;
$$;

-- Whether a promotion has paid a member a play-time step, by its place, in a visit: whatever the step's minutes in the
-- version that paid it. 20261109270000 counts a step skipped during a stop as settled too.
create function private.promo_step_settled(p_promotion_id uuid, p_member_id uuid, p_visit_id uuid, p_step integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.promotion_grant g
                 where g.promotion_id = p_promotion_id and g.member_id = p_member_id and g.source_key like 'hours_step:' || p_visit_id || ':%'
                   and g.period_key ~ ('@' || p_step || '(#[0-9]+)?$'));
$$;

-- @rivr/domain periodKey: as 20261109180000 made it, a step '@' its place (`p_step`), and with no limit its visit.
drop function private.promo_period_key(jsonb, text, timestamptz, uuid, integer);
create function private.promo_period_key(p_limits jsonb, p_key text, p_at timestamptz, p_visit_id uuid, p_step integer default null)
returns text
language sql
stable
set search_path = ''
as $$
  select case when p_step is not null and p_limits ->> 'perMember' = 'none' then 'visit:' || coalesce(p_visit_id::text, p_key)
    else case p_limits ->> 'perMember'
      when 'per_visit' then 'visit:' || coalesce(p_visit_id::text, p_key)
      when 'per_day' then 'day:' || to_char(private.club_day_of(p_at), 'YYYY-MM-DD')
      when 'per_week' then 'week:' || to_char(private.club_day_of(p_at) - (extract(isodow from private.club_day_of(p_at))::integer - 1), 'YYYY-MM-DD')
      when 'once' then 'once'
      else 'event:' || p_key end
    end || coalesce('@' || p_step, '');
$$;

revoke execute on function private.promo_step_key(jsonb, integer), private.promo_period_key(jsonb, text, timestamptz, uuid, integer),
  private.promo_step_settled(uuid, uuid, uuid, integer) from public, anon, authenticated;

-- As 20261109180000_hours_bonus_steps.sql made it, a step settled, limited and keyed by its place.
create or replace function private.evaluate_promotion_versions(p_venue_id uuid, p_trigger text, p_context jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := case p_trigger when 'buy_in' then 'buy_in' when 'hours_played' then 'time_played' when 'check_in' then 'visit'
                                when 'referral' then 'referral' when 'signup' then 'signup' when 'hours_step' then 'hours_step' end;
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_member jsonb;
  v_version public.promotion_version;
  v_event jsonb;
  v_grant record;
  v_base text;
  v_tally jsonb;
  v_period text;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate jsonb;
  v_id uuid;
  v_step integer;
begin
  -- An event is weighed once; a play-time bonus step once for each promotion, so one paying a step never stops another
  -- with the same step (money audit, 8 Nov).
  if v_kind is null or (p_trigger <> 'hours_step' and exists (
       select 1 from public.promotion_grant g where g.venue_id = p_venue_id and g.member_id = v_member_id
         and g.source_key = p_context ->> 'key' and g.promotion_version_id is not null)) then
    return;
  end if;
  v_member := private.promotion_member_facts(v_member_id);
  for v_version in
    select v.* from public.promotion_version v join public.promotion p on p.id = v.promotion_id
    where v.venue_id = p_venue_id and v.status = 'live' and private.promotion_event_kind(v.reward) = v_kind
    order by p.created_at, p.id
    for update of v
  loop
    -- A play-time step is paid once a visit by its place, whatever its minutes in the version that paid it.
    v_step := private.promo_step_key(v_version.reward, (p_context ->> 'step_minutes')::integer);
    continue when p_trigger = 'hours_step'
      and private.promo_step_settled(v_version.promotion_id, v_member_id, (p_context ->> 'visit_id')::uuid, v_step);
    v_event := private.promotion_event(v_kind, v_version, p_context);
    continue when not private.promo_is_eligible(
      jsonb_build_object('reward', v_version.reward, 'eligibility', v_version.eligibility, 'schedule', v_version.schedule), v_member, v_event);
    select * into v_grant from private.promo_grant(v_version.reward, v_event);
    continue when v_grant.o_refusal is not null;
    -- The member's grants in the period count against up to N times; the next is keyed as theirs in it (decision 0499).
    v_base := private.promo_period_key(v_version.limits, p_context ->> 'key', now(), (v_event ->> 'visitId')::uuid, v_step);
    v_tally := private.promotion_tally(v_version.promotion_id, v_member_id, v_base, (v_event ->> 'tableId')::uuid, private.club_day_of(now()),
                                       v_version.limits);
    continue when private.promo_check_limits(v_version.reward, v_version.limits, jsonb_build_object('chips', v_grant.o_chips), v_tally) is not null;
    v_period := private.promo_slot_key(v_base, (v_tally ->> 'periodGiven')::integer);
    -- A step's grant has its visit and place for its source, so the database refuses it a second time in the visit.
    if p_trigger = 'hours_step' then
      v_event := v_event || jsonb_build_object('key', 'hours_step:' || (p_context ->> 'visit_id') || ':@' || v_step);
    end if;
    v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
      'promotion', v_version.promotion_id::text, 'version_id', v_version.id, 'trigger', p_trigger, 'points', v_grant.o_points,
      'chips', v_grant.o_chips, 'spins', v_grant.o_spins, 'perk', v_grant.o_perk, 'period_key', v_period, 'event', v_event));
  end loop;
  for v_candidate in
    select e.c from jsonb_array_elements(v_candidates) with ordinality as e (c, n)
    where e.c ->> 'promotion' = any (private.promo_stack(v_candidates)) order by e.n
  loop
    v_id := private.give_promotion_version(v_candidate);
    if v_id is not null then
      return next v_id;
    end if;
  end loop;
end;
$$;

-- Grants already given, keyed again: '@' the step's place in the version that gave it, a no-limit step's period its visit
-- (from its source key, hours_step:<visit>:<minutes>), and a member given one step twice numbered #2 in order. The new
-- keys are set in two passes, so no key is held by two grants on the way. Only a key still '@' its minutes is keyed, so
-- running it again changes nothing (money audit, 9 Nov). How many grants it keyed.
create function private.rekey_hours_step_grants()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- First each grant's own placeholder, 'rekey:<id>|<new key>', unique as its id; then the new key alone.
  with keyed as (
    select g.id, g.promotion_id, g.member_id, g.created_at,
           (case when m.parts[1] like 'event:%' and g.source_key like 'hours_step:%' then 'visit:' || split_part(g.source_key, ':', 2)
                 else m.parts[1] end) || '@' || private.promo_step_key(v.reward, m.parts[2]::integer) as base
    from public.promotion_grant g
    join public.promotion_version v on v.id = g.promotion_version_id and v.reward ->> 'kind' = 'hours_bonus'
    cross join lateral (select regexp_match(g.period_key, '^(.*)@([0-9]+)(#[0-9]+)?$') as parts) m
    where m.parts is not null
      and m.parts[2] = case when g.source_key like 'hours_step:%' then split_part(g.source_key, ':', 3) else v.reward ->> 'afterMinutes' end
  ),
  numbered as (
    select k.id, k.base || case when row_number() over w = 1 then '' else '#' || row_number() over w end as period_key
    from keyed k
    window w as (partition by k.promotion_id, k.member_id, k.base order by k.created_at, k.id)
  )
  update public.promotion_grant g set period_key = 'rekey:' || g.id || '|' || n.period_key from numbered n where n.id = g.id;
  update public.promotion_grant g set period_key = substring(g.period_key from position('|' in g.period_key) + 1)
  where g.period_key like 'rekey:%|%';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.rekey_hours_step_grants() from public, anon, authenticated;

select private.rekey_hours_step_grants();
