-- A spin's bonus is capped by its promotion's budget (audit of 28 Oct, A2-03). A spin grant costs nothing when it is
-- given, so many grants pass the promotion's cap_paise check, and each spin after could still win a bonus limited only
-- by the venue's monthly spin.budget: 20 spins waiting at ₹1,000 paid ₹20,000 against a ₹5,000 cap. Now a spin draws a
-- bonus only within the smaller of what is left of spin.budget and of its promotion's own budget; points and nothing
-- stay on the wheel. As 20261101100700_spin_wheel_is_a_bonus.sql made it, with that cap. spin_prizes and tv_spin_wheel
-- still show the venue's wheel against spin.budget alone, as they are read with no grant in hand, so a bonus they show
-- can be refused (RVSPN) for a spin whose promotion has spent its budget.
create or replace function private.spin_the_wheel(p_venue_id uuid, p_grant_id uuid)
 RETURNS TABLE(spin_id uuid, kind text, amount bigint)
 language plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- What is left of the promotion's own budget, as the engine counts it (20261028391800): its cap less what its grants
  -- cost, in the whole promotion or the grant's month. None for a promotion with no cap, which least() passes over.
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
  update public.promotion_grant
  set fulfilled_at = now(), bonus_grant_id = coalesce(v_bonus_id, bonus_grant_id),
      cost_paise = case when v_prize.kind = 'bonus' then v_prize.amount else cost_paise end
  where id = p_grant_id;
  return query select v_spin_id, v_prize.kind, v_prize.amount;
end;
$function$

;
