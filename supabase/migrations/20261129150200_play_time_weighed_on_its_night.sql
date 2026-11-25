-- Play-time Bonus is weighed on its own night (#1134): a step's event is at the time weighed, as a seat's is at the moment
-- they sat, so a visit added or edited after the night meets its own weekday, schedule and limits' period, not today's; and
-- a promotion approved after that time pays nothing for it, as for a seat. The live sweep weighs at now, so a visit still
-- running is weighed as before. A promotion ended since pays nothing, as only live versions are weighed. Generated from the
-- live definitions by gen1134.py, those lines alone changed.
CREATE OR REPLACE FUNCTION private.promotion_event(p_kind text, p_version promotion_version, p_context jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if p_kind = 'seated' then
    -- At the moment they sat; the first of the visit unless an earlier seat of it remains (one undone is gone).
    return v_base || jsonb_build_object('at', least((p_context ->> 'at')::timestamptz, now()),
      'isFirstOfVisit', not exists (select 1 from public.seat_session s where s.visit_id = v_visit and s.member_id = v_member
                                      and s.started_at < (p_context ->> 'at')::timestamptz));
  elsif p_kind = 'time_played' then
    select * into v_time from private.visit_schedule_time(v_visit, p_version.schedule, p_version.eligibility);
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60);
  elsif p_kind = 'hours_step' then
    select * into v_time from private.visit_schedule_time_at(v_visit, p_version.schedule, p_version.eligibility,
                                                             least(coalesce((p_context ->> 'at')::timestamptz, now()), now()));
    -- At the time weighed (#1134): a visit added or edited after the night is weighed on its own night, its weekday and period.
    return v_base || jsonb_build_object('at', least(coalesce((p_context ->> 'at')::timestamptz, now()), now()),
      'minutes', v_time.o_seconds / 60, 'stepMinutes', (p_context ->> 'step_minutes')::integer);
  elsif p_kind = 'visit' then
    return v_base || jsonb_build_object('tableId', null, 'stake', null,
      'visitInMonth', (select count(*) from public.visit v where v.member_id = v_member and v.opened_at <= now()
                         and v.opened_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'));
  end if;
  return v_base || jsonb_build_object('visitId', null, 'tableId', null, 'stake', null);
end;
$function$;

CREATE OR REPLACE FUNCTION private.evaluate_promotion_versions(p_venue_id uuid, p_trigger text, p_context jsonb)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_kind text := case p_trigger when 'hours_played' then 'time_played' when 'check_in' then 'visit'
                                when 'referral' then 'referral' when 'signup' then 'signup' when 'hours_step' then 'hours_step' when 'seated' then 'seated' end;
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
  v_chips bigint;
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
    -- A seat is paid only by terms approved before it was taken: a promotion approved later does not reach back over it.
    continue when p_trigger in ('seated', 'hours_step') and v_version.decided_at > (v_event ->> 'at')::timestamptz;
    continue when not private.promo_is_eligible(
      jsonb_build_object('reward', v_version.reward, 'eligibility', v_version.eligibility, 'schedule', v_version.schedule), v_member, v_event);
    select * into v_grant from private.promo_grant(v_version.reward, v_event);
    continue when v_grant.o_refusal is not null;
    -- The member's grants in the period count against up to N times; the next is keyed as theirs in it (decision 0499).
    -- The event's own moment, so a seat swept after 06:00 counts in the club day it was taken.
    v_base := private.promo_period_key(v_version.limits, p_context ->> 'key', (v_event ->> 'at')::timestamptz, (v_event ->> 'visitId')::uuid, v_step);
    v_tally := private.promotion_tally(v_version.promotion_id, v_member_id, v_base, (v_event ->> 'tableId')::uuid, private.club_day_of((v_event ->> 'at')::timestamptz),
                                       v_version.limits);
    -- A seat bonus in tiers pays its tier's chips (decision 0580).
    v_chips := coalesce(private.promo_tier_chips(v_version.reward, (v_tally ->> 'grantsGiven')::integer), v_grant.o_chips);
    continue when private.promo_check_limits(v_version.reward, v_version.limits, jsonb_build_object('chips', v_chips), v_tally) is not null;
    -- The slot after every grant of the period, refused ones too: periodGiven, which leaves them out, is the limit (decision 0670).
    v_period := private.promo_slot_key(v_base, (v_tally ->> 'periodSlots')::integer);
    -- A step's grant has its visit and place for its source, so the database refuses it a second time in the visit.
    if p_trigger = 'hours_step' then
      v_event := v_event || jsonb_build_object('key', 'hours_step:' || (p_context ->> 'visit_id') || ':@' || v_step);
    end if;
    v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
      'promotion', v_version.promotion_id::text, 'version_id', v_version.id, 'trigger', p_trigger,
      'chips', v_chips, 'perk', v_grant.o_perk, 'period_key', v_period, 'event', v_event));
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
$function$;
