-- A final cash-out closes the visit (#76; features "Check-in and check-out"; decision 0059). A cash-out
-- marked final is the member leaving the club: in the same transaction, after the money moves, it ends
-- their seat if they still have one (end reason cash_out; a buy-in they asked for is withdrawn, as when
-- they leave the table), then closes their open visit and emits visit.closed. Whether it was final is
-- kept on the cage transaction, so a retried request does it once and a request id is for one kind.
-- private.close_visit is the lane C contract's, for the door's check-out too (#82).

alter table public.cage_transaction add column is_final boolean not null default false;
alter table public.cage_transaction add constraint cage_transaction_final_cash_out check (not is_final or kind = 'cash_out');

comment on column public.cage_transaction.is_final is 'A final cash-out: the member left the club, their seat ended and their visit closed (#76).';

-- Closes the member's open visit, if any, and emits visit.closed once. Gives the visit, or null.
create function private.close_visit(p_member_id uuid, p_at timestamptz, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
begin
  select * into v_visit from public.visit v where v.member_id = p_member_id and v.closed_at is null for update;
  if v_visit.id is null then return null; end if;
  update public.visit set closed_at = greatest(p_at, v_visit.opened_at), close_reason = p_reason where id = v_visit.id;
  perform private.emit(v_visit.venue_id, 'visit.closed',
                       jsonb_build_object('visit_id', v_visit.id, 'member_id', p_member_id, 'reason', p_reason), 'visit.closed:' || v_visit.id);
  return v_visit.id;
end;
$$;

-- The member leaves the club: their open seat ends with the cash-out, and their visit closes.
create function private.leave_on_cash_out(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.member_id = p_member_id and s.ended_at is null for update;
  if v_session.id is not null then
    update public.seat_session set ended_at = now(), end_reason = 'cash_out', away_since = null where id = v_session.id;
    update public.buy_in_request set status = 'withdrawn', decided_at = now() where session_id = v_session.id and status = 'waiting';
    perform private.emit(v_session.venue_id, 'seat.left',
                         jsonb_build_object('session_id', v_session.id, 'member_id', p_member_id, 'table_id', v_session.table_id,
                                            'seat', v_session.seat, 'reason', 'cash_out'), 'seat.left:' || v_session.id);
  end if;
  perform private.close_visit(p_member_id, now(), 'cash_out');
end;
$$;

-- #75's cash-out, final or not: the public function, the replay check and the cash-out itself change shape.
drop function public.cage_cash_out(uuid, uuid, bigint, text, uuid);
drop function private.cage_cash_out(uuid, uuid, bigint, text, uuid);
drop function private.cash_out_replay(uuid, uuid, bigint, text, uuid);

-- The cash-out a request id already made, if any; the same id with other details, finality included, is refused.
create function private.cash_out_replay(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid,
                                        p_is_final boolean)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_replay public.cage_transaction;
begin
  select * into v_replay from public.cage_transaction c where c.venue_id = p_venue_id and c.idempotency_key = p_idempotency_key;
  if v_replay.id is not null and (v_replay.kind <> 'cash_out' or v_replay.member_id <> p_member_id or v_replay.amount_paise <> p_amount_paise
                                  or v_replay.method <> p_to or v_replay.is_final <> p_is_final) then
    raise exception 'That request id was used for another cage transaction' using errcode = '22023';
  end if;
  return v_replay.id;
end;
$$;

-- A cashier takes chips back from a member: open markers first, oldest first, then cash or the
-- wallet, once per request id; a final one then ends their seat and closes their visit. Gives the cage
-- transaction, what it settled, what the member got, and whether their visit is closed.
create function private.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid,
                                      p_is_final boolean)
returns table (o_cage_transaction_id uuid, o_markers_settled_paise bigint, o_to_member_paise bigint, o_is_visit_closed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_final boolean := coalesce(p_is_final, false);
  v_markers uuid[];
  v_owed bigint[];
  v_split record;
  v_settled bigint;
  v_lines jsonb;
  v_txn uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier cashes out' using errcode = '42501';
  end if;
  v_id := private.cash_out_replay(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key, v_is_final);
  if v_id is not null then
    return query select o.*, private.current_visit(p_member_id) is null from private.cash_out_outcome(v_id) o;
    return;
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if p_to is null or p_to not in ('cash', 'wallet') then
    raise exception 'Cash out to cash or to the wallet' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  -- A twin tap that waited on the lock is the same cash-out.
  v_id := private.cash_out_replay(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key, v_is_final);
  if v_id is not null then
    return query select o.*, private.current_visit(p_member_id) is null from private.cash_out_outcome(v_id) o;
    return;
  end if;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if not private.is_kyc_complete(p_member_id) then
    raise exception 'KYC incomplete: no cash-out until it is approved' using errcode = 'RVKYC';
  end if;
  if private.current_visit(p_member_id) is null then
    raise exception 'Not checked in: nothing to cash out' using errcode = 'RVOUT';
  end if;
  select array_agg(k.id order by k.issued_at, k.id), array_agg(k.outstanding_paise order by k.issued_at, k.id) into v_markers, v_owed
  from (select k.id, k.issued_at, k.outstanding_paise from public.marker k
        where k.member_id = p_member_id and k.settled_at is null order by k.issued_at, k.id for update) k;
  select * into v_split from private.cash_out_split(p_amount_paise, v_owed);
  if v_split.to_member_paise is null then
    raise exception 'A cash-out is whole ₹50 chips' using errcode = 'RVCHP';
  end if;
  v_settled := coalesce((select sum(s) from unnest(v_split.settled_paise) s), 0);
  v_lines := jsonb_build_array(jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id
                                                                   and a.code = 'venue.chips_outstanding' and a.member_id is null),
                                                  'amount', p_amount_paise::text));
  if v_settled > 0 then
    v_lines := v_lines || jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.receivable'),
                                             'amount', (-v_settled)::text);
  end if;
  if v_split.to_member_paise > 0 then
    v_lines := v_lines || jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and (
                                                              (p_to = 'wallet' and a.code = 'member.cash' and a.member_id = p_member_id)
                                                              or (p_to = 'cash' and a.code = 'venue.cash_drawer' and a.member_id is null))),
                                             'amount', (-v_split.to_member_paise)::text);
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'cash_out', 'cash_out:' || p_idempotency_key, v_lines, null, 'Cash-out at the cage');
  insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise, session_id, ledger_transaction_id, cashier_staff_id,
                                       idempotency_key, is_final)
  values (p_venue_id, p_member_id, 'cash_out', p_to, p_amount_paise,
          (select s.id from public.seat_session s where s.member_id = p_member_id and s.ended_at is null), v_txn,
          private.current_staff_id(p_venue_id), p_idempotency_key, v_is_final)
  returning id into v_id;
  for i in 1 .. coalesce(array_length(v_split.settled_paise, 1), 0) loop
    update public.marker
    set outstanding_paise = outstanding_paise - v_split.settled_paise[i],
        settled_at = case when v_split.settled_paise[i] = v_owed[i] then now() end
    where id = v_markers[i];
    insert into public.marker_settlement (venue_id, marker_id, cage_transaction_id, amount_paise)
    values (p_venue_id, v_markers[i], v_id, v_split.settled_paise[i]);
    if v_split.settled_paise[i] = v_owed[i] then
      perform private.emit(p_venue_id, 'marker.settled',
                           jsonb_build_object('marker_id', v_markers[i], 'member_id', p_member_id, 'cage_transaction_id', v_id),
                           'marker.settled:' || v_markers[i]);
    end if;
  end loop;
  perform private.emit(p_venue_id, 'cage.cash_out',
                       jsonb_build_object('cage_transaction_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise,
                                          'markers_settled_paise', v_settled, 'to_member_paise', v_split.to_member_paise, 'to', p_to,
                                          'is_final', v_is_final),
                       'cage.cash_out:' || v_id);
  if v_is_final then
    perform private.leave_on_cash_out(p_member_id);
  end if;
  return query select v_id, v_settled, v_split.to_member_paise, private.current_visit(p_member_id) is null;
end;
$$;

revoke execute on function private.close_visit(uuid, timestamptz, text), private.leave_on_cash_out(uuid),
  private.cash_out_replay(uuid, uuid, bigint, text, uuid, boolean) from public, anon, authenticated;
revoke execute on function private.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean) from public, anon;
grant execute on function private.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean) to authenticated;

create function public.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid,
                                     p_is_final boolean default false)
returns table (cage_transaction_id uuid, markers_settled_paise bigint, to_member_paise bigint, is_visit_closed boolean)
language sql volatile security invoker set search_path = ''
as $$ select * from private.cage_cash_out(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key, p_is_final); $$;

revoke execute on function public.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean) from public, anon;
grant execute on function public.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean) to authenticated;
