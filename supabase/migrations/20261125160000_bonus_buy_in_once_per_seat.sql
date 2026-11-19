-- A seating's Bonus buy-in is redeemed once (#914, from the money audit of #908). redeem_bonus_at_seat keyed its ledger
-- transaction on a new random id, so a second call for the same seating would have drawn the Bonus twice; its callers' own
-- refusals were the only guard. It now holds the seat while it redeems and keys the transaction on the seat session, the
-- seat and when the member sat down at this table: a replay redeems nothing more, and a table change or a move to another
-- seat that keeps the seat session (assign_from_waitlist) still redeems there.

CREATE OR REPLACE FUNCTION private.redeem_bonus_at_seat(p_session_id uuid, p_chips integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_amount bigint := p_chips::bigint * 100;
  v_id uuid := gen_random_uuid();
  v_txn uuid;
  v_table_name text;
  v_key text;
begin
  if coalesce(p_chips, 0) = 0 then
    return;
  end if;
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not coalesce(private.has_permission(v_session.venue_id, 'members.read'), false) then
    raise exception 'Only staff who open member records redeem bonus chips' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_session.member_id) then
    raise exception 'Staff never redeem their own bonus chips' using errcode = 'RVOWN';
  end if;
  if p_chips < 0 or p_chips % 50 <> 0 then
    raise exception 'Bonus chips are redeemed in whole 50s' using errcode = 'RVCHP';
  end if;
  -- Once a seating (#914): keyed on the seat session, the seat and when the member sat down at this table, so a second call
  -- for the same seating, a replay, redeems nothing more, while a table change or a move to another seat in the same seat
  -- session (assign_from_waitlist) is a seating of its own. The epoch, not the time as text, so the key never depends on
  -- the session's time zone.
  v_key := 'bonus_buy_in:' || v_session.id || ':' || v_session.seat || ':' || extract(epoch from v_session.seated_here_at);
  if exists (select 1 from public.ledger_transaction x where x.venue_id = v_session.venue_id and x.idempotency_key = v_key) then
    return;
  end if;
  perform private.assert_rate(v_session.venue_id, 'bonus.redeem');
  perform private.draw_bonus(v_session.member_id, v_amount);
  v_txn := private.post_ledger_transaction(v_session.venue_id, 'bonus_buy_in', v_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_session.member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_session.venue_id
                                         and a.code = 'venue.chips_outstanding'), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus chips redeemed at the seat');
  insert into public.bonus_redemption (id, venue_id, member_id, session_id, table_id, amount_paise, ledger_transaction_id, staff_id)
  values (v_id, v_session.venue_id, v_session.member_id, v_session.id, v_session.table_id, v_amount, v_txn,
          private.current_staff_id(v_session.venue_id));
  select t.name into v_table_name from public.game_table t where t.id = v_session.table_id;
  perform private.emit(v_session.venue_id, 'bonus.redeemed',
                       jsonb_build_object('bonus_redemption_id', v_id, 'member_id', v_session.member_id, 'amount_paise', v_amount,
                                          'table_id', v_session.table_id, 'table_name', v_table_name),
                       'bonus.redeemed:' || v_id);
end;
$function$;
