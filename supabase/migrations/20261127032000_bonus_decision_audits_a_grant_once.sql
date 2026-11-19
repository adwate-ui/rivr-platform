-- A Bonus decision audits each grant once (#1019). An approval changed each grant twice, first to given with its Bonus, then
-- again to point at the decision, so the row audit wrote two lines for every grant besides its Bonus's own line: 151 lines
-- for 50 approved. The decision is now written first and each grant changes once, with it: an approved grant has one line
-- for its change and one for the Bonus it posted, a refused grant one. The decision's own Activity line is unchanged, and so
-- is everything else: who may decide, what is posted and told, a frozen member's Bonus left waiting, the same request
-- answered with its first try.

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
  -- The Bonus this decides, locked; an approval leaves a frozen member's waiting.
  for v_grant in
    select g.id, g.member_id, g.cost_paise
    from public.promotion_grant g
    join public.member m on m.id = g.member_id and m.erased_at is null
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
    end if;
    v_ids := v_ids || v_grant.id;
    v_members := v_members || v_grant.member_id;
    v_total := v_total + v_grant.cost_paise;
  end loop;
  if cardinality(v_ids) = 0 then
    return query select null::uuid, 0, 0::bigint, v_left;
    return;
  end if;
  -- The decision first, so each grant changes once, with it (#1019).
  insert into public.promotion_bonus_decision (venue_id, request_id, decision, grants, amount_paise, reason, decided_by_staff_id, left_waiting)
  values (p_venue_id, p_request_id, p_decision, cardinality(v_ids), v_total, btrim(p_reason), private.current_staff_id(p_venue_id), v_left)
  returning id into v_id;
  if p_decision = 'refused' then
    update public.promotion_grant set status = 'refused', decision_id = v_id where id = any (v_ids);
  else
    for v_grant in
      select g.id, g.member_id, g.cost_paise, coalesce(v.name, p.name) as name, g.promotion_id, g.promotion_version_id, g.effect, g.chips, g.perk
      from public.promotion_grant g
      join public.promotion p on p.id = g.promotion_id
      left join public.promotion_version v on v.id = g.promotion_version_id
      where g.id = any (v_ids)
      order by g.created_at, g.id
    loop
      v_bonus := private.credit_bonus(p_venue_id, v_grant.member_id, v_grant.cost_paise, v_grant.name, null, 'promotion:' || v_grant.id);
      update public.promotion_grant set status = 'given', bonus_grant_id = v_bonus, fulfilled_at = now(), decision_id = v_id where id = v_grant.id;
      -- Given now, so told of now (#1019), as a grant given at once is.
      perform private.emit(p_venue_id, 'promotion.granted',
                           jsonb_build_object('promotion_grant_id', v_grant.id, 'promotion_id', v_grant.promotion_id,
                                              'promotion_version_id', v_grant.promotion_version_id, 'member_id', v_grant.member_id,
                                              'effect', v_grant.effect, 'cost_paise', v_grant.cost_paise, 'chips', v_grant.chips,
                                              'perk', v_grant.perk, 'status', 'given'),
                           'promotion.granted:' || v_grant.id);
    end loop;
  end if;
  -- Activity names the member when the decision is one member's, and how many otherwise.
  perform private.audit(p_venue_id, case p_decision when 'approved' then 'bonus.approve' else 'bonus.refuse' end, 'promotion_bonus_decision',
                        v_id::text, null,
                        jsonb_build_object('grants', cardinality(v_ids), 'chips', v_total / 100, 'amount_paise', v_total)
                        || case when (select count(distinct x) from unnest(v_members) x) = 1 then jsonb_build_object('member_id', v_members[1]) else '{}'::jsonb end,
                        btrim(p_reason));
  return query select v_id, cardinality(v_ids), v_total, v_left;
end;
$function$;
