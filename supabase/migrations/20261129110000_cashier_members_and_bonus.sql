-- Cashiers see all of Members to view and handle Bonus (the owner, 22 Nov; decision 0709): "full members view-only + only
-- bonus related updates - add, redeem, reverse". They read mobiles as the floor does (members.phone, decision 0708), add
-- Bonus by hand and use it without a seat (bonus.give, within the by-hand caps), and, with super admins, reverse any Bonus
-- given and add a use a seat missed: a permission of its own, bonus.correct, in place of the super-admin check. Bonus
-- from a file, approving a promotion's Bonus, a member's phone, overrides, erasure and ID documents stay with super admins.
-- A missed use takes a balance below zero only by a super admin's hand: anyone else's stays within the Bonus in force,
-- with none owed, as Use Bonus does (the security review, 22 Nov; a question to the owner).

insert into public.role_permission (role, permission)
select 'cashier', permission from unnest(array['members.phone', 'bonus.give', 'bonus.correct']) as permission;
insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['bonus.correct']) as permission;

-- Reversing any Bonus given, under the same rules as before.
CREATE OR REPLACE FUNCTION private.reverse_bonus(p_grant_id uuid, p_reason text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_grant public.bonus_grant;
  v_expired bigint;
  v_amount bigint;
  v_ids uuid[];
  v_remaining bigint[];
  v_expires timestamptz[];
  v_taken bigint[];
  v_owed bigint;
  v_txn uuid;
begin
  select * into v_grant from public.bonus_grant g where g.id = p_grant_id;
  if v_grant.id is null or not private.has_permission(v_grant.venue_id, 'bonus.correct') then
    raise exception 'Only super admins and cashiers reverse Bonus' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_grant.member_id) or coalesce(private.is_own_kyc_check(v_grant.member_id), false) then
    raise exception 'Staff never reverse Bonus on their own record' using errcode = 'RVOWN';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 200
     or exists (select 1 from public.member m where m.id = v_grant.member_id and m.erased_at is not null) then
    raise exception 'A reason of 3 to 200 characters, for a member still here' using errcode = '22023';
  end if;
  perform private.assert_writable(v_grant.venue_id, 'promotions', v_grant.member_id);
  perform private.assert_rate(v_grant.venue_id, 'bonus.reverse');
  -- An erasure that came first has closed the record.
  perform 1 from public.member m where m.id = v_grant.member_id and m.erased_at is null for share;
  if not found then
    raise exception 'The member was erased' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || v_grant.member_id::text, 0));
  select * into v_grant from public.bonus_grant g where g.id = p_grant_id for update;
  -- Once: asked again, it is done.
  if v_grant.reversed_at is not null then
    return null;
  end if;
  -- What expired of it went back then; the rest comes back now.
  v_expired := coalesce((select e.amount from public.ledger_entry e join public.ledger_account a on a.id = e.account_id and a.code = 'member.bonus'
                         where e.transaction_id = v_grant.expiry_transaction_id), 0);
  v_amount := v_grant.amount_paise - v_expired;
  if v_amount <= 0 then
    raise exception 'Nothing of it left to take back: it expired' using errcode = 'RVNIL';
  end if;
  select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
         array_agg(g.expires_at order by g.created_at, g.id)
  into v_ids, v_remaining, v_expires
  from (    select g.id, g.created_at, g.remaining_paise, private.bonus_end_in_force(g.venue_id, g.expires_at) as expires_at
          from public.bonus_grant g where g.member_id = v_grant.member_id and g.expired_at is null for update) g;
  select t.taken, t.owed into v_taken, v_owed
  from private.bonus_takes(v_amount, v_remaining, v_expires, now(), array_position(v_ids, v_grant.id)) t;
  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    continue when v_taken[i] = 0;
    update public.bonus_grant set remaining_paise = remaining_paise - v_taken[i] where id = v_ids[i];
  end loop;
  v_txn := private.post_ledger_transaction(v_grant.venue_id, 'bonus_reversal', 'bonus_reversal:' || v_grant.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_grant.member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_grant.venue_id
                                         and a.code = 'venue.bonus_expense' and a.member_id is null), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus reversed');
  update public.bonus_grant
  set reversed_at = now(), reversal_transaction_id = v_txn, reversal_reason = btrim(p_reason), reversal_paise = v_amount,
      reversed_by_staff_id = private.current_staff_id(v_grant.venue_id)
  where id = v_grant.id;
  -- A promotion's Bonus reversed frees the promotion (the owner, 19 Nov): its limits, its budget and MIS no longer count it.
  update public.promotion_grant set status = 'reversed' where bonus_grant_id = v_grant.id and status = 'given';
  if v_owed > 0 then
    insert into public.bonus_owed (venue_id, member_id, kind, amount_paise, bonus_grant_id)
    values (v_grant.venue_id, v_grant.member_id, 'reversal', v_owed, v_grant.id);
  end if;
  perform private.audit(v_grant.venue_id, 'bonus.reverse', 'member', v_grant.member_id::text, null,
                        jsonb_build_object('bonus_grant_id', v_grant.id, 'chips', v_amount / 100, 'owed_chips', v_owed / 100), btrim(p_reason));
  perform private.emit(v_grant.venue_id, 'bonus.reversed',
                       jsonb_build_object('bonus_grant_id', v_grant.id, 'member_id', v_grant.member_id, 'amount_paise', v_amount, 'owed_paise', v_owed),
                       'bonus.reversed:' || v_grant.id);
  return v_amount;
end;
$function$;

-- A use a seat missed, added to that seat; past the Bonus in force, or with some owed, by a super admin alone.
CREATE OR REPLACE FUNCTION private.add_bonus_use(p_session_id uuid, p_chips integer, p_reason text, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_amount bigint := p_chips::bigint * 100;
  v_replay public.bonus_redemption;
  v_is_kept boolean;
  v_ids uuid[];
  v_remaining bigint[];
  v_expires timestamptz[];
  v_taken bigint[];
  v_owed bigint;
  v_txn uuid;
  v_table_name text;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'bonus.correct') then
    raise exception 'Only super admins and cashiers add a missed Bonus use' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_session.member_id) or coalesce(private.is_own_kyc_check(v_session.member_id), false) then
    raise exception 'Staff never add a Bonus use to their own record' using errcode = 'RVOWN';
  end if;
  if p_chips is null or p_chips < 50 or p_chips > 100000 or p_chips % 50 <> 0 then
    raise exception 'Whole fifties from 50 to 1,00,000 chips' using errcode = 'RVCHP';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id, 'promotions', v_session.member_id);
  perform private.assert_rate(v_session.venue_id, 'bonus.use_add');
  -- An erasure that came first has closed the record.
  perform 1 from public.member m where m.id = v_session.member_id and m.erased_at is null for share;
  v_is_kept := found;
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || v_session.member_id::text, 0));
  -- Under the member's lock, so the same request at once is answered as one.
  select * into v_replay from public.bonus_redemption r where r.id = p_request_id;
  if v_replay.id is not null then
    if v_replay.session_id is distinct from p_session_id or v_replay.amount_paise <> v_amount then
      raise exception 'That request id was used for another Bonus use' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  if not v_is_kept or not exists (select 1 from private.bonus_use_seats(v_session.venue_id, v_session.member_id) u where u.session_id = p_session_id) then
    raise exception 'A seat of the member''s, past its Undo' using errcode = '22023';
  end if;
  select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
         array_agg(g.expires_at order by g.created_at, g.id)
  into v_ids, v_remaining, v_expires
  from (    select g.id, g.created_at, g.remaining_paise, private.bonus_end_in_force(g.venue_id, g.expires_at) as expires_at
          from public.bonus_grant g where g.member_id = v_session.member_id and g.expired_at is null for update) g;
  select t.taken, t.owed into v_taken, v_owed from private.bonus_takes(v_amount, v_remaining, v_expires, now(), null) t;
  if (v_owed > 0 or private.bonus_owed_by(v_session.member_id) > 0) and not coalesce(private.is_super_admin(v_session.venue_id), false) then
    raise exception 'More than the Bonus in force' using errcode = 'RVBON';
  end if;
  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    continue when v_taken[i] = 0;
    update public.bonus_grant set remaining_paise = remaining_paise - v_taken[i] where id = v_ids[i];
  end loop;
  v_txn := private.post_ledger_transaction(v_session.venue_id, 'bonus_buy_in', 'bonus_buy_in:' || p_request_id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_session.member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_session.venue_id
                                         and a.code = 'venue.chips_outstanding'), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus use added');
  insert into public.bonus_redemption (id, venue_id, member_id, session_id, table_id, amount_paise, ledger_transaction_id, staff_id, reason, used_at)
  values (p_request_id, v_session.venue_id, v_session.member_id, v_session.id, v_session.table_id, v_amount, v_txn,
          private.current_staff_id(v_session.venue_id), btrim(p_reason), v_session.started_at);
  if v_owed > 0 then
    insert into public.bonus_owed (venue_id, member_id, kind, amount_paise, bonus_redemption_id)
    values (v_session.venue_id, v_session.member_id, 'use', v_owed, p_request_id);
  end if;
  select t.name into v_table_name from public.game_table t where t.id = v_session.table_id;
  perform private.audit(v_session.venue_id, 'bonus.use_add', 'member', v_session.member_id::text, null,
                        jsonb_build_object('chips', p_chips, 'bonus_redemption_id', p_request_id, 'session_id', p_session_id,
                                           'table_name', v_table_name, 'owed_chips', v_owed / 100), btrim(p_reason));
  perform private.emit(v_session.venue_id, 'bonus.use_added',
                       jsonb_build_object('bonus_redemption_id', p_request_id, 'member_id', v_session.member_id, 'amount_paise', v_amount,
                                          'session_id', p_session_id, 'owed_paise', v_owed),
                       'bonus.use_added:' || p_request_id);
  return p_request_id;
end;
$function$;

-- The seats such a use may be added to, for those who add one.
create or replace function private.bonus_use_seats(p_venue_id uuid, p_member_id uuid)
returns table (session_id uuid, table_name text, seat integer, started_at timestamptz, ended_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, t.name, s.seat, s.started_at, s.ended_at
  from public.visit v
  join public.seat_session s on s.visit_id = v.id
  join public.game_table t on t.id = s.table_id
  where v.member_id = p_member_id and v.venue_id = p_venue_id and (select private.has_permission(p_venue_id, 'bonus.correct'))
    and not private.is_undoable(s.started_at)
  order by s.started_at desc, s.id;
$$;
