-- When Zoop does not verify a member, their check goes to the desk, as it does while the venue checks identity at the club
-- (the owner, 16 Nov 2026; decision 0678). record_kyc_digilocker_failed sent the member to a PAN check (needs_pan), whose
-- PAN alone then waited for a KYC reviewer while the member was kept out of the app. It now marks the check to wait for the
-- desk instead: still started, with at_club_from, so the member is let into the app, may join a waitlist, and the floor
-- checks their ID in person on the first visit (decisions 0502, 0503). The DigiLocker session ends with it, and so does
-- anything delivered for it (20261122170000's trigger). True when the check went to the desk.

drop function public.record_kyc_digilocker_failed(uuid);
create function public.record_kyc_digilocker_failed(p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set digilocker_session_id = null, at_club_from = coalesce(at_club_from, now())
  where member_id = p_member_id and status = 'started';
  return found;
end;
$$;
revoke execute on function public.record_kyc_digilocker_failed(uuid) from public, anon, authenticated;
grant execute on function public.record_kyc_digilocker_failed(uuid) to service_role;

-- Checks held for a PAN check after a DigiLocker that failed wait for the desk instead, as a new failure now does, keeping
-- nothing from the attempt, as take_kyc_at_the_club does for them while the venue checks at the club (none on production
-- on 16 Nov 2026; staging's are test members).
update public.kyc_record
set status = 'started', method = 'digilocker', at_club_from = coalesce(at_club_from, now()), refusal = null, verified_at = null,
    date_of_birth = null, masked_aadhaar = null, pan = null, address = null, aadhaar_reference = null, identity_key = null,
    aadhaar_name = null, vendor_reference = null, liveness_score = null, face_match_score = null, digilocker_session_id = null,
    vendor_failure = null, vendor_failed_at = null, pan_recheck = null, pan_rechecked_at = null
where status = 'needs_pan';
