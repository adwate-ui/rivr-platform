-- A DigiLocker check that comes back is verified at once (decision 0400; the owner, 3 Nov: "if the DigiLocker
-- verification is successful, KYC must be approved immediately"). DigiLocker's Aadhaar, with its date of birth,
-- and a selfie the vendor matches to the Aadhaar's photo are the member's identity: it is kept and the check is
-- verified. The Aadhaar's name no longer has to be the registered name letter for letter (the owner's own check
-- waited for that), and a DigiLocker without a PAN no longer waits for one: the PAN step is for a DigiLocker that
-- failed. private.settle_kyc still refuses under 18 and a PAN a verified member holds, and still holds a check with
-- another member's identity key for a KYC reviewer. A face that is not the selfie's is someone else's Aadhaar: the
-- check waits for staff and keeps none of that identity, as before.
--
-- As in 20261027000400_kyc_on_cashfree.sql, without the name match.
drop function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, boolean, integer, text);
create function public.record_kyc_digilocker(
  p_member_id uuid, p_date_of_birth date, p_masked_aadhaar text, p_aadhaar_reference text, p_pan text, p_address text,
  p_vendor_reference text, p_face_matches boolean, p_face_match_score integer, p_identity_key text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_members_face boolean := coalesce(p_face_matches, false);
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set date_of_birth = case when v_is_members_face then p_date_of_birth end,
      masked_aadhaar = case when v_is_members_face then p_masked_aadhaar end,
      aadhaar_reference = case when v_is_members_face then private.kyc_reference(p_aadhaar_reference) end,
      identity_key = case when v_is_members_face and p_identity_key is not null then private.kyc_reference(p_identity_key) end,
      pan = case when v_is_members_face then p_pan end,
      address = case when v_is_members_face then p_address end,
      vendor_reference = p_vendor_reference,
      face_match_score = p_face_match_score
  where member_id = p_member_id and status = 'started' and photo_path is not null;
  if not found then return null; end if;
  return private.settle_kyc(p_member_id, case
    when v_is_members_face and p_date_of_birth is not null then 'verified'
    else 'needs_review'
  end);
end;
$$;
revoke execute on function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, integer, text)
  to service_role;
