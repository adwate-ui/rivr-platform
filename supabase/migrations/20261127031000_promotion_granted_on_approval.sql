-- promotion.granted tells of what a promotion gave (#1019). Since a promotion's Bonus waits for a super admin (decision 0670) it
-- was emitted when the Bonus was calculated, while it waited, so a consumer would have counted a Bonus later refused. Now it is
-- emitted when a grant is given: at once for a perk and the high hand's Bonus, and on approval for a Bonus that waited. A
-- refusal emits nothing: the member is told nothing, and the decision and its Activity line keep it. No consumer reads the
-- event yet. The events already written for a Bonus that waits or was refused, which no consumer was handed, go: an approval
-- writes its own, under the same key.

delete from public.outbox_event e
using public.promotion_grant g
where e.event_type = 'promotion.granted' and e.venue_id = g.venue_id and e.idempotency_key = 'promotion.granted:' || g.id
  and g.status in ('waiting', 'refused')
  and not exists (select 1 from public.outbox_delivery d where d.event_id = e.id);

CREATE OR REPLACE FUNCTION private.give_promotion_version(p_candidate jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_version public.promotion_version;
  v_event jsonb := p_candidate -> 'event';
  v_member uuid := (p_candidate #>> '{event,memberId}')::uuid;
  v_chips bigint := (p_candidate ->> 'chips')::bigint;
  -- A Bonus waits for a super admin (decision 0670), but for the high hand's, paid at once: the floor's log is its check.
  v_waits boolean := (p_candidate ->> 'chips')::bigint > 0 and p_candidate ->> 'trigger' is distinct from 'high_hand';
  v_id uuid;
begin
  select * into v_version from public.promotion_version v where v.id = (p_candidate ->> 'version_id')::uuid;
  insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, table_id, trigger, effect, cost_paise, chips,
                                      perk, source_key, period_key, club_day, status, event)
  values (v_version.venue_id, v_version.promotion_id, v_version.id, v_member, (v_event ->> 'tableId')::uuid, p_candidate ->> 'trigger', v_version.reward,
          v_chips * 100, v_chips, p_candidate ->> 'perk', v_event ->> 'key', p_candidate ->> 'period_key',
          private.club_day_of((v_event ->> 'at')::timestamptz), case when v_waits then 'waiting' else 'given' end, v_event)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  if v_chips > 0 and not v_waits then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_version.venue_id, v_member, v_chips * 100, v_version.name, null, 'promotion:' || v_id)
    where id = v_id;
  end if;
  -- A Bonus that waits is told of when approved (decide_promotion_bonus), never while it waits (#1019).
  if not v_waits then
    perform private.emit(v_version.venue_id, 'promotion.granted',
                         jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id,
                                            'member_id', v_member, 'effect', v_version.reward, 'cost_paise', v_chips * 100, 'chips', v_chips,
                                            'perk', p_candidate ->> 'perk', 'status', 'given'),
                         'promotion.granted:' || v_id);
  end if;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.give_promotion(p_candidate jsonb, p_facts jsonb, p_context jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue_id uuid := (p_candidate ->> 'venue_id')::uuid;
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_effect jsonb := p_candidate -> 'effect';
  v_id uuid;
begin
  insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, table_id, trigger, effect, cost_paise,
                                      source_key, club_day, status, event)
  values (v_venue_id, (p_candidate ->> 'promotion')::uuid, (p_candidate ->> 'rule')::uuid, v_member_id, (p_facts ->> 'table_id')::uuid,
          p_candidate ->> 'trigger', v_effect, (p_candidate ->> 'cost_paise')::bigint, p_context ->> 'key',
          (p_facts ->> 'club_day')::date, case when v_effect ->> 'kind' = 'bonus' then 'waiting' else 'given' end,
          jsonb_build_object('kind', p_candidate ->> 'trigger', 'key', p_context ->> 'key', 'at', now(), 'tableId', p_facts ->> 'table_id'))
  returning id into v_id;
  -- A Bonus waits, and is told of when approved (#1019).
  if v_effect ->> 'kind' is distinct from 'bonus' then
    perform private.emit(v_venue_id, 'promotion.granted',
                         jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', p_candidate ->> 'promotion', 'member_id', v_member_id,
                                            'effect', v_effect, 'cost_paise', (p_candidate ->> 'cost_paise')::bigint),
                         'promotion.granted:' || v_id);
  end if;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.decide_promotion_bonus(p_venue_id uuid, p_grant_ids uuid[], p_decision text, p_reason text, p_request_id uuid)
 RETURNS TABLE(decision_id uuid, grants integer, amount_paise bigint, left_waiting integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_done public.promotion_bonus_decision;
  v_grant record;
  v_ids uuid[] := '{}'::uuid[];
  v_members uuid[] := '{}'::uuid[];
  v_total bigint := 0;
  v_left integer := 0;
  v_bonus uuid;
  v_id uuid;
begin
  if not coalesce(private.is_super_admin(p_venue_id), false) then
    raise exception 'Only a super admin approves or refuses Bonus from a promotion' using errcode = '42501';
  end if;
  if p_request_id is null or p_decision is null or p_decision not in ('approved', 'refused')
     or coalesce(cardinality(p_grant_ids), 0) not between 1 and 500
     or (p_decision = 'refused') <> (p_reason is not null) or length(btrim(coalesce(p_reason, 'none'))) not between 3 and 200 then
    raise exception 'One to 500 Bonus, a reason of 3 to 200 characters to refuse, and a request id' using errcode = '22023';
  end if;
  -- The same request waits for its first try, then is answered with it.
  perform pg_advisory_xact_lock(hashtextextended('promotion_bonus:' || p_venue_id::text || ':' || p_request_id::text, 0));
  select * into v_done from public.promotion_bonus_decision d where d.venue_id = p_venue_id and d.request_id = p_request_id;
  if v_done.id is not null then
    if v_done.decision <> p_decision then
      raise exception 'That request id was used for another decision' using errcode = '22023';
    end if;
    return query select v_done.id, v_done.grants, v_done.amount_paise, v_done.left_waiting;
    return;
  end if;
  if exists (select 1 from public.promotion_grant g
             where g.id = any (p_grant_ids) and g.venue_id = p_venue_id and g.status = 'waiting'
               and (private.is_own_cage_record(g.member_id) or coalesce(private.is_own_kyc_check(g.member_id), false))) then
    raise exception 'Nobody approves or refuses a Bonus for their own record' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  for v_grant in
    select g.id, g.member_id, g.cost_paise, coalesce(v.name, p.name) as name, g.promotion_id, g.promotion_version_id, g.effect, g.chips, g.perk
    from public.promotion_grant g
    join public.member m on m.id = g.member_id and m.erased_at is null
    join public.promotion p on p.id = g.promotion_id
    left join public.promotion_version v on v.id = g.promotion_version_id
    where g.id = any (p_grant_ids) and g.venue_id = p_venue_id and g.status = 'waiting'
    order by g.created_at, g.id
    for update of g
  loop
    if p_decision = 'approved' then
      begin
        perform private.assert_writable(p_venue_id, 'promotions', v_grant.member_id);
      exception when sqlstate 'RVMBR' then
        v_left := v_left + 1;
        continue;
      end;
      v_bonus := private.credit_bonus(p_venue_id, v_grant.member_id, v_grant.cost_paise, v_grant.name, null, 'promotion:' || v_grant.id);
      update public.promotion_grant set status = 'given', bonus_grant_id = v_bonus, fulfilled_at = now() where id = v_grant.id;
      -- Given now, so told of now (#1019), as a grant given at once is.
      perform private.emit(p_venue_id, 'promotion.granted',
                           jsonb_build_object('promotion_grant_id', v_grant.id, 'promotion_id', v_grant.promotion_id,
                                              'promotion_version_id', v_grant.promotion_version_id, 'member_id', v_grant.member_id,
                                              'effect', v_grant.effect, 'cost_paise', v_grant.cost_paise, 'chips', v_grant.chips,
                                              'perk', v_grant.perk, 'status', 'given'),
                           'promotion.granted:' || v_grant.id);
    else
      update public.promotion_grant set status = 'refused' where id = v_grant.id;
    end if;
    v_ids := v_ids || v_grant.id;
    v_members := v_members || v_grant.member_id;
    v_total := v_total + v_grant.cost_paise;
  end loop;
  if cardinality(v_ids) = 0 then
    return query select null::uuid, 0, 0::bigint, v_left;
    return;
  end if;
  insert into public.promotion_bonus_decision (venue_id, request_id, decision, grants, amount_paise, reason, decided_by_staff_id, left_waiting)
  values (p_venue_id, p_request_id, p_decision, cardinality(v_ids), v_total, btrim(p_reason), private.current_staff_id(p_venue_id), v_left)
  returning id into v_id;
  update public.promotion_grant set decision_id = v_id where id = any (v_ids);
  -- Activity names the member when the decision is one member's, and how many otherwise.
  perform private.audit(p_venue_id, case p_decision when 'approved' then 'bonus.approve' else 'bonus.refuse' end, 'promotion_bonus_decision',
                        v_id::text, null,
                        jsonb_build_object('grants', cardinality(v_ids), 'chips', v_total / 100, 'amount_paise', v_total)
                        || case when (select count(distinct x) from unnest(v_members) x) = 1 then jsonb_build_object('member_id', v_members[1]) else '{}'::jsonb end,
                        btrim(p_reason));
  return query select v_id, cardinality(v_ids), v_total, v_left;
end;
$function$;
