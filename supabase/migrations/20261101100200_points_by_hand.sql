-- Points by hand (#645; owner's feedback doc of 29 Oct, super admin module 11): no points are worked out (#629), so staff
-- with points.give (super admin, admin, and the Floor and Cashier roles of #644; not marketing, who keeps the catalogue)
-- give a member points as earned or as locked, and release locked points into earned. Nobody gives themselves points.
-- Rewards spend earned points only: a redemption takes from member.points, never from member.points_locked. Each is a
-- ledger transaction against the venue's points issued, once per request id.

insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['points.give']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['points.give']) as permission;

-- The member's locked points account, opened with their first locked points, as hotel nights are (member.nights).
create function private.locked_points_account(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.ledger_account (venue_id, code, name, kind, unit, member_id, is_players_money)
  values (p_venue_id, 'member.points_locked', 'Locked points', 'liability', 'points', p_member_id, false)
  on conflict do nothing;
  select a.id into v_id from public.ledger_account a where a.venue_id = p_venue_id and a.member_id = p_member_id and a.code = 'member.points_locked';
  return v_id;
end;
$$;

-- The member's earned and locked points: what each account holds.
create function private.points_held(p_member_id uuid, out o_earned bigint, out o_locked bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.points'), 0)::bigint,
         coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.points_locked'), 0)::bigint;
$$;

-- The member, with points.give at their venue, checked and locked for the change. Refusals: 42501 not points.give, or the
-- member is the caller; RVNOM no such member, 22023 points not 1 to 1,000,000 or a reason not 3 to 200 characters, RVFRZ/RVMBR frozen.
create function private.points_member(p_member_id uuid, p_points bigint, p_reason text)
returns public.member
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.id is null then
    raise exception 'No such member' using errcode = 'RVNOM';
  end if;
  if not private.has_permission(v_member.venue_id, 'points.give') then
    raise exception 'Only staff who give points give points' using errcode = '42501';
  end if;
  if v_member.user_id is not null and v_member.user_id = (select auth.uid()) then
    raise exception 'Nobody gives themselves points' using errcode = '42501';
  end if;
  if p_points is null or p_points not between 1 and 1000000 or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'Points are 1 to 1,000,000, with a reason of 3 to 200 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  return v_member;
end;
$$;

-- Gives a member points by hand: earned (theirs to spend) or locked (held until unlocked).
create function private.grant_points(p_member_id uuid, p_points bigint, p_is_locked boolean, p_reason text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member := private.points_member(p_member_id, p_points, p_reason);
  -- Earned, locked and unlocked each key their own: one request id is one change.
  v_key text := case when coalesce(p_is_locked, false) then 'points.lock:' else 'points.grant:' end || p_idempotency_key;
  v_txn uuid;
begin
  if p_idempotency_key is null then
    raise exception 'A request id is needed' using errcode = '22023';
  end if;
  if not coalesce(p_is_locked, false) then
    return private.credit_points(v_member.venue_id, v_member.id, p_points, btrim(p_reason), v_key);
  end if;
  v_txn := private.post_ledger_transaction(v_member.venue_id, 'points_locked', v_key,
    jsonb_build_array(
      jsonb_build_object('account_id', private.locked_points_account(v_member.venue_id, v_member.id), 'amount', (-p_points)::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_member.venue_id and a.member_id is null
                                        and a.code = 'venue.points_issued'), 'amount', p_points::text)),
    null, btrim(p_reason));
  perform private.emit(v_member.venue_id, 'points.locked',
                       jsonb_build_object('member_id', v_member.id, 'points', p_points, 'ledger_transaction_id', v_txn), 'points.locked:' || v_txn);
  return v_txn;
end;
$$;

-- Unlocks a member's locked points into earned ones, never more than they hold locked (RVPTS).
create function private.unlock_points(p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member := private.points_member(p_member_id, p_points, p_reason);
  v_key text := 'points.unlock:' || p_idempotency_key;
  v_txn uuid;
begin
  if p_idempotency_key is null then
    raise exception 'A request id is needed' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ledger_transaction t where t.venue_id = v_member.venue_id and t.idempotency_key = v_key)
     and (private.points_held(v_member.id)).o_locked < p_points then
    raise exception 'Not enough locked points: % held, % asked', (private.points_held(v_member.id)).o_locked, p_points using errcode = 'RVPTS';
  end if;
  v_txn := private.post_ledger_transaction(v_member.venue_id, 'points_unlocked', v_key,
    jsonb_build_array(
      jsonb_build_object('account_id', private.locked_points_account(v_member.venue_id, v_member.id), 'amount', p_points::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_member.venue_id and a.member_id = v_member.id
                                        and a.code = 'member.points'), 'amount', (-p_points)::text)),
    null, btrim(p_reason));
  perform private.emit(v_member.venue_id, 'points.released',
                       jsonb_build_object('member_id', v_member.id, 'points', p_points, 'ledger_transaction_id', v_txn), 'points.released:' || v_txn);
  return v_txn;
end;
$$;

-- A member found by their mobile number, with their earned and locked points, for staff who give points.
create function private.member_points(p_venue_id uuid, p_phone text)
returns table (member_id uuid, full_name text, member_number bigint, earned bigint, locked bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, m.member_number, h.o_earned, h.o_locked
  from public.member m cross join lateral private.points_held(m.id) h
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'points.give') and m.erased_at is null
    and m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
$$;

-- The signed-in member's locked points, for Rewards, beside the earned points they spend.
create function private.my_locked_points()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (private.points_held(private.current_member_id())).o_locked;
$$;

create function public.grant_points(p_member_id uuid, p_points bigint, p_is_locked boolean, p_reason text, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.grant_points(p_member_id, p_points, p_is_locked, p_reason, p_idempotency_key); $$;
create function public.unlock_points(p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.unlock_points(p_member_id, p_points, p_reason, p_idempotency_key); $$;
create function public.member_points(p_venue_id uuid, p_phone text)
returns table (member_id uuid, full_name text, member_number bigint, earned bigint, locked bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_points(p_venue_id, p_phone); $$;
create function public.my_locked_points()
returns bigint language sql stable security invoker set search_path = ''
as $$ select private.my_locked_points(); $$;

revoke execute on function private.locked_points_account(uuid, uuid), private.points_held(uuid), private.points_member(uuid, bigint, text)
  from public, anon, authenticated;
revoke execute on function private.grant_points(uuid, bigint, boolean, text, uuid), private.unlock_points(uuid, bigint, text, uuid),
  private.member_points(uuid, text), private.my_locked_points(),
  public.grant_points(uuid, bigint, boolean, text, uuid), public.unlock_points(uuid, bigint, text, uuid),
  public.member_points(uuid, text), public.my_locked_points() from public, anon;
grant execute on function private.grant_points(uuid, bigint, boolean, text, uuid), private.unlock_points(uuid, bigint, text, uuid),
  private.member_points(uuid, text), private.my_locked_points(),
  public.grant_points(uuid, bigint, boolean, text, uuid), public.unlock_points(uuid, bigint, text, uuid),
  public.member_points(uuid, text), public.my_locked_points() to authenticated;
