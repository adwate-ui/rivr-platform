-- The engine weighs live versions (console v3 phase 7; decisions 0470 to 0472, 0491). private.evaluate_promotions keeps
-- its name, arguments and every caller (a buy-in, a visit closed, a check-in, a referral); it now also takes a sign-up,
-- fired once a member's identity is verified. For each live version whose reward is for that kind of event it builds
-- the event as @rivr/domain weighs it, then asks the twins: promo_is_eligible, promo_grant, promo_check_limits against
-- the promotion's grants over all its versions, and promo_stack across the versions for the one event. A grant is
-- written with its period key, which the database keeps unique per promotion and member; chips are credited as bonus
-- at once (chips × 100 paise), points as points, spins wait at the wheel, perks for the floor. A promotion still run by
-- its rule (made by the old builder, before versions) is weighed as before until the console moves (decision 0491).

-- @rivr/domain triggerOf: the kind of event a reward is given for.
create function private.promotion_event_kind(p_reward jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_reward ->> 'kind' in ('points_multiplier', 'hours_bonus', 'free_spin') then 'time_played'
    when p_reward ->> 'kind' = 'buyin_bonus' then 'buy_in'
    when p_reward ->> 'kind' = 'bonus_chips' then case p_reward ->> 'on' when 'first_buyin' then 'buy_in' else p_reward ->> 'on' end
    else 'visit' end;
$$;

-- What a version knows of the member now: tier, whole club days since joining, whole days since the last visit before
-- this one (null for a first), and whether a woman (null: the club records no gender, decision 0472).
create function private.promotion_member_facts(p_member_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tierId', m.tier_id,
    'daysSinceJoined', private.club_day_of(now()) - private.club_day_of(m.created_at),
    'daysSinceLastVisit', (select floor(extract(epoch from now() - max(v.opened_at)) / 86400)::integer from public.visit v
                           where v.member_id = m.id and v.opened_at <= now() and v.id is distinct from private.current_visit(m.id)),
    'isWoman', null)
  from public.member m where m.id = p_member_id;
$$;

-- The seconds a closed visit was played inside a version's schedule, at its stakes and tables, and the points they
-- earned: as private.visit_window_time counts a rule's window, each table's time inside less its share of time away.
create function private.visit_schedule_time(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb)
returns table (o_seconds bigint, o_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_schedule(p_schedule, t.o_from, least(t.o_to, v.closed_at)) as seconds,
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
    where private.is_listed(p_eligibility -> 'stakes', tt.code) and private.is_listed(p_eligibility -> 'tableIds', st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds, r.rate
    from rated r
    group by r.session_id, r.table_id, r.rate, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint, coalesce(sum(private.points_for_time(p.seconds, p.rate)), 0)::bigint from played p;
$$;

-- The event a version weighs, as @rivr/contracts promotionEventSchema has it, from the engine's context: a buy-in (the
-- member's own chips, none when paid from bonus; whether it is the visit's first), time played (the minutes and points
-- inside this version's schedule), a visit (its number in the IST calendar month), a referral or a sign-up.
create function private.promotion_event(p_kind text, p_version public.promotion_version, p_context jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member uuid := (p_context ->> 'member_id')::uuid;
  v_table uuid := (p_context ->> 'table_id')::uuid;
  v_visit uuid := coalesce((p_context ->> 'visit_id')::uuid, private.current_visit(v_member));
  v_base jsonb;
  v_time record;
begin
  v_base := jsonb_build_object('kind', p_kind, 'key', p_context ->> 'key', 'at', now(), 'memberId', v_member, 'visitId', v_visit,
    'tableId', v_table,
    'stake', (select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = v_table));
  if p_kind = 'buy_in' then
    return v_base || jsonb_build_object(
      'ownChips', case when p_context ->> 'method' = 'bonus' then 0 else coalesce((p_context ->> 'amount_paise')::bigint, 0) / 100 end,
      'isFirstOfVisit', (select count(*) <= 1 from public.cage_transaction c
                         where c.member_id = v_member and c.kind = 'buy_in'
                           and c.created_at >= coalesce((select v.opened_at from public.visit v where v.id = v_visit), private.tonight_began(now()))));
  elsif p_kind = 'time_played' then
    select * into v_time from private.visit_schedule_time(v_visit, p_version.schedule, p_version.eligibility);
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60, 'points', v_time.o_points);
  elsif p_kind = 'visit' then
    return v_base || jsonb_build_object('tableId', null, 'stake', null,
      'visitInMonth', (select count(*) from public.visit v where v.member_id = v_member and v.opened_at <= now()
                         and v.opened_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'));
  end if;
  return v_base || jsonb_build_object('visitId', null, 'tableId', null, 'stake', null);
end;
$$;

-- What a promotion's grants so far say about one more (@rivr/domain tallyFor), over all its versions and its rule's.
create function private.promotion_tally(p_promotion_id uuid, p_member_id uuid, p_period_key text, p_table_id uuid, p_day date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'chipsGiven', coalesce(sum(g.chips), 0),
    'grantsGiven', count(*),
    'membersToday', count(distinct g.member_id) filter (where g.club_day = p_day),
    'isMemberGrantedToday', coalesce(bool_or(g.member_id = p_member_id and g.club_day = p_day), false),
    'isPeriodTaken', coalesce(bool_or(g.member_id = p_member_id and g.period_key = p_period_key), false),
    'grantsAtTableToday', case when p_table_id is not null then count(*) filter (where g.club_day = p_day and g.table_id = p_table_id) end)
  from public.promotion_grant g where g.promotion_id = p_promotion_id;
$$;

-- Gives one version's grant for the event: the grant with its period key (nothing when a race already took it), chips
-- credited as bonus for 7 days (30 for a referral or a sign-up), points credited, and promotion.granted.
create function private.give_promotion_version(p_candidate jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version;
  v_event jsonb := p_candidate -> 'event';
  v_member uuid := (p_candidate #>> '{event,memberId}')::uuid;
  v_chips bigint := (p_candidate ->> 'chips')::bigint;
  v_points bigint := (p_candidate ->> 'points')::bigint;
  v_effect jsonb;
  v_id uuid;
begin
  select * into v_version from public.promotion_version v where v.id = (p_candidate ->> 'version_id')::uuid;
  -- The wheel takes a grant of the old effect `spin`.
  v_effect := case when v_version.reward ->> 'kind' = 'free_spin' then '{"kind": "spin"}'::jsonb else v_version.reward end;
  insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, table_id, trigger, effect, cost_paise, points, chips,
                                      spins, perk, source_key, period_key, club_day)
  values (v_version.venue_id, v_version.promotion_id, v_version.id, v_member, (v_event ->> 'tableId')::uuid, p_candidate ->> 'trigger', v_effect,
          v_chips * 100, v_points, v_chips, (p_candidate ->> 'spins')::integer, p_candidate ->> 'perk', v_event ->> 'key', p_candidate ->> 'period_key',
          private.club_day_of((v_event ->> 'at')::timestamptz))
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  if v_chips > 0 then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_version.venue_id, v_member, v_chips * 100, v_version.name,
                                              now() + make_interval(days => case when v_event ->> 'kind' in ('referral', 'signup') then 30 else 7 end),
                                              'promotion:' || v_id)
    where id = v_id;
  elsif v_points > 0 then
    perform private.credit_points(v_version.venue_id, v_member, v_points, v_version.name, 'promotion:' || v_id);
    update public.promotion_grant set fulfilled_at = now() where id = v_id;
  end if;
  perform private.emit(v_version.venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id,
                                          'member_id', v_member, 'effect', v_effect, 'cost_paise', v_chips * 100, 'points', v_points, 'chips', v_chips,
                                          'spins', (p_candidate ->> 'spins')::integer, 'perk', p_candidate ->> 'perk'),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$$;

-- Weighs the venue's live versions for one event, oldest promotion first, each locked so two cashiers never both take
-- the last of a budget, then gives those promo_stack keeps. An event already weighed gives nothing more.
create function private.evaluate_promotion_versions(p_venue_id uuid, p_trigger text, p_context jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := case p_trigger when 'buy_in' then 'buy_in' when 'hours_played' then 'time_played' when 'check_in' then 'visit'
                                when 'referral' then 'referral' when 'signup' then 'signup' end;
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_member jsonb;
  v_version public.promotion_version;
  v_event jsonb;
  v_grant record;
  v_period text;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate jsonb;
  v_id uuid;
begin
  if v_kind is null or exists (select 1 from public.promotion_grant g where g.venue_id = p_venue_id and g.member_id = v_member_id
                                 and g.source_key = p_context ->> 'key' and g.promotion_version_id is not null) then
    return;
  end if;
  v_member := private.promotion_member_facts(v_member_id);
  for v_version in
    select v.* from public.promotion_version v join public.promotion p on p.id = v.promotion_id
    where v.venue_id = p_venue_id and v.status = 'live' and private.promotion_event_kind(v.reward) = v_kind
    order by p.created_at, p.id
    for update of v
  loop
    v_event := private.promotion_event(v_kind, v_version, p_context);
    continue when not private.promo_is_eligible(
      jsonb_build_object('reward', v_version.reward, 'eligibility', v_version.eligibility, 'schedule', v_version.schedule), v_member, v_event);
    select * into v_grant from private.promo_grant(v_version.reward, v_event);
    continue when v_grant.o_refusal is not null;
    v_period := private.promo_period_key(v_version.limits, p_context ->> 'key', now(), (v_event ->> 'visitId')::uuid);
    continue when private.promo_check_limits(v_version.reward, v_version.limits, jsonb_build_object('chips', v_grant.o_chips),
      private.promotion_tally(v_version.promotion_id, v_member_id, v_period, (v_event ->> 'tableId')::uuid, private.club_day_of(now()))) is not null;
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

-- As 20261020145904_promotions_engine.sql made it, with a sign-up, the old rule path for promotions without versions,
-- and the versions weighed after it.
create or replace function private.evaluate_promotions(p_venue_id uuid, p_trigger text, p_context jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_table_id uuid := (p_context ->> 'table_id')::uuid;
  v_facts jsonb;
  v_promotion public.promotion;
  v_candidate jsonb;
  v_candidates jsonb := '[]'::jsonb;
begin
  if p_trigger is null or p_trigger <> all (array['buy_in', 'hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in',
                                                  'graduation', 'date_window', 'signup'])
     or length(coalesce(p_context ->> 'key', '')) not between 1 and 200 or coalesce((p_context ->> 'amount_paise')::bigint, 0) < 0
     or coalesce((p_context ->> 'points')::bigint, 0) < 0 or coalesce((p_context ->> 'hours_played')::numeric, 0) < 0
     or (p_context ? 'amount_paise') <> (p_context ? 'method') or coalesce(p_context ->> 'method', 'cash') not in ('cash', 'upi', 'wallet', 'bonus')
     or coalesce(p_context ->> 'hand', 'bad_beat') not in ('four_of_a_kind', 'straight_flush', 'royal_flush', 'bad_beat')
     or (v_table_id is not null and not exists (select 1 from public.game_table g where g.id = v_table_id and g.venue_id = p_venue_id)) then
    raise exception 'A trigger, the event''s key, a table of this venue, a known method and hand, and nothing below nothing' using errcode = '22023';
  end if;
  if not exists (select 1 from public.member m where m.id = v_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  begin
    perform private.assert_writable(p_venue_id, 'promotions', v_member_id);
  exception when sqlstate 'RVFRZ' or sqlstate 'RVKIL' or sqlstate 'RVMBR' then
    return;
  end;
  v_facts := private.promotion_facts(v_member_id, v_table_id, now())
             || jsonb_strip_nulls(jsonb_build_object('hours_played', p_context -> 'hours_played', 'hand', p_context -> 'hand'));
  for v_promotion in
    select p.* from public.promotion p
    where p.venue_id = p_venue_id and p.status = 'live' and p.starts_at <= now() and (p.ends_at is null or p.ends_at > now())
      and exists (select 1 from public.promotion_rule r where r.promotion_id = p.id and r.trigger = p_trigger)
      and not exists (select 1 from public.promotion_version x where x.promotion_id = p.id)
    order by p.priority desc, p.created_at, p.id
    for update
  loop
    v_candidate := private.promotion_candidate(v_promotion, p_trigger, v_facts, p_context);
    if v_candidate is not null then
      v_candidates := v_candidates || jsonb_build_array(v_candidate);
    end if;
  end loop;
  for v_candidate in
    select e.c from jsonb_array_elements(v_candidates) with ordinality as e (c, n)
    where e.c ->> 'promotion' = any (private.promotions_to_give(v_candidates)) order by e.n
  loop
    return next private.give_promotion(v_candidate, v_facts, p_context);
  end loop;
  return query select * from private.evaluate_promotion_versions(p_venue_id, p_trigger, p_context);
end;
$$;

-- A sign-up's promotions, once a member's identity is first verified (decision 0472): one verified person, one sign-up
-- bonus, keyed by the member. Not while a practice reset or purge reloads the row.
create function private.signup_promotions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(private.purging(new.venue_id), false) or (tg_op = 'UPDATE' and old.status = 'verified') then
    return null;
  end if;
  perform private.evaluate_promotions(new.venue_id, 'signup', jsonb_build_object('member_id', new.member_id, 'key', 'signup:' || new.member_id));
  return null;
end;
$$;

create trigger kyc_record_signup_promotions
  after insert or update of status on public.kyc_record
  for each row
  when (new.status = 'verified')
  execute function private.signup_promotions();

-- As 20261101170000_spin_capped_by_promotion_budget.sql made it, but a grant of several spins is spun one at a time: it
-- waits until its last is spun.
create or replace function private.spin_the_wheel(p_venue_id uuid, p_grant_id uuid)
returns table (spin_id uuid, kind text, amount bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.promotion_grant;
  v_budget bigint;
  v_promotion_left bigint;
  v_prizes jsonb;
  v_ids uuid[];
  v_odds bigint;
  v_roll bigint;
  v_prize public.spin_wheel;
  v_spin_id uuid;
  v_bonus_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false) then
    raise exception 'Staff who run promotions spin the wheel' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('spin_wheel:' || p_venue_id::text, 0));
  select * into v_grant from public.promotion_grant g
  where g.id = p_grant_id and g.venue_id = p_venue_id and g.effect ->> 'kind' = 'spin' and g.fulfilled_at is null
    and exists (select 1 from public.member m where m.id = g.member_id and m.erased_at is null)
  for update of g;
  if not found then
    raise exception 'No spin waiting for that grant' using errcode = 'P0002';
  end if;
  perform private.assert_writable(p_venue_id, 'promotions', v_grant.member_id);
  select b.cap_paise - coalesce((select sum(g.cost_paise) from public.promotion_grant g where g.promotion_id = b.promotion_id
                                   and (b.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_grant.club_day))), 0)
    into v_promotion_left
  from public.promotion_budget b where b.promotion_id = v_grant.promotion_id;
  v_budget := greatest(least(private.spin_budget_left(p_venue_id), v_promotion_left), 0);
  select jsonb_agg(jsonb_build_object('kind', w.kind, 'amount', w.amount, 'weight', w.weight) order by w.created_at, w.id),
         array_agg(w.id order by w.created_at, w.id),
         coalesce(sum(w.weight) filter (where w.kind <> 'bonus' or w.amount <= v_budget), 0)
    into v_prizes, v_ids, v_odds
  from public.spin_wheel w where w.venue_id = p_venue_id and w.removed_at is null;
  if v_odds = 0 then
    raise exception 'No prize on the wheel the spin budget and the promotion''s budget allow' using errcode = 'RVSPN';
  end if;
  v_roll := ('x' || encode(extensions.gen_random_bytes(6), 'hex'))::bit(48)::bigint % v_odds;
  select * into v_prize from public.spin_wheel w where w.id = v_ids[private.spin_prize(v_prizes, v_budget, v_roll)];
  insert into public.spin (venue_id, grant_id, member_id, prize_id, kind, amount, roll, odds, spun_by_staff_id)
  values (p_venue_id, p_grant_id, v_grant.member_id, v_prize.id, v_prize.kind, v_prize.amount, v_roll, v_odds, private.current_staff_id(p_venue_id))
  returning id into v_spin_id;
  if v_prize.kind = 'points' then
    perform private.credit_points(p_venue_id, v_grant.member_id, v_prize.amount, 'Spin wheel', 'spin:' || v_spin_id);
  elsif v_prize.kind = 'bonus' then
    v_bonus_id := private.credit_bonus(p_venue_id, v_grant.member_id, v_prize.amount, 'Spin wheel', now() + interval '7 days', 'spin:' || v_spin_id);
    update public.spin set bonus_grant_id = v_bonus_id where id = v_spin_id;
  end if;
  -- A bonus won adds to the grant's cost and chips, so the promotion's budget counts it.
  update public.promotion_grant
  set spins_used = spins_used + 1,
      fulfilled_at = case when spins_used + 1 >= greatest(spins, 1) then now() end,
      bonus_grant_id = coalesce(v_bonus_id, bonus_grant_id),
      cost_paise = cost_paise + case when v_prize.kind = 'bonus' then v_prize.amount else 0 end,
      chips = chips + case when v_prize.kind = 'bonus' then v_prize.amount / 100 else 0 end
  where id = p_grant_id;
  return query select v_spin_id, v_prize.kind, v_prize.amount;
end;
$$;

revoke execute on function private.promotion_event_kind(jsonb), private.promotion_member_facts(uuid), private.visit_schedule_time(uuid, jsonb, jsonb),
  private.promotion_event(text, public.promotion_version, jsonb), private.promotion_tally(uuid, uuid, text, uuid, date),
  private.give_promotion_version(jsonb), private.evaluate_promotion_versions(uuid, text, jsonb), private.signup_promotions()
  from public, anon, authenticated;
