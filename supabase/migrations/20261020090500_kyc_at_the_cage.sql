-- The cage and a member's identity (#58; scope-v1 module 1 acceptance, module 12; decision 0065). Every
-- cage write that moves money refuses a member whose identity check fails with the reason: under the
-- venue's minimum age (RVAGE), the PAN, Aadhaar or face of another verified member (RVDUP), or not
-- finished (RVKYC); a frozen member (RVMBR) and, for chips, a break (RVBRK) as before. The cage's member
-- search says the reason, and the cage's withdrawals and deposits show the member's KYC photo.

-- Refuses a cage write for a member whose identity check fails, with the reason.
create function private.assert_kyc_for_cage(p_member_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  if private.is_kyc_complete(p_member_id) then
    return;
  end if;
  v_reason := private.kyc_refusal(p_member_id);
  if v_reason = 'under_18' then
    raise exception 'Under the venue''s minimum age: nothing at the cage' using errcode = 'RVAGE';
  end if;
  if v_reason like 'duplicate_%' then
    raise exception 'The identity of another verified member: nothing at the cage' using errcode = 'RVDUP';
  end if;
  raise exception 'KYC incomplete: nothing at the cage until it is approved' using errcode = 'RVKYC';
end;
$$;

revoke execute on function private.assert_kyc_for_cage(uuid) from public, anon, authenticated;

-- #57's check, refusing with the reason a member's identity check fails. What the cage refuses before any money moves: not a cashier here, no such member, a frozen member
-- or venue, no finished identity check, a break, or not seated. Gives the member's open session.
create or replace function private.cage_check(p_venue_id uuid, p_member_id uuid)
returns public.seat_session
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier issues chips' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  -- One buy-in at a time per member, after any break or freeze committed meanwhile.
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  perform private.assert_kyc_for_cage(p_member_id);
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: no buy-ins until it ends' using errcode = 'RVBRK';
  end if;
  select * into v_session from public.seat_session s where s.member_id = p_member_id and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Not seated: chips are issued to a seat' using errcode = 'RVNST';
  end if;
  return v_session;
end;
$$;

-- #79's cash-out, refusing with the reason a member's identity check fails.
create or replace function private.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid,
                                                 p_is_final boolean)
returns table (o_cage_transaction_id uuid, o_markers_settled_paise bigint, o_to_member_paise bigint, o_is_visit_closed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_final boolean := coalesce(p_is_final, false);
  v_owed record;
  v_markers uuid[];
  v_owes bigint[];
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
  perform private.assert_kyc_for_cage(p_member_id);
  if private.current_visit(p_member_id) is null then
    raise exception 'Not checked in: nothing to cash out' using errcode = 'RVOUT';
  end if;
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) > 0 and not exists (select 1 from public.early_departure e where e.session_id = v_owed.o_session_id) then
    raise exception 'Call time not complete: % seconds owed', v_owed.o_seconds using errcode = 'RVCTS';
  end if;
  select array_agg(k.id order by k.issued_at, k.id), array_agg(k.outstanding_paise order by k.issued_at, k.id) into v_markers, v_owes
  from (select k.id, k.issued_at, k.outstanding_paise from public.marker k
        where k.member_id = p_member_id and k.settled_at is null order by k.issued_at, k.id for update) k;
  select * into v_split from private.cash_out_split(p_amount_paise, v_owes);
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
        settled_at = case when v_split.settled_paise[i] = v_owes[i] then now() end
    where id = v_markers[i];
    insert into public.marker_settlement (venue_id, marker_id, cage_transaction_id, amount_paise)
    values (p_venue_id, v_markers[i], v_id, v_split.settled_paise[i]);
    if v_split.settled_paise[i] = v_owes[i] then
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

-- The cage's member search (#57, #79) says why a member's identity check fails, if it does.
drop function public.cage_members(uuid, text);
drop function private.cage_members(uuid, text);
create function private.cage_members(p_venue_id uuid, p_query text)
returns table (member_id uuid, full_name text, tier_name text, is_kyc_complete boolean, kyc_refusal text, photo_path text, wallet_paise bigint,
               bonus_paise bigint, markers_paise bigint, table_name text, seat integer, minimum_paise bigint, break_until timestamptz,
               call_time_owed_seconds integer, is_let_go_early boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, t.name, private.is_kyc_complete(m.id),
         coalesce(private.kyc_refusal(m.id), case when k.status = 'refused' then k.refusal end), k.photo_path, private.wallet_cash(m.id),
         coalesce((select -sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.member_id = m.id and a.code = 'member.bonus'), 0)::bigint,
         coalesce((select sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.member_id = m.id and a.code = 'member.receivable'), 0)::bigint,
         g.name, s.seat, tt.buy_in_min_paise, (select r.break_until from private.member_restrictions(m.id, now()) r),
         coalesce(o.o_seconds, 0), exists (select 1 from public.early_departure d where d.session_id = o.o_session_id)
  from public.member m
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  left join public.seat_session s on s.member_id = m.id and s.ended_at is null
  left join public.game_table g on g.id = s.table_id
  left join public.table_type tt on tt.id = g.table_type_id
  left join lateral private.call_time_owed(m.id, now()) o on true
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'cage.transact')
    and length(trim(coalesce(p_query, ''))) >= 2
    and (m.full_name ilike '%' || trim(p_query) || '%'
         or m.phone like '%' || right(regexp_replace(p_query, '[^0-9]', '', 'g'), 10) || '%' and length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 4)
  order by m.full_name
  limit 10;
$$;
create function public.cage_members(p_venue_id uuid, p_query text)
returns table (member_id uuid, full_name text, tier_name text, is_kyc_complete boolean, kyc_refusal text, photo_path text, wallet_paise bigint,
               bonus_paise bigint, markers_paise bigint, table_name text, seat integer, minimum_paise bigint, break_until timestamptz,
               call_time_owed_seconds integer, is_let_go_early boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.cage_members(p_venue_id, p_query); $$;

-- The cage's withdrawals (#21) and deposits (#29) with the member's KYC photo.
drop function public.waiting_withdrawals(uuid);
drop function private.waiting_withdrawals(uuid);
create function private.waiting_withdrawals(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, photo_path text, amount_paise bigint, kind text, bank_name text, vpa text,
               account_number text, ifsc text, holder_name text, requested_at timestamptz, needs_second boolean, approved_by text[])
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, m.id, m.full_name, (select k.photo_path from public.kyc_record k where k.member_id = m.id), w.amount_paise, a.kind, a.bank_name,
         case when private.has_permission(p_venue_id, 'withdrawals.approve') then a.vpa else '••••@' || split_part(a.vpa, '@', 2) end,
         case when private.has_permission(p_venue_id, 'withdrawals.approve') then a.account_number else '••••' || right(a.account_number, 4) end,
         a.ifsc, a.holder_name, w.created_at,
         private.second_approver_needed(w.venue_id, w.amount_paise, now()),
         coalesce((select array_agg(s.full_name order by sa.approved_at, sa.id) from public.second_approval sa join public.staff s on s.id = sa.approved_by_staff_id
                   where sa.venue_id = w.venue_id and sa.subject = 'withdrawal' and sa.subject_id = w.id and sa.amount_paise = w.amount_paise), '{}')
  from public.withdrawal_request w
  join public.member m on m.id = w.member_id
  join public.payout_account a on a.id = w.payout_account_id
  where w.venue_id = p_venue_id and w.status = 'waiting'
    and (private.has_permission(p_venue_id, 'withdrawals.approve') or private.has_permission(p_venue_id, 'cage.second_approve'))
  order by w.created_at, w.id;
$$;
create function public.waiting_withdrawals(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, photo_path text, amount_paise bigint, kind text, bank_name text, vpa text,
               account_number text, ifsc text, holder_name text, requested_at timestamptz, needs_second boolean, approved_by text[])
language sql stable security invoker set search_path = ''
as $$ select * from private.waiting_withdrawals(p_venue_id); $$;

drop function public.waiting_deposits(uuid);
drop function private.waiting_deposits(uuid);
create function private.waiting_deposits(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, photo_path text, utr text, from_vpa text, from_bank text, requested_at timestamptz,
               needs_second boolean, approved_by text[])
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, m.id, m.full_name, (select k.photo_path from public.kyc_record k where k.member_id = m.id), d.utr, a.vpa, a.bank_name, d.created_at,
         private.second_approver_needed(d.venue_id, d.amount_paise, now()),
         coalesce((select array_agg(s.full_name order by sa.approved_at, sa.id) from public.second_approval sa join public.staff s on s.id = sa.approved_by_staff_id
                   where sa.venue_id = d.venue_id and sa.subject = 'deposit' and sa.subject_id = d.id and sa.amount_paise = d.amount_paise), '{}')
  from public.deposit_request d
  join public.member m on m.id = d.member_id
  join public.payout_account a on a.id = d.payout_account_id
  where d.venue_id = p_venue_id and d.status = 'waiting'
    and (private.has_permission(p_venue_id, 'cage.transact') or private.has_permission(p_venue_id, 'cage.second_approve'))
  order by d.created_at, d.id;
$$;
create function public.waiting_deposits(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, photo_path text, utr text, from_vpa text, from_bank text, requested_at timestamptz,
               needs_second boolean, approved_by text[])
language sql stable security invoker set search_path = ''
as $$ select * from private.waiting_deposits(p_venue_id); $$;

revoke execute on function private.cage_members(uuid, text), private.waiting_withdrawals(uuid), private.waiting_deposits(uuid),
  public.cage_members(uuid, text), public.waiting_withdrawals(uuid), public.waiting_deposits(uuid) from public, anon;
grant execute on function private.cage_members(uuid, text), private.waiting_withdrawals(uuid), private.waiting_deposits(uuid),
  public.cage_members(uuid, text), public.waiting_withdrawals(uuid), public.waiting_deposits(uuid) to authenticated;
