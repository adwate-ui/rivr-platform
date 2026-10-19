-- Cash-out at the cage (#75; scope-v1 module 5; design prompt flow 8). Chips handed back first settle
-- the member's open markers, oldest first; the rest goes to them in cash or to their wallet, in one
-- balanced ledger transaction, once per request id. A member with an open marker never takes cash
-- before it is settled. Only a member checked in has chips to hand back (the prototype's "No open
-- session"). TDS (#22), the call-time shortfall (#79) and closing the visit (#76) follow.
-- Refusals the cage tells apart: RVCHP not whole chips; RVKYC no finished check; RVOUT not checked in;
-- RVNOM no such member; RVFRZ, RVMBR frozen.

-- Cash-outs are cage transactions too; they need no seat.
alter table public.cage_transaction drop constraint cage_transaction_kind_check;
alter table public.cage_transaction add constraint cage_transaction_kind_check check (kind in ('buy_in', 'cash_out'));
alter table public.cage_transaction alter column session_id drop not null;
alter table public.cage_transaction add constraint cage_transaction_seated check (kind <> 'buy_in' or session_id is not null);
alter table public.cage_transaction add constraint cage_transaction_cash_out_method check (kind <> 'cash_out' or method in ('cash', 'wallet'));

comment on table public.cage_transaction is 'Chips issued and taken back at the cage: method, amount, UTR for UPI, and its ledger transaction (#57, #75); never changed.';

-- What a cash-out paid off each marker.
create table public.marker_settlement (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  marker_id uuid not null references public.marker (id),
  cage_transaction_id uuid not null references public.cage_transaction (id),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 5000 = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (marker_id, cage_transaction_id)
);

comment on table public.marker_settlement is 'How much of a marker a cash-out settled (#75); never changed.';

create index marker_settlement_marker_idx on public.marker_settlement (marker_id);
create index marker_settlement_transaction_idx on public.marker_settlement (cage_transaction_id);
create index marker_settlement_venue_idx on public.marker_settlement (venue_id);
create trigger marker_settlement_never_changed before update or delete on public.marker_settlement
  for each row execute function private.refuse_change();
create trigger marker_settlement_audit after insert on public.marker_settlement
  for each row execute function private.audit_row_change();

alter table public.marker_settlement enable row level security;
grant select on public.marker_settlement to authenticated;
create policy "members see what their cash-outs settled" on public.marker_settlement
  for select to authenticated
  using (marker_id in (select k.id from public.marker k where k.member_id = private.current_member_id()));
create policy "staff who see markers see their settlements" on public.marker_settlement
  for select to authenticated
  using (venue_id in (select private.venues_where('markers.issue')) or venue_id in (select private.venues_where('markers.manage_limits'))
         or venue_id in (select private.venues_where('ledger.read')));

-- @rivr/domain cashOut in SQL, proved on the same golden file: what each open marker (oldest first) is
-- settled, and what is left for the member; null when the chips are not whole.
create function private.cash_out_split(p_chips_paise bigint, p_outstanding_paise bigint[])
returns table (settled_paise bigint[], to_member_paise bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_left bigint := p_chips_paise;
  v_owed bigint;
  v_settled bigint[] := '{}'::bigint[];
begin
  if p_chips_paise is null or p_chips_paise <= 0 or p_chips_paise % 5000 <> 0 then
    return query select null::bigint[], null::bigint;
    return;
  end if;
  foreach v_owed in array coalesce(p_outstanding_paise, '{}') loop
    exit when v_left <= 0;
    v_settled := v_settled || least(v_left, v_owed);
    v_left := v_left - least(v_left, v_owed);
  end loop;
  return query select v_settled, v_left;
end;
$$;

-- What a cash-out came to: what it settled on markers, and what went to the member.
create function private.cash_out_outcome(p_cage_transaction_id uuid)
returns table (o_cage_transaction_id uuid, o_markers_settled_paise bigint, o_to_member_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, coalesce(sum(s.amount_paise), 0)::bigint, c.amount_paise - coalesce(sum(s.amount_paise), 0)::bigint
  from public.cage_transaction c left join public.marker_settlement s on s.cage_transaction_id = c.id
  where c.id = p_cage_transaction_id
  group by c.id, c.amount_paise;
$$;

-- The cash-out a request id already made, if any; the same id with other details is refused.
create function private.cash_out_replay(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid)
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
  if v_replay.id is not null and (v_replay.kind <> 'cash_out' or v_replay.member_id <> p_member_id
                                  or v_replay.amount_paise <> p_amount_paise or v_replay.method <> p_to) then
    raise exception 'That request id was used for another cage transaction' using errcode = '22023';
  end if;
  return v_replay.id;
end;
$$;

-- A cashier takes chips back from a member: open markers first, oldest first, then cash or the
-- wallet, once per request id. Gives the cage transaction, what it settled and what the member got.
create function private.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid)
returns table (o_cage_transaction_id uuid, o_markers_settled_paise bigint, o_to_member_paise bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
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
  v_id := private.cash_out_replay(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key);
  if v_id is not null then
    return query select * from private.cash_out_outcome(v_id);
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
  v_id := private.cash_out_replay(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key);
  if v_id is not null then
    return query select * from private.cash_out_outcome(v_id);
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
                                       idempotency_key)
  values (p_venue_id, p_member_id, 'cash_out', p_to, p_amount_paise,
          (select s.id from public.seat_session s where s.member_id = p_member_id and s.ended_at is null), v_txn,
          private.current_staff_id(p_venue_id), p_idempotency_key)
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
                                          'markers_settled_paise', v_settled, 'to_member_paise', v_split.to_member_paise, 'to', p_to),
                       'cage.cash_out:' || v_id);
  return query select v_id, v_settled, v_split.to_member_paise;
end;
$$;

revoke execute on function private.cash_out_split(bigint, bigint[]), private.cash_out_outcome(uuid),
  private.cash_out_replay(uuid, uuid, bigint, text, uuid) from public, anon, authenticated;
revoke execute on function private.cage_cash_out(uuid, uuid, bigint, text, uuid) from public, anon;
grant execute on function private.cage_cash_out(uuid, uuid, bigint, text, uuid) to authenticated;

create function public.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid)
returns table (cage_transaction_id uuid, markers_settled_paise bigint, to_member_paise bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.cage_cash_out(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key); $$;

revoke execute on function public.cage_cash_out(uuid, uuid, bigint, text, uuid) from public, anon;
grant execute on function public.cage_cash_out(uuid, uuid, bigint, text, uuid) to authenticated;
