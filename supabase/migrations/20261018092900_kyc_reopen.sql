-- A super admin reopens a check done in person that was refused as a duplicate (#267, the owner's
-- answer to #255). A real person wrongly matched by hand (the same last four Aadhaar digits and date
-- of birth as a verified member, or a detail typed wrong) can then be checked in person again,
-- through the same gate, by another reviewer. Only super admins (members.override_features, which no
-- other role may hold), never for their own record, and with a reason the audit log keeps for good:
-- so it holds no digit at all, and never a document number or a date of birth.

create function private.reopen_kyc_check(p_member_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.kyc_record;
begin
  select * into v_record from public.kyc_record k where k.member_id = p_member_id for update;
  if v_record.id is null or not private.has_permission(v_record.venue_id, 'members.override_features')
     or private.is_own_kyc_check(p_member_id) is true then
    raise exception 'Only a super admin reopens a check, never their own' using errcode = '42501';
  end if;
  -- Only a duplicate: under 18 and a reviewer's rejection stand.
  if v_record.status <> 'refused' or v_record.method <> 'manual' or v_record.refusal not in ('duplicate_aadhaar', 'duplicate_pan') then
    raise exception 'Only a check done in person and refused as a duplicate is reopened' using errcode = 'RVKYC';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[0-9०-९]' then
    raise exception 'A reopening needs its reason, in words, with no digits' using errcode = '22023';
  end if;
  perform private.assert_writable(v_record.venue_id, null, p_member_id);
  -- The audit log keeps the reason with the change (private.audit reads rivr.audit_reason).
  perform set_config('rivr.audit_reason', trim(p_reason), true);
  update public.kyc_record set status = 'started', refusal = null, verified_at = null where id = v_record.id;
  perform set_config('rivr.audit_reason', '', true);
end;
$$;

-- Whoever reopened a check never does the check that follows: it counts as a member they changed.
create or replace function private.changed_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.audit_log a
                 where a.entity = 'member' and a.entity_id = p_member_id::text and a.actor_user_id = (select auth.uid()))
      or exists (select 1 from public.audit_log a
                 where a.entity = 'kyc_record' and a.actor_user_id = (select auth.uid())
                   and a.after ->> 'member_id' = p_member_id::text
                   and a.before ->> 'status' = 'refused' and a.after ->> 'status' = 'started');
$$;

grant execute on function private.reopen_kyc_check(uuid, text) to authenticated;

create function public.reopen_kyc_check(p_member_id uuid, p_reason text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.reopen_kyc_check(p_member_id, p_reason);
$$;

grant execute on function public.reopen_kyc_check(uuid, text) to authenticated;
