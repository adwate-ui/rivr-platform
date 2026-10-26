-- The rewards catalogue and redemption (#145; scope-v1 module 9; design prompt "Rewards"; decision
-- 0181). Points buy what the club offers: a tournament seat, an F&B upgrade, RIVR merchandise and
-- partner hotel nights. Marketing and admins keep the catalogue (rewards.manage): each item's kind,
-- name, where to collect it, its points and, if limited, how many are left. A member whose tier has
-- rewards.catalogue redeems one: the points leave their ledger through private.debit_points, once per
-- idempotency key, never below nothing, and the redemption waits until the host desk, the cage or an
-- admin (rewards.hand_over) hands it over. Points never convert to cash, so nothing in the catalogue
-- pays out money.

insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array['rewards.manage', 'rewards.hand_over']) as permission;

insert into public.role_permission (role, permission)
select 'admin', permission
from unnest(array['rewards.manage', 'rewards.hand_over']) as permission;

insert into public.role_permission (role, permission)
select 'marketing', permission
from unnest(array['rewards.manage']) as permission;

insert into public.role_permission (role, permission)
select 'cashier', permission
from unnest(array['rewards.hand_over']) as permission;

insert into public.role_permission (role, permission)
select 'host', permission
from unnest(array['rewards.hand_over']) as permission;

create table public.reward_item (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  kind text not null check (kind in ('tournament_seat', 'fnb_upgrade', 'merchandise', 'hotel_night')),
  name text not null check (length(btrim(name)) between 1 and 80),
  -- Where and how the member collects it: "At the host desk".
  detail text not null check (length(btrim(detail)) between 1 and 200),
  points bigint not null check (points between 1 and 10000000),
  -- How many are left to redeem; null for as many as members like.
  stock integer check (stock >= 0),
  is_live boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id)
);

comment on table public.reward_item is 'What members may redeem points for (#145): a tournament seat, an F&B upgrade, merchandise or hotel nights.';

create index reward_item_venue_idx on public.reward_item (venue_id, is_live);
create trigger reward_item_touch_updated_at before update on public.reward_item
  for each row execute function private.touch_updated_at();
create trigger reward_item_audit after insert or update or delete on public.reward_item
  for each row execute function private.audit_row_change();
alter table public.reward_item enable row level security;
grant select on public.reward_item to authenticated;

create policy "members with the catalogue see their venue's live rewards" on public.reward_item
  for select to authenticated
  using (venue_id = (select private.current_member_venue_id()) and is_live
         and private.has_feature((select private.current_member_id()), 'rewards.catalogue'));
create policy "reward staff see the venue's catalogue" on public.reward_item
  for select to authenticated
  using (venue_id in (select private.venues_where('rewards.manage')) or venue_id in (select private.venues_where('rewards.hand_over')));

create table public.redemption (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  reward_item_id uuid not null,
  -- The points it took, as the item was priced when redeemed.
  points bigint not null check (points > 0),
  -- The member's own key for this redemption: the same key again gives the same redemption.
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  ledger_transaction_id uuid not null unique references public.ledger_transaction (id),
  handed_over_at timestamptz,
  handed_over_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, idempotency_key),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (reward_item_id, venue_id) references public.reward_item (id, venue_id),
  foreign key (handed_over_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((handed_over_at is null) = (handed_over_by_staff_id is null))
);

comment on table public.redemption is 'A member''s redemption of points for a reward (#145), waiting until it is handed over.';

create index redemption_venue_waiting_idx on public.redemption (venue_id, created_at) where handed_over_at is null;
create index redemption_venue_created_idx on public.redemption (venue_id, created_at);
create index redemption_item_venue_idx on public.redemption (reward_item_id, venue_id);
create index redemption_member_venue_idx on public.redemption (member_id, venue_id);
create index redemption_staff_venue_idx on public.redemption (handed_over_by_staff_id, venue_id);
create trigger redemption_touch_updated_at before update on public.redemption
  for each row execute function private.touch_updated_at();
create trigger redemption_audit after insert or update or delete on public.redemption
  for each row execute function private.audit_row_change();
alter table public.redemption enable row level security;
grant select on public.redemption to authenticated;

create policy "members with the catalogue see their own redemptions" on public.redemption
  for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature(member_id, 'rewards.catalogue'));
create policy "reward staff see the venue's redemptions" on public.redemption
  for select to authenticated
  using (venue_id in (select private.venues_where('rewards.manage')) or venue_id in (select private.venues_where('rewards.hand_over')));

-- Adds a reward to the catalogue (no item given) or changes one, for rewards.manage; no stock is no
-- limit. A change carries the stock the editor saw (p_stock_was), so a redemption made meanwhile is
-- never written over. Refusals: 42501 not rewards.manage or not this venue's item, 22023 a kind not in
-- the catalogue or a name, detail, points or stock out of bounds, RVCHG the stock changed since the
-- editor saw it, RVFRZ the venue frozen.
create function private.save_reward_item(p_venue_id uuid, p_kind text, p_name text, p_detail text, p_points bigint, p_is_live boolean,
                                         p_item_id uuid default null, p_stock integer default null, p_stock_was integer default null)
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
     or coalesce(p_points, 0) not between 1 and 10000000 or p_stock < 0 or p_is_live is null then
    raise exception 'A kind from the catalogue, a name of 1 to 80 characters, where to collect it, 1 to 1,00,00,000 points and a stock of none or more'
      using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  if p_item_id is null then
    insert into public.reward_item (venue_id, kind, name, detail, points, stock, is_live)
    values (p_venue_id, p_kind, btrim(p_name), btrim(p_detail), p_points, p_stock, p_is_live)
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
  set kind = p_kind, name = btrim(p_name), detail = btrim(p_detail), points = p_points, stock = p_stock, is_live = p_is_live
  where id = v_item.id;
  return v_item.id;
end;
$$;

-- The signed-in member redeems a reward for the points they were shown (p_points), once per key of
-- theirs: the same key again gives the same redemption and takes nothing more. Refusals: 42501 not a
-- member, or their tier has no rewards.catalogue; 22023 no key, or a key that redeemed another reward;
-- RVRWD a reward not on offer at their venue, or none left; RVPRC its price changed since they saw it;
-- RVPTS not enough points; RVFRZ/RVMBR the venue or the member frozen.
create function private.redeem_reward(p_item_id uuid, p_points bigint, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_item public.reward_item;
  v_done public.redemption;
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
  if v_item.points is distinct from p_points then
    raise exception 'The price changed: % points now', v_item.points using errcode = 'RVPRC';
  end if;
  v_txn := private.debit_points(v_member.venue_id, v_member.id, v_item.points, 'Redeemed: ' || v_item.name,
                                'redemption:' || v_member.id || ':' || p_idempotency_key);
  update public.reward_item set stock = stock - 1 where id = v_item.id and stock is not null;
  insert into public.redemption (venue_id, member_id, reward_item_id, points, idempotency_key, ledger_transaction_id)
  values (v_member.venue_id, v_member.id, v_item.id, v_item.points, p_idempotency_key, v_txn)
  returning id into v_id;
  perform private.emit(v_member.venue_id, 'reward.redeemed',
                       jsonb_build_object('redemption_id', v_id, 'member_id', v_member.id, 'reward_item_id', v_item.id, 'points', v_item.points),
                       'reward.redeemed:' || v_id);
  return v_id;
end;
$$;

-- The venue's redemptions for the staff who hand them over (rewards.hand_over, who all read members):
-- those waiting first, oldest first, then those handed over in the last 30 days, newest first.
create function private.venue_redemptions(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, reward_name text, kind text, points bigint,
               created_at timestamptz, handed_over_at timestamptz, handed_over_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, m.id, m.full_name, m.member_number, i.name, i.kind, r.points, r.created_at, r.handed_over_at, s.full_name
  from public.redemption r
  join public.member m on m.id = r.member_id
  join public.reward_item i on i.id = r.reward_item_id
  left join public.staff s on s.id = r.handed_over_by_staff_id
  where r.venue_id = p_venue_id and private.has_permission(p_venue_id, 'rewards.hand_over')
    and (r.handed_over_at is null or r.handed_over_at > now() - interval '30 days')
  order by r.handed_over_at is null desc, case when r.handed_over_at is null then r.created_at end, r.handed_over_at desc
  limit 500;
$$;

-- Staff hand a member what they redeemed. Refusals: 42501 not rewards.hand_over at the redemption's
-- venue, RVHND handed over already, RVFRZ the venue frozen.
create function private.hand_over_redemption(p_redemption_id uuid)
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
  perform private.assert_writable(v_redemption.venue_id);
  update public.redemption set handed_over_at = now(), handed_over_by_staff_id = private.current_staff_id(v_redemption.venue_id)
  where id = v_redemption.id;
end;
$$;

create function public.save_reward_item(p_venue_id uuid, p_kind text, p_name text, p_detail text, p_points bigint, p_is_live boolean,
                                        p_item_id uuid default null, p_stock integer default null, p_stock_was integer default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_reward_item(p_venue_id, p_kind, p_name, p_detail, p_points, p_is_live, p_item_id, p_stock, p_stock_was); $$;
create function public.redeem_reward(p_item_id uuid, p_points bigint, p_idempotency_key text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.redeem_reward(p_item_id, p_points, p_idempotency_key); $$;
create function public.venue_redemptions(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, reward_name text, kind text, points bigint,
               created_at timestamptz, handed_over_at timestamptz, handed_over_by text)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_redemptions(p_venue_id); $$;
create function public.hand_over_redemption(p_redemption_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.hand_over_redemption(p_redemption_id); $$;

revoke execute on function private.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer), private.redeem_reward(uuid, bigint, text),
  private.venue_redemptions(uuid), private.hand_over_redemption(uuid) from public, anon;
grant execute on function private.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer), private.redeem_reward(uuid, bigint, text),
  private.venue_redemptions(uuid), private.hand_over_redemption(uuid) to authenticated;
revoke execute on function public.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer), public.redeem_reward(uuid, bigint, text),
  public.venue_redemptions(uuid), public.hand_over_redemption(uuid) from public, anon;
grant execute on function public.save_reward_item(uuid, text, text, text, bigint, boolean, uuid, integer, integer), public.redeem_reward(uuid, bigint, text),
  public.venue_redemptions(uuid), public.hand_over_redemption(uuid) to authenticated;
