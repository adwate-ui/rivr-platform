-- Accommodation rewards, spending (#146; question #486; decision 0246). A hotel-night reward in the catalogue
-- costs whole nights, taken from the member's nights (kept in thousandths) as other rewards take points from their
-- points. A redemption records the points or the nights it took. Erasure forfeits a member's nights to the venue,
-- as it does their points. A hotel-night reward priced in points before is now one night.

alter table public.reward_item
  add column nights integer check (nights between 1 and 1000),
  alter column points drop not null;
update public.reward_item set nights = 1, points = null where kind = 'hotel_night';
alter table public.reward_item add constraint reward_item_price_check
  check (case when kind = 'hotel_night' then nights is not null and points is null else points is not null and nights is null end);
comment on column public.reward_item.nights is 'A hotel-night reward''s price, in whole nights (#146); every other kind is priced in points.';

alter table public.redemption
  add column nights integer check (nights between 1 and 1000),
  alter column points drop not null,
  add constraint redemption_price_check check ((points is null) <> (nights is null));
comment on column public.redemption.nights is 'The whole nights a hotel-night redemption took (#146); points is null then.';

insert into private.member_export_column (table_name, column_name, kind) values ('redemption', 'nights', 'owed');

-- Takes nights, in thousandths, from a member, never below nothing: a redemption, as debit_points takes points.
create function private.debit_nights(p_venue_id uuid, p_member_id uuid, p_thousandths bigint, p_reason text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
begin
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if p_thousandths is null or p_thousandths < 1 then
    raise exception 'Nights taken are above nothing' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id for update;
  if not found then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if exists (select 1 from public.ledger_transaction t where t.venue_id = p_venue_id and t.idempotency_key = p_idempotency_key) then
    return private.post_nights(p_venue_id, p_member_id, -p_thousandths, 'nights_redeemed', p_reason, p_idempotency_key);
  end if;
  select -private.account_balance(a.id) into v_balance from public.ledger_account a
  where a.venue_id = p_venue_id and a.member_id = p_member_id and a.code = 'member.nights';
  if coalesce(v_balance, 0) < p_thousandths then
    raise exception 'Not enough nights: % thousandths held, % asked', coalesce(v_balance, 0), p_thousandths using errcode = 'RVNGT';
  end if;
  return private.post_nights(p_venue_id, p_member_id, -p_thousandths, 'nights_redeemed', p_reason, p_idempotency_key);
end;
$$;

-- As before (20261026140100_rewards_catalogue.sql), with a hotel-night reward priced in whole nights (p_nights) and
-- every other kind in points (p_points): each price may be left out, so neither is required. Refusals as before;
-- 22023 also for a price in the wrong unit for its kind.
drop function public.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer);
drop function private.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer);
create function private.save_reward_item(p_venue_id uuid, p_kind text, p_name text, p_detail text, p_points bigint default null,
                                         p_is_live boolean default true, p_item_id uuid default null, p_stock integer default null,
                                         p_stock_was integer default null, p_nights integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_item public.reward_item;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'rewards.manage') then
    raise exception 'Only rewards.manage keeps the catalogue' using errcode = '42501';
  end if;
  if coalesce(p_kind, '') not in ('tournament_seat', 'fnb_upgrade', 'merchandise', 'hotel_night')
     or length(btrim(coalesce(p_name, ''))) not between 1 and 80 or length(btrim(coalesce(p_detail, ''))) not between 1 and 200
     or (p_kind = 'hotel_night' and (coalesce(p_nights, 0) not between 1 and 1000 or p_points is not null))
     or (p_kind <> 'hotel_night' and (coalesce(p_points, 0) not between 1 and 10000000 or p_nights is not null))
     or p_stock < 0 or p_is_live is null then
    raise exception 'A kind from the catalogue, a name of 1 to 80 characters, where to collect it, 1 to 1,000 nights for a hotel night or 1 to 1,00,00,000 points for the rest, and a stock of none or more'
      using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  if p_item_id is null then
    insert into public.reward_item (venue_id, kind, name, detail, points, nights, stock, is_live)
    values (p_venue_id, p_kind, btrim(p_name), btrim(p_detail), p_points, p_nights, p_stock, p_is_live)
    returning id into v_id;
    return v_id;
  end if;
  -- Locked as redeem_reward locks it, so a redemption either comes first and is seen, or waits.
  select * into v_item from public.reward_item i where i.id = p_item_id and i.venue_id = p_venue_id for update;
  if v_item.id is null then
    raise exception 'No such reward at this venue' using errcode = '42501';
  end if;
  if v_item.stock is distinct from p_stock_was then
    raise exception 'Members redeemed it meanwhile: % left now', coalesce(v_item.stock::text, 'no limit') using errcode = 'RVCHG';
  end if;
  update public.reward_item
  set kind = p_kind, name = btrim(p_name), detail = btrim(p_detail), points = p_points, nights = p_nights, stock = p_stock, is_live = p_is_live
  where id = v_item.id;
  return v_item.id;
end;
$$;

-- As before (20261026140100_rewards_catalogue.sql), for the price the member was shown: points (p_points), or for a
-- hotel night whole nights (p_nights), taken from their nights. Either price may be left out, so p_points has a default,
-- and so the key after it, which is still required (22023 without one). Refusals as before; RVNGT not enough nights.
drop function public.redeem_reward(uuid, bigint, text);
drop function private.redeem_reward(uuid, bigint, text);
create function private.redeem_reward(p_item_id uuid, p_points bigint default null, p_idempotency_key text default null,
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
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
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

-- As before (20261026140100_rewards_catalogue.sql), with the nights a hotel-night redemption took.
drop function public.venue_redemptions(uuid);
drop function private.venue_redemptions(uuid);
create function private.venue_redemptions(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, reward_name text, kind text, points bigint, nights integer,
               created_at timestamptz, handed_over_at timestamptz, handed_over_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, m.id, m.full_name, m.member_number, i.name, i.kind, r.points, r.nights, r.created_at, r.handed_over_at, s.full_name
  from public.redemption r
  join public.member m on m.id = r.member_id
  join public.reward_item i on i.id = r.reward_item_id
  left join public.staff s on s.id = r.handed_over_by_staff_id
  where r.venue_id = p_venue_id and private.has_permission(p_venue_id, 'rewards.hand_over')
    and (r.handed_over_at is null or r.handed_over_at > now() - interval '30 days')
  order by r.handed_over_at is null desc, case when r.handed_over_at is null then r.created_at end, r.handed_over_at desc
  limit 500;
$$;

-- As before (20261026160000_tv_rewards_and_my_rewards.sql), with the nights a hotel-night redemption took.
drop function public.my_redemptions();
drop function private.my_redemptions();
create function private.my_redemptions()
returns table (id uuid, reward_name text, kind text, detail text, points bigint, nights integer, created_at timestamptz, handed_over_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, i.name, i.kind, i.detail, r.points, r.nights, r.created_at, r.handed_over_at
  from public.redemption r join public.reward_item i on i.id = r.reward_item_id
  where r.member_id = private.current_member_id() and private.has_feature(r.member_id, 'rewards.catalogue')
  order by r.created_at desc
  limit 20;
$$;

create function public.save_reward_item(p_venue_id uuid, p_kind text, p_name text, p_detail text, p_points bigint default null,
                                        p_is_live boolean default true, p_item_id uuid default null, p_stock integer default null,
                                        p_stock_was integer default null, p_nights integer default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_reward_item(p_venue_id, p_kind, p_name, p_detail, p_points, p_is_live, p_item_id, p_stock, p_stock_was, p_nights); $$;
create function public.redeem_reward(p_item_id uuid, p_points bigint default null, p_idempotency_key text default null,
                                     p_nights integer default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.redeem_reward(p_item_id, p_points, p_idempotency_key, p_nights); $$;
create function public.venue_redemptions(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, reward_name text, kind text, points bigint, nights integer,
               created_at timestamptz, handed_over_at timestamptz, handed_over_by text)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_redemptions(p_venue_id); $$;
create function public.my_redemptions()
returns table (id uuid, reward_name text, kind text, detail text, points bigint, nights integer, created_at timestamptz, handed_over_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_redemptions(); $$;

-- As before (20261027130000_member_erasure.sql), forfeiting the member's nights too: to the nights issued, as points
-- go to the points issued, in a transaction of their own (one unit to a transaction).
create or replace function private.forfeit_member_rewards(p_member public.member)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points bigint;
  v_bonus bigint;
  v_nights bigint;
  v_points_txn uuid;
  v_bonus_txn uuid;
  v_nights_txn uuid;
begin
  perform 1 from public.bonus_grant g where g.member_id = p_member.id and g.expired_at is null for update;
  v_points := -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.points'));
  v_bonus := -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'));
  v_nights := coalesce(-private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.nights')), 0);
  if v_points > 0 then
    v_points_txn := private.post_points(p_member.venue_id, p_member.id, -v_points, 'member_erasure_forfeit', 'Forfeited on erasure',
                                        'member_erasure_forfeit:points:' || p_member.id);
  end if;
  if v_bonus > 0 then
    v_bonus_txn := private.post_ledger_transaction(p_member.venue_id, 'member_erasure_forfeit', 'member_erasure_forfeit:bonus:' || p_member.id,
      jsonb_build_array(
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'),
                           'amount', v_bonus::text),
        jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                           where a.venue_id = p_member.venue_id and a.code = 'venue.bonus_expense' and a.member_id is null),
                           'amount', (-v_bonus)::text)),
      null, 'Forfeited on erasure');
  end if;
  if v_nights > 0 then
    v_nights_txn := private.post_nights(p_member.venue_id, p_member.id, -v_nights, 'member_erasure_forfeit', 'Forfeited on erasure',
                                        'member_erasure_forfeit:nights:' || p_member.id);
  end if;
  -- As the expiry job does, a grant with nothing left names no transaction.
  update public.bonus_grant g
  set remaining_paise = 0, expired_at = now(), expiry_transaction_id = case when g.remaining_paise > 0 then v_bonus_txn end
  where g.member_id = p_member.id and g.expired_at is null;
  return jsonb_build_object('points', greatest(v_points, 0), 'bonus_paise', greatest(v_bonus, 0), 'nights_thousandths', greatest(v_nights, 0),
                            'forfeit_transactions', to_jsonb(array_remove(array[v_points_txn, v_bonus_txn, v_nights_txn], null)));
end;
$$;

revoke execute on function private.debit_nights(uuid, uuid, bigint, text, text) from public, anon, authenticated;
revoke execute on function private.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer, integer),
  private.redeem_reward(uuid, bigint, text, integer), private.venue_redemptions(uuid), private.my_redemptions() from public, anon;
grant execute on function private.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer, integer),
  private.redeem_reward(uuid, bigint, text, integer), private.venue_redemptions(uuid), private.my_redemptions() to authenticated;
revoke execute on function public.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer, integer),
  public.redeem_reward(uuid, bigint, text, integer), public.venue_redemptions(uuid), public.my_redemptions() from public, anon;
grant execute on function public.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer, integer),
  public.redeem_reward(uuid, bigint, text, integer), public.venue_redemptions(uuid), public.my_redemptions() to authenticated;

-- reward_item and redemption gained a column without a default: the practice venue's seed is taken again (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
