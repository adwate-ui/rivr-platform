-- Bonus chips added by hand (the owner, 8 Nov): a super admin adds bonus chips to a member's balance, with a reason. Any
-- whole fifty from 50 to 1,00,000 chips, with no daily cap (the owner's choice); never on their own member record. It
-- posts as every bonus does (venue.bonus_expense to member.bonus, under the promotions kill switch), the audit log keeps
-- who, how many and why, and the member's app says so (bonus.credited). The request id makes a retry the same grant,
-- audited once.
--
-- Refusals: 42501 not a super admin of the member's venue; RVOWN their own record; RVCHP not whole fifties from 50 to
-- 1,00,000; 22023 a reason not of 3 to 200 characters, or no request id; the venue frozen or promotions stopped as
-- assert_writable says.

create function private.give_bonus_chips(p_member_id uuid, p_chips integer, p_reason text, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_key text := 'bonus.hand:' || p_request_id;
  v_is_retry boolean;
  v_id uuid;
begin
  if v_venue_id is null or not private.is_super_admin(v_venue_id) then
    raise exception 'Only a super admin adds bonus chips' using errcode = '42501';
  end if;
  if private.is_own_cage_record(p_member_id) then
    raise exception 'Staff never add bonus chips to their own record' using errcode = 'RVOWN';
  end if;
  if p_chips is null or p_chips < 50 or p_chips > 100000 or p_chips % 50 <> 0 then
    raise exception 'Whole fifties from 50 to 1,00,000 chips' using errcode = 'RVCHP';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id, 'promotions', p_member_id);
  v_is_retry := exists (select 1 from public.bonus_grant g where g.venue_id = v_venue_id and g.idempotency_key = v_key);
  v_id := private.credit_bonus(v_venue_id, p_member_id, p_chips::bigint * 100, btrim(p_reason), null, v_key);
  if not v_is_retry then
    perform private.audit(v_venue_id, 'bonus.give', 'member', p_member_id::text, null,
                          jsonb_build_object('chips', p_chips, 'bonus_grant_id', v_id), btrim(p_reason));
  end if;
  return v_id;
end;
$$;

create function public.give_bonus_chips(p_member_id uuid, p_chips integer, p_reason text, p_request_id uuid)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.give_bonus_chips(p_member_id, p_chips, p_reason, p_request_id); $$;

revoke execute on function private.give_bonus_chips(uuid, integer, text, uuid), public.give_bonus_chips(uuid, integer, text, uuid)
  from public, anon;
grant execute on function private.give_bonus_chips(uuid, integer, text, uuid), public.give_bonus_chips(uuid, integer, text, uuid)
  to authenticated;
