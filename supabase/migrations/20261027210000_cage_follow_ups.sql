-- Cage follow-ups from the #57 review (#335; decision 0210).
-- 1. A buy-in's request id is that one buy-in. A replay that differs in its UTR, in the table's request it
--    approves, or in anything else, or that names another kind of cage transaction (cash-outs and marker
--    repayments share the ids), is refused (22023), never reported as the first. The rest of the buy-in is
--    #57's and #17's, unchanged.
-- 2. The cage's wallet, bonus and markers are the ledger's balances, read through its one balance function
--    private.account_balance rather than sums of their own. The amounts are the same.
-- One UTR is already one payment across buy-ins and Academy payments: private.refuse_used_utr (#29) holds it
-- for every table that records one, and 136_cage_follow_ups proves it for the cage and the Academy.

create or replace function private.cage_buy_in(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_idempotency_key uuid,
                                               p_utr text default null, p_buy_in_request_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay public.cage_transaction;
  v_session public.seat_session;
  v_check record;
  v_request public.buy_in_request;
  v_txn uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier issues chips' using errcode = '42501';
  end if;
  select * into v_replay from public.cage_transaction c where c.venue_id = p_venue_id and c.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.kind <> 'buy_in' or v_replay.member_id is distinct from p_member_id or v_replay.amount_paise is distinct from p_amount_paise
       or v_replay.method is distinct from p_method or v_replay.utr is distinct from p_utr
       or v_replay.buy_in_request_id is distinct from p_buy_in_request_id then
      raise exception 'That request id was used for another buy-in' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  v_session := private.cage_check(p_venue_id, p_member_id);
  if p_method is null or p_method not in ('cash', 'upi', 'wallet', 'bonus') or (p_method = 'upi') <> (p_utr is not null)
     or (p_utr is not null and p_utr !~ '^[0-9]{12}$') then
    raise exception 'Cash, UPI with its 12-digit UTR, wallet or bonus' using errcode = '22023';
  end if;
  if exists (select 1 from public.cage_transaction c where c.venue_id = p_venue_id and c.utr = p_utr) then
    raise exception 'That UTR already paid for another buy-in' using errcode = 'RVUTR';
  end if;
  select * into v_check from private.buy_in_check(p_method, p_amount_paise,
    (select tt.buy_in_min_paise from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = v_session.table_id),
    private.wallet_cash(p_member_id), private.bonus_in_force(p_member_id, now()));
  if v_check.result <> 'ok' then
    raise exception 'Refused: %', v_check.result
      using errcode = case v_check.result when 'not_chips' then 'RVCHP' when 'below_minimum' then 'RVMIN' when 'bonus_short' then 'RVBON' else 'RVSHT' end;
  end if;
  if p_buy_in_request_id is not null then
    select * into v_request from public.buy_in_request r where r.id = p_buy_in_request_id for update;
    if v_request.id is null or v_request.venue_id <> p_venue_id or v_request.member_id <> p_member_id
       or v_request.amount_paise <> p_amount_paise or v_request.status <> 'waiting' then
      raise exception 'That request is not waiting for this member and amount' using errcode = '22023';
    end if;
    if v_request.session_id <> v_session.id then
      raise exception 'Seat % is no longer this player: decline the request', (select s.seat from public.seat_session s where s.id = v_request.session_id)
        using errcode = 'RVSTL';
    end if;
    update public.buy_in_request set status = 'approved', decided_at = now(), decided_by_staff_id = private.current_staff_id(p_venue_id)
    where id = v_request.id;
  end if;
  if p_method = 'bonus' then
    perform private.draw_bonus(p_member_id, p_amount_paise);
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'buy_in', 'buy_in:' || p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id
                                         and ((v_check.debit = 'member_cash' and a.code = 'member.cash' and a.member_id = p_member_id)
                                              or (v_check.debit = 'member_bonus' and a.code = 'member.bonus' and a.member_id = p_member_id)
                                              or (v_check.debit not in ('member_cash', 'member_bonus') and a.code = 'venue.' || v_check.debit
                                                  and a.member_id is null))),
                         'amount', p_amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.chips_outstanding'),
                         'amount', (-p_amount_paise)::text)),
    null, 'Buy-in at the cage');
  insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise, utr, session_id, buy_in_request_id,
                                       ledger_transaction_id, cashier_staff_id, idempotency_key)
  values (p_venue_id, p_member_id, 'buy_in', p_method, p_amount_paise, p_utr, v_session.id, p_buy_in_request_id,
          v_txn, private.current_staff_id(p_venue_id), p_idempotency_key)
  returning id into v_id;
  perform private.emit(p_venue_id, 'cage.buy_in',
                       jsonb_build_object('cage_transaction_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise,
                                          'method', p_method, 'table_id', v_session.table_id), 'cage.buy_in:' || v_id);
  return v_id;
end;
$$;

-- A member's wallet cash, in paise: their cash account's natural balance, by the ledger's balance function.
create or replace function private.wallet_cash(p_member_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.cash'));
$$;

-- The cage's member search (#57, #58, #79), its bonus and markers now the ledger's balances too.
create or replace function private.cage_members(p_venue_id uuid, p_query text)
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
         -private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.bonus')),
         private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.receivable')),
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
