-- A reward priced in hotel nights is for a tier with rewards.accommodation (audit 8 Nov, F-046; rule 8): the catalogue shows
-- it only to those tiers, and only they redeem one. A member's hotel-night balance is behind the same feature.

update public.feature set description = 'Hotel nights earned by the hours played, at stakes with an hours-per-night rate, and spending them on rewards.' where key = 'rewards.accommodation';

drop policy "members with the catalogue see their venue's live rewards" on public.reward_item;
create policy "members with the catalogue see their venue's live rewards" on public.reward_item
  for select to authenticated
  using (venue_id = (select private.current_member_venue_id()) and is_live
         and private.has_feature((select private.current_member_id()), 'rewards.catalogue')
         and (nights is null or private.has_feature((select private.current_member_id()), 'rewards.accommodation')));

-- As before (20261028390500_redemptions_follow_the_kill_switch.sql), with the hotel-night check.
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
  if v_item.nights is not null and not private.has_feature(v_member.id, 'rewards.accommodation') then
    raise exception 'Only a member whose tier has hotel nights redeems one' using errcode = '42501';
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
