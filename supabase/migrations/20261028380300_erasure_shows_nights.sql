-- The erasure preview and an erasure's result show the hotel nights forfeited (#535, from the reviews of #146).
-- Since 20261028380200_hotel_nights_catalogue.sql erasure forfeits a member's nights (thousandths, decision 0246), but
-- the super admin was shown only the points and bonus.

-- As before (20261027200100_member_erasure_kyc_files.sql), with the nights, in thousandths, an erasure would forfeit.
drop function public.member_erasure_preview(uuid);
drop function private.member_erasure_preview(uuid);
create function private.member_erasure_preview(p_member_id uuid)
returns table (is_erased boolean, blockers text[], points bigint, bonus_paise bigint, blocked_until timestamptz, kyc_files integer, nights bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.erased_at is not null, private.member_erasure_blockers(m.id),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.points')), 0),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.bonus')), 0),
         (select r.break_until from private.member_restrictions(m.id, now()) r),
         (select count(*)::integer from storage.objects o
          where o.bucket_id = 'kyc' and o.name like m.venue_id::text || '/' || m.id::text || '/%'),
         coalesce(greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.nights')), 0), 0)
  from public.member m
  where m.id = p_member_id and private.has_permission(m.venue_id, 'members.erase');
$$;
create function public.member_erasure_preview(p_member_id uuid)
returns table (is_erased boolean, blockers text[], points bigint, bonus_paise bigint, blocked_until timestamptz, kyc_files integer, nights bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_erasure_preview(p_member_id); $$;

-- As before (20261027130000_member_erasure.sql), with the nights, in thousandths, the erasure forfeited.
drop function public.erase_member(uuid, text, text);
drop function private.erase_member(uuid, text, text);
create function private.erase_member(p_member_id uuid, p_full_name text, p_reason text)
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
  return query select (v_summary ->> 'venue_id')::uuid, (v_summary ->> 'points')::bigint, (v_summary ->> 'bonus_paise')::bigint,
                      (v_summary ->> 'blocked_until')::timestamptz, coalesce((v_summary ->> 'nights_thousandths')::bigint, 0);
end;
$$;
create function public.erase_member(p_member_id uuid, p_full_name text, p_reason text)
returns table (venue_id uuid, forfeited_points bigint, forfeited_bonus_paise bigint, blocked_until timestamptz, forfeited_nights bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.erase_member(p_member_id, p_full_name, p_reason); $$;

revoke execute on function private.erase_member(uuid, text, text), private.member_erasure_preview(uuid), public.erase_member(uuid, text, text),
  public.member_erasure_preview(uuid) from public, anon;
grant execute on function private.erase_member(uuid, text, text), private.member_erasure_preview(uuid), public.erase_member(uuid, text, text),
  public.member_erasure_preview(uuid) to authenticated;
