-- A spin's bonus counts in its promotion's budget (#583, from #581's review). A spin grant costs nothing when it is
-- given (what it wins comes from the wheel), so a promotion's budget never saw what its spins paid; spin.budget alone
-- capped them. Now a bonus won is the grant's cost, as a bonus promotion's is, so the promotion's cap_paise counts it
-- for the grants after. As 20261028394000_spin_wheel.sql made it, with the grant's cost set.
create or replace function private.spin_the_wheel(p_venue_id uuid, p_grant_id uuid)
returns table (spin_id uuid, kind text, amount bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.promotion_grant;
  v_budget bigint;
  v_prizes jsonb;
  v_ids uuid[];
  v_odds bigint;
  v_roll bigint;
  v_prize public.spin_wheel;
  v_spin_id uuid;
  v_bonus_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'floor.manage'), false) then
    raise exception 'The floor spins the wheel' using errcode = '42501';
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
  v_budget := private.spin_budget_left(p_venue_id);
  select jsonb_agg(jsonb_build_object('kind', w.kind, 'amount', w.amount, 'weight', w.weight) order by w.created_at, w.id),
         array_agg(w.id order by w.created_at, w.id),
         coalesce(sum(w.weight) filter (where w.kind <> 'bonus' or w.amount <= v_budget), 0)
    into v_prizes, v_ids, v_odds
  from public.spin_wheel w where w.venue_id = p_venue_id and w.removed_at is null;
  if v_odds = 0 then
    raise exception 'No prize on the wheel the spin budget allows' using errcode = 'RVSPN';
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
$$;
