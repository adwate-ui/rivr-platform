-- A daily cap on points given by hand (#798; the owner, 3 Nov, answering #657): each staff member who gives points gives at
-- most the club's points.daily_staff_cap in a club day, earned and locked together. A change past it is refused, and the
-- owner hears that someone tried, once a staff member a night. Super admins are not capped: they set the cap. None set is no
-- cap. Unlocking points gives none new, so it is not counted; League points are never spent, so they are not either.
--
-- A refusal with an error would take its alert back with it, so grant_points answers a refused change with no transaction
-- (null) and keeps the alert; the console shows the daily limit. A retry of a change that went through is answered with it,
-- before the cap is counted, so a lost answer never turns into a refusal.

insert into public.setting_key (key, description, scope, value_schema) values
  ('points.daily_staff_cap',
   'The most points one staff member gives by hand in a club day, earned and locked together; a change past it is refused and the owner hears of it. Super admins are not capped. None set is no cap.',
   'venue',
   '{"type":"object","properties":{"points":{"type":"integer","minimum":1,"maximum":1000000}},"required":["points"],"additionalProperties":false}');

-- The points a person gave by hand at the venue since the club day began: earned and locked, as the club's points issued.
create function private.points_given_tonight(p_venue_id uuid, p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(e.amount), 0)::bigint
  from public.ledger_transaction t
  join public.ledger_entry e on e.transaction_id = t.id
  join public.ledger_account a on a.id = e.account_id and a.member_id is null and a.code = 'venue.points_issued'
  where t.venue_id = p_venue_id and t.created_by_user_id = p_user_id and t.occurred_at >= private.tonight_began(now())
    and (t.idempotency_key like 'points.grant:%' or t.idempotency_key like 'points.lock:%');
$$;

-- As in 20261101100200_points_by_hand.sql, with the daily cap.
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
  if v_cap is not null and not private.is_super_admin(v_member.venue_id)
     and private.points_given_tonight(v_member.venue_id, (select auth.uid())) + p_points > v_cap then
    v_staff := private.current_staff_id(v_member.venue_id);
    if not exists (select 1 from public.alert a where a.venue_id = v_member.venue_id and a.kind = 'points.daily_cap'
                   and a.detail ->> 'staff_id' = v_staff::text and a.created_at >= private.tonight_began(now())) then
      perform private.raise_alert(v_member.venue_id, 'points.daily_cap', jsonb_build_object('staff_id', v_staff, 'cap', v_cap));
    end if;
    return null;
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

revoke execute on function private.points_given_tonight(uuid, uuid) from public, anon, authenticated;
