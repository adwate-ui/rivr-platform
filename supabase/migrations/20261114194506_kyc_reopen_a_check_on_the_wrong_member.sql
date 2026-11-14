-- A desk check saved on the wrong member (the trial run, 13 Nov; decision 0583). The desk picked one member and entered
-- another's documents: the first was verified on them, and the second, checked next, was refused as a duplicate for ever,
-- as a verified check was never reopened. A super admin now reopens a verified check done in person too, with the reason:
-- what the desk entered goes (the date of birth, the Aadhaar digits, the PAN, the photo and the documents), and the member
-- waits for the desk again. A check the vendor verified stays as it was. And staff are told which member holds the
-- documents a duplicate clashed with, so the mistake is seen at the desk.

-- As 20261108110000_kyc_at_the_club.sql made it, with a verified check done in person.
create or replace function private.reopen_kyc_check(p_member_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.kyc_record;
  v_is_held_by_vendor boolean;
  v_is_verified_in_person boolean;
begin
  select * into v_record from public.kyc_record k where k.member_id = p_member_id for update;
  if v_record.id is null or not private.has_permission(v_record.venue_id, 'members.override_features')
     or private.is_own_kyc_check(p_member_id) is true then
    raise exception 'Only a super admin reopens a check, never their own' using errcode = '42501';
  end if;
  v_is_held_by_vendor := v_record.method in ('digilocker', 'pan')
    and (v_record.status = 'needs_review'
         or (v_record.status = 'refused' and v_record.refusal in ('duplicate_aadhaar', 'duplicate_pan')))
    and private.kyc_at_the_club(v_record.venue_id, now());
  v_is_verified_in_person := v_record.status = 'verified' and v_record.method = 'manual';
  -- Otherwise only a duplicate done in person: under 18 and a reviewer's rejection stand.
  if not v_is_held_by_vendor and not v_is_verified_in_person
     and (v_record.status <> 'refused' or v_record.method <> 'manual' or v_record.refusal not in ('duplicate_aadhaar', 'duplicate_pan')) then
    raise exception 'Only a check done in person is reopened, or one the vendor held while the club checks identity'
      using errcode = 'RVKYC';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[0-9०-९]' then
    raise exception 'A reopening needs its reason, in words, with no digits' using errcode = '22023';
  end if;
  perform private.assert_writable(v_record.venue_id, null, p_member_id);
  -- The audit log keeps the reason with the change (private.audit reads rivr.audit_reason).
  perform set_config('rivr.audit_reason', trim(p_reason), true);
  if v_is_held_by_vendor then
    update public.kyc_record
    -- Stamped with the day their check began, not today: they registered then, so the bonus of that day is theirs.
    set status = 'started', refusal = null, verified_at = null, at_club_from = coalesce(at_club_from, created_at),
        date_of_birth = null, masked_aadhaar = null, pan = null, address = null, aadhaar_reference = null, identity_key = null,
        aadhaar_name = null, vendor_reference = null, liveness_score = null, face_match_score = null, same_face_as = null,
        digilocker_session_id = null, vendor_failure = null, vendor_failed_at = null, pan_recheck = null, pan_rechecked_at = null
    where id = v_record.id;
  elsif v_is_verified_in_person then
    -- What the desk entered may be someone else's: none of it stays, and the files go at the member's next check. While the
    -- club checks identity at the desk they stay let into the app, as one whose selfie came in the day their check began.
    update public.kyc_record
    set status = 'started', refusal = null, verified_at = null, date_of_birth = null, masked_aadhaar = null, pan = null,
        photo_path = null, pan_recheck = null, pan_rechecked_at = null,
        at_club_from = case when private.kyc_at_the_club(v_record.venue_id, now()) then coalesce(at_club_from, created_at) else at_club_from end
    where id = v_record.id;
    delete from public.kyc_document d where d.member_id = p_member_id;
  else
    update public.kyc_record set status = 'started', refusal = null, verified_at = null where id = v_record.id;
  end if;
  perform set_config('rivr.audit_reason', '', true);
end;
$$;

-- As 20261108110000_kyc_at_the_club.sql made it: whoever reopened a verified check does not do the check that follows either.
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
                   and a.before ->> 'status' in ('refused', 'needs_review', 'verified') and a.after ->> 'status' = 'started');
$$;

-- The verified member whose documents a check refused as a duplicate clashed with, by the rules of private.kyc_refusal:
-- for staff who check members, so the desk sees a check saved on the wrong member. Nothing for any other check.
create function private.kyc_duplicate_holder(p_member_id uuid)
returns table (member_number bigint, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.member_number, m.full_name
  from public.kyc_record k
  join public.kyc_record o on o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified'
    and (o.pan = k.pan or o.aadhaar_reference = k.aadhaar_reference
         or ('manual' in (o.method, k.method) and o.masked_aadhaar = k.masked_aadhaar and o.date_of_birth = k.date_of_birth))
  join public.member m on m.id = o.member_id
  where k.member_id = p_member_id and k.status = 'refused' and k.refusal in ('duplicate_pan', 'duplicate_aadhaar')
    and (private.has_permission(k.venue_id, 'kyc.in_person') or private.has_permission(k.venue_id, 'kyc.review'))
  order by o.verified_at
  limit 1;
$$;
create function public.kyc_duplicate_holder(p_member_id uuid)
returns table (member_number bigint, full_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.kyc_duplicate_holder(p_member_id); $$;
revoke execute on function private.kyc_duplicate_holder(uuid), public.kyc_duplicate_holder(uuid) from public, anon;
grant execute on function private.kyc_duplicate_holder(uuid), public.kyc_duplicate_holder(uuid) to authenticated;
