-- Erasure forfeits a member's locked points too (#645, from the money audit): they go back to the points issued, as
-- earned points do, in a transaction of their own, and the preview and the erasure count them with the points. And an
-- erasure at a live venue tells the CRM (#647), whose consumer deletes the member's contact: erasure reaches the vendors
-- that hold the member's data, where before it sent nothing out.

-- As in 20261028380200_hotel_nights_catalogue.sql, with the locked points.
create or replace function private.forfeit_member_rewards(p_member public.member)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points bigint;
  v_locked bigint;
  v_bonus bigint;
  v_nights bigint;
  v_points_txn uuid;
  v_locked_txn uuid;
  v_bonus_txn uuid;
  v_nights_txn uuid;
begin
  perform 1 from public.bonus_grant g where g.member_id = p_member.id and g.expired_at is null for update;
  v_points := -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.points'));
  v_locked := coalesce(-private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.points_locked')), 0);
  v_bonus := -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'));
  v_nights := coalesce(-private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.nights')), 0);
  if v_points > 0 then
    v_points_txn := private.post_points(p_member.venue_id, p_member.id, -v_points, 'member_erasure_forfeit', 'Forfeited on erasure',
                                        'member_erasure_forfeit:points:' || p_member.id);
  end if;
  if v_locked > 0 then
    v_locked_txn := private.post_ledger_transaction(p_member.venue_id, 'member_erasure_forfeit', 'member_erasure_forfeit:points_locked:' || p_member.id,
      jsonb_build_array(
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.points_locked'),
                           'amount', v_locked::text),
        jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                           where a.venue_id = p_member.venue_id and a.code = 'venue.points_issued' and a.member_id is null),
                           'amount', (-v_locked)::text)),
      null, 'Forfeited on erasure');
  end if;
  if v_bonus > 0 then
    v_bonus_txn := private.post_ledger_transaction(p_member.venue_id, 'member_erasure_forfeit', 'member_erasure_forfeit:bonus:' || p_member.id,
      jsonb_build_array(
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'),
                           'amount', v_bonus::text),
        jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                           where a.venue_id = p_member.venue_id and a.code = 'venue.bonus_expense' and a.member_id is null),
                           'amount', (-v_bonus)::text)),
      null, 'Forfeited on erasure');
  end if;
  if v_nights > 0 then
    v_nights_txn := private.post_nights(p_member.venue_id, p_member.id, -v_nights, 'member_erasure_forfeit', 'Forfeited on erasure',
                                        'member_erasure_forfeit:nights:' || p_member.id);
  end if;
  -- As the expiry job does, a grant with nothing left names no transaction.
  update public.bonus_grant g
  set remaining_paise = 0, expired_at = now(), expiry_transaction_id = case when g.remaining_paise > 0 then v_bonus_txn end
  where g.member_id = p_member.id and g.expired_at is null;
  return jsonb_build_object('points', greatest(v_points, 0) + greatest(v_locked, 0), 'bonus_paise', greatest(v_bonus, 0),
                            'nights_thousandths', greatest(v_nights, 0),
                            'forfeit_transactions', to_jsonb(array_remove(array[v_points_txn, v_locked_txn, v_bonus_txn, v_nights_txn], null)));
end;
$$;

-- As in 20261028380300_erasure_shows_nights.sql, with the locked points counted among the points.
create or replace function private.member_erasure_preview(p_member_id uuid)
returns table (is_erased boolean, blockers text[], points bigint, bonus_paise bigint, blocked_until timestamptz, kyc_files integer, nights bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.erased_at is not null, private.member_erasure_blockers(m.id),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.points')), 0)
           + coalesce(greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.points_locked')), 0), 0),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.bonus')), 0),
         (select r.break_until from private.member_restrictions(m.id, now()) r),
         (select count(*)::integer from storage.objects o
          where o.bucket_id = 'kyc' and o.name like m.venue_id::text || '/' || m.id::text || '/%'),
         coalesce(greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.nights')), 0), 0)
  from public.member m
  where m.id = p_member_id and private.has_permission(m.venue_id, 'members.erase');
$$;

-- As in 20261028380300_erasure_shows_nights.sql, telling the CRM.
create or replace function private.erase_member(p_member_id uuid, p_full_name text, p_reason text)
returns table (venue_id uuid, forfeited_points bigint, forfeited_bonus_paise bigint, blocked_until timestamptz, forfeited_nights bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_summary jsonb;
begin
  select * into v_member from public.member m where m.id = p_member_id;
  if v_member.id is null or not private.has_permission(v_member.venue_id, 'members.erase') then
    raise exception 'Only a super admin erases a member' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('member-erase:' || v_member.venue_id::text));
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.erased_at is not null then
    raise exception 'This member was erased already' using errcode = 'RVERD';
  end if;
  if btrim(coalesce(p_full_name, '')) is distinct from v_member.full_name then
    raise exception 'Type the member''s full name exactly to erase them' using errcode = 'RVNAM';
  end if;
  if not private.is_safe_erasure_reason(v_reason, v_member.full_name) then
    raise exception 'Give a reason of 3 to 300 characters with nothing of the person in it' using errcode = '22023';
  end if;
  if (select count(*) from public.audit_log a
      where a.venue_id = v_member.venue_id and a.action = 'member.erase' and a.occurred_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten members were erased in the last hour: wait before erasing another' using errcode = 'RVRAT';
  end if;
  v_summary := private.carry_out_erasure(p_member_id, v_reason);
  -- Erasure reaches the CRM (#647): its consumer deletes the contact. The event names only the member's id, and the practice
  -- venue, whose events reach no consumer, sends nothing.
  if not exists (select 1 from public.venue v where v.id = v_member.venue_id and v.is_practice) then
    perform private.emit(v_member.venue_id, 'member.erased', jsonb_build_object('member_id', p_member_id), 'member.erased:' || p_member_id);
  end if;
  return query select (v_summary ->> 'venue_id')::uuid, (v_summary ->> 'points')::bigint, (v_summary ->> 'bonus_paise')::bigint,
                      (v_summary ->> 'blocked_until')::timestamptz, coalesce((v_summary ->> 'nights_thousandths')::bigint, 0);
end;
$$;
