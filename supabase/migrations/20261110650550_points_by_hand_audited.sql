-- Points by hand go in the audit log, as bonus chips by hand do, so Activity shows who gave what to whom (8 Nov audit, I-75, F-034).
-- Until now the ledger alone kept them. As 20261104330000_points_daily_cap.sql and 20261101100200_points_by_hand.sql, each with its audit
-- row after the posting; a repeat of the same request id, which posts nothing, writes none.

create or replace function private.grant_points(p_member_id uuid, p_points bigint, p_is_locked boolean, p_reason text, p_idempotency_key uuid)
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
  v_cap bigint;
  v_staff uuid;
begin
  if p_idempotency_key is null then
    raise exception 'A request id is needed' using errcode = '22023';
  end if;
  select t.id into v_txn from public.ledger_transaction t where t.venue_id = v_member.venue_id and t.idempotency_key = v_key;
  if v_txn is not null then return v_txn; end if;
  v_cap := (private.setting_at(v_member.venue_id, 'points.daily_staff_cap', '', now()) ->> 'points')::bigint;
  if v_cap is not null and not private.is_super_admin(v_member.venue_id) then
    -- One staff member's changes wait for each other, so two at once, to different members, cannot both fit under the cap.
    perform pg_advisory_xact_lock(hashtextextended('points.daily_cap:' || v_member.venue_id::text || ':' || (select auth.uid())::text, 0));
    if private.points_given_tonight(v_member.venue_id, (select auth.uid())) + p_points > v_cap then
      v_staff := private.current_staff_id(v_member.venue_id);
      if not exists (select 1 from public.alert a where a.venue_id = v_member.venue_id and a.kind = 'points.daily_cap'
                     and a.detail ->> 'staff_id' = v_staff::text and a.created_at >= private.tonight_began(now())) then
        perform private.raise_alert(v_member.venue_id, 'points.daily_cap', jsonb_build_object('staff_id', v_staff, 'cap', v_cap));
      end if;
      return null;
    end if;
  end if;
  if not coalesce(p_is_locked, false) then
    v_txn := private.credit_points(v_member.venue_id, v_member.id, p_points, btrim(p_reason), v_key);
    perform private.audit(v_member.venue_id, 'points.grant', 'member', v_member.id::text, null,
                          jsonb_build_object('points', p_points, 'ledger_transaction_id', v_txn), btrim(p_reason));
    return v_txn;
  end if;
  v_txn := private.post_ledger_transaction(v_member.venue_id, 'points_locked', v_key,
    jsonb_build_array(
      jsonb_build_object('account_id', private.locked_points_account(v_member.venue_id, v_member.id), 'amount', (-p_points)::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_member.venue_id and a.member_id is null
                                        and a.code = 'venue.points_issued'), 'amount', p_points::text)),
    null, btrim(p_reason));
  perform private.emit(v_member.venue_id, 'points.locked',
                       jsonb_build_object('member_id', v_member.id, 'points', p_points, 'ledger_transaction_id', v_txn), 'points.locked:' || v_txn);
  perform private.audit(v_member.venue_id, 'points.lock', 'member', v_member.id::text, null,
                        jsonb_build_object('points', p_points, 'ledger_transaction_id', v_txn), btrim(p_reason));
  return v_txn;
end;
$$;

create or replace function private.unlock_points(p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member := private.points_member(p_member_id, p_points, p_reason);
  v_key text := 'points.unlock:' || p_idempotency_key;
  v_txn uuid;
  v_is_retry boolean;
begin
  if p_idempotency_key is null then
    raise exception 'A request id is needed' using errcode = '22023';
  end if;
  v_is_retry := exists (select 1 from public.ledger_transaction t where t.venue_id = v_member.venue_id and t.idempotency_key = v_key);
  if not v_is_retry and (private.points_held(v_member.id)).o_locked < p_points then
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
  if not v_is_retry then
    perform private.audit(v_member.venue_id, 'points.unlock', 'member', v_member.id::text, null,
                          jsonb_build_object('points', p_points, 'ledger_transaction_id', v_txn), btrim(p_reason));
  end if;
  return v_txn;
end;
$$;
