-- Bonus used without a seat needs no check-in (the owner, 22 Nov: "Remove the check in requirement for bonus redemption
-- at all places"; decision 0710). A use while the member is checked in is their visit's, as before: it counts with the
-- visit's seat buy-ins against its cap and shows on its first row at the Door. With no visit open it is tied to none, as a
-- file's use is: never more than the Bonus in force, none while some is owed, and no more than the cap's share of the Bonus
-- held then (private.bonus_visit_left with no visit open). It is in the record's and the member's Bonus histories, Activity
-- and the report's Bonus used; the Door's rows show a visit's uses, so not this one, though the row's Wallet does.
-- A request id sent again is the same use, known by its ledger key (bonus_use:<id>), which a file's use
-- (bonus_file_use:<id>) never has: a use with no visit is no longer taken for a file's.

comment on table public.bonus_redemption is
  'Bonus a member used: with their buy-in as they were seated (decision 0504), added after on a past seat (#1077), without a seat during a visit or with none open (the owner, 20 and 22 Nov), or from a file a super admin saved, with no visit (the owner, 22 Nov).';
comment on column public.bonus_redemption.visit_id is
  'For Bonus used without a seat (private.use_bonus): the visit it was used in, null when none was open (the owner, 22 Nov); null for a seat''s and a file''s.';

-- As 20261128110000_bonus_from_a_file.sql made it, with a use without a seat known by its ledger key, a visit or none.
CREATE OR REPLACE FUNCTION private.bonus_use_replayed(p_request_id uuid, p_member_id uuid, p_amount_paise bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_replay public.bonus_redemption;
begin
  select * into v_replay from public.bonus_redemption r where r.id = p_request_id;
  if v_replay.id is null then
    return false;
  end if;
  if v_replay.member_id <> p_member_id or v_replay.amount_paise <> p_amount_paise or v_replay.session_id is not null
     or not exists (select 1 from public.ledger_transaction t
                    where t.id = v_replay.ledger_transaction_id and t.idempotency_key = 'bonus_use:' || p_request_id) then
    raise exception 'That request id was used for another Bonus use' using errcode = '22023';
  end if;
  return true;
end;
$function$;

-- As 20261128100000_bonus_use_without_seat.sql made it, with no check-in needed: the open visit if there is one, else none.
-- Refusals: 42501 not one who gives Bonus by hand at the member's venue, or the member erased; RVOWN their own record;
-- RVCHP not whole 50s from 50 to 1,00,000; 22023 no reason of 3 to 200 characters or no request id, a request id used for
-- another use, or the member erased while this waited; RVKIL/RVFRZ/RVMBR promotions stopped or frozen; RVRAT too many a
-- minute; RVVCP more than the cap leaves; RVBON more than the Bonus in force, or some owed.
CREATE OR REPLACE FUNCTION private.use_bonus(p_member_id uuid, p_chips integer, p_reason text, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id and m.erased_at is null);
  v_amount bigint := p_chips::bigint * 100;
  v_visit_id uuid;
  v_txn uuid;
begin
  if v_venue_id is null or not coalesce(private.has_permission(v_venue_id, 'bonus.give'), false) then
    raise exception 'Only those who give Bonus by hand use it' using errcode = '42501';
  end if;
  if private.is_own_cage_record(p_member_id) or coalesce(private.is_own_kyc_check(p_member_id), false) then
    raise exception 'Staff never use Bonus on their own record' using errcode = 'RVOWN';
  end if;
  if p_chips is null or p_chips < 50 or p_chips > 100000 or p_chips % 50 <> 0 then
    raise exception 'Whole fifties from 50 to 1,00,000 chips' using errcode = 'RVCHP';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  -- A use that went through is answered before anything that refuses a new one.
  if private.bonus_use_replayed(p_request_id, p_member_id, v_amount) then
    return p_request_id;
  end if;
  perform private.assert_writable(v_venue_id, 'promotions', p_member_id);
  perform private.assert_rate(v_venue_id, 'bonus.use');
  -- One lock order for a member's visit and Bonus: the member's row, then their open visit's row, then their Bonus lock.
  -- Check-in, seating and check-out take the member's row first (private.open_visit, start_seat_session, leave_by_door)
  -- and the visit after it (close_visit); private.draw_bonus takes the visit's row before the Bonus lock;
  -- private.reverse_bonus and add_bonus_use take the member's row before the Bonus lock. Whichever comes second waits at its
  -- first lock while holding nothing the first still needs, so they wait in turn and never on each other. The member's row
  -- is held for no key update: it waits for those, and they for it, as for update would, but a buy-in recorded meanwhile
  -- (its row naming the member, which checks the member's key) is not held up while it holds the visit this waits for.
  -- (An erasure, private.erase_member and carry_out_erasure, still takes the Bonus lock first; it refuses a member with a
  -- visit open.)
  perform 1 from public.member m where m.id = p_member_id and m.erased_at is null for no key update;
  if not found then
    raise exception 'The member was erased' using errcode = '22023';
  end if;
  -- The same request at the same moment waited above for the first, and is answered as it.
  if private.bonus_use_replayed(p_request_id, p_member_id, v_amount) then
    return p_request_id;
  end if;
  -- The open visit, if any: with none, the use is tied to no visit (the owner, 22 Nov).
  select v.id into v_visit_id from public.visit v where v.member_id = p_member_id and v.closed_at is null for no key update;
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || p_member_id::text, 0));
  -- Notes the cap's base on the visit if this is its first Bonus use (decision 0706), then draws.
  perform private.draw_bonus(p_member_id, v_amount);
  v_txn := private.post_ledger_transaction(v_venue_id, 'bonus_buy_in', 'bonus_use:' || p_request_id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_venue_id
                                         and a.code = 'venue.chips_outstanding'), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus used without a seat');
  insert into public.bonus_redemption (id, venue_id, member_id, visit_id, amount_paise, ledger_transaction_id, staff_id, reason)
  values (p_request_id, v_venue_id, p_member_id, v_visit_id, v_amount, v_txn, private.current_staff_id(v_venue_id), btrim(p_reason));
  perform private.audit(v_venue_id, 'bonus.use', 'member', p_member_id::text, null,
                        jsonb_build_object('chips', p_chips, 'bonus_redemption_id', p_request_id, 'visit_id', v_visit_id), btrim(p_reason));
  -- No table: the member's app and push say it was used, with no table (packages/contracts bonusRedeemedSchema).
  perform private.emit(v_venue_id, 'bonus.redeemed',
                       jsonb_build_object('bonus_redemption_id', p_request_id, 'member_id', p_member_id, 'amount_paise', v_amount,
                                          'table_id', null, 'table_name', null),
                       'bonus.redeemed:' || p_request_id);
  return p_request_id;
end;
$function$;
