-- Rewards redemptions follow the kill switch (#462): with redemptions switched off, no member redeems and no desk hands
-- a reward over (RVKIL), as withdrawals and credit stop. And pot data (#152) is a super admin's alone, in the database
-- as in @rivr/contracts' SUPER_ADMIN_ONLY: only super_admin has ever held pot_data.read.

-- As before (20261028380200_hotel_nights_catalogue.sql), with the redemptions switch.
create or replace function private.redeem_reward(p_item_id uuid, p_points bigint default null, p_idempotency_key text default null,
                                      p_nights integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_item public.reward_item;
  v_done public.redemption;
  v_key text;
  v_txn uuid;
  v_id uuid;
begin
  -- One redemption at a time per member, so a key sent twice at once redeems once.
  select * into v_member from public.member m where m.id = (select private.current_member_id()) for update;
  if v_member.id is null or not private.has_feature(v_member.id, 'rewards.catalogue') then
    raise exception 'Only a member whose tier has the catalogue redeems a reward' using errcode = '42501';
  end if;
  if length(coalesce(p_idempotency_key, '')) not between 1 and 200 then
    raise exception 'A redemption carries a key of 1 to 200 characters' using errcode = '22023';
  end if;
  select * into v_done from public.redemption r where r.member_id = v_member.id and r.idempotency_key = p_idempotency_key;
  if v_done.id is not null then
    if v_done.reward_item_id is distinct from p_item_id then
      raise exception 'That key redeemed another reward' using errcode = '22023';
    end if;
    return v_done.id;
  end if;
  perform private.assert_writable(v_member.venue_id, 'redemptions', v_member.id);
  select * into v_item from public.reward_item i where i.id = p_item_id and i.venue_id = v_member.venue_id for update;
  if v_item.id is null or not v_item.is_live or v_item.stock = 0 then
    raise exception 'That reward is not on offer, or none are left' using errcode = 'RVRWD';
  end if;
  if v_item.points is distinct from p_points or v_item.nights is distinct from p_nights then
    raise exception 'The price changed: % now', coalesce(v_item.points || ' points', v_item.nights || ' nights') using errcode = 'RVPRC';
  end if;
  v_key := 'redemption:' || v_member.id || ':' || p_idempotency_key;
  v_txn := case when v_item.nights is null
                then private.debit_points(v_member.venue_id, v_member.id, v_item.points, 'Redeemed: ' || v_item.name, v_key)
                else private.debit_nights(v_member.venue_id, v_member.id, v_item.nights * 1000, 'Redeemed: ' || v_item.name, v_key) end;
  update public.reward_item set stock = stock - 1 where id = v_item.id and stock is not null;
  insert into public.redemption (venue_id, member_id, reward_item_id, points, nights, idempotency_key, ledger_transaction_id)
  values (v_member.venue_id, v_member.id, v_item.id, v_item.points, v_item.nights, p_idempotency_key, v_txn)
  returning id into v_id;
  perform private.emit(v_member.venue_id, 'reward.redeemed',
                       jsonb_strip_nulls(jsonb_build_object('redemption_id', v_id, 'member_id', v_member.id, 'reward_item_id', v_item.id,
                                                            'points', v_item.points, 'nights', v_item.nights)),
                       'reward.redeemed:' || v_id);
  return v_id;
end;
$$;

-- As before (20261026140100_rewards_catalogue.sql), with the redemptions switch.
create or replace function private.hand_over_redemption(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redemption public.redemption;
begin
  select * into v_redemption from public.redemption r where r.id = p_redemption_id for update;
  if v_redemption.id is null or not private.has_permission(v_redemption.venue_id, 'rewards.hand_over') then
    raise exception 'Only rewards.hand_over hands over a redemption' using errcode = '42501';
  end if;
  if v_redemption.handed_over_at is not null then
    raise exception 'That redemption was handed over already' using errcode = 'RVHND';
  end if;
  perform private.assert_writable(v_redemption.venue_id, 'redemptions', v_redemption.member_id);
  update public.redemption set handed_over_at = now(), handed_over_by_staff_id = private.current_staff_id(v_redemption.venue_id)
  where id = v_redemption.id;
end;
$$;

alter table public.role_permission drop constraint super_admin_only_permissions;
alter table public.role_permission add constraint super_admin_only_permissions check (
  role = 'super_admin'
  or permission not in ('purge.run', 'exports.full', 'control.engage', 'members.override_features', 'venue.configure', 'shareholding.manage',
                        'members.erase', 'promotions.approve', 'members.change_phone', 'pot_data.read')
);
