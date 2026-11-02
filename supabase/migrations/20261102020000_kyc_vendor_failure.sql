-- Why a KYC vendor call failed (#704; UI polish audit K-04, K-10). On staging on 2 Nov Cashfree refused every DigiLocker
-- start (the return address was not https) and the kyc function answered 502 with nothing kept to say why. Functions do
-- not log (no-console), so the reason is kept with the member's check: the step and Cashfree's error code, never its
-- message, which can carry what was sent. Like the vendor's scores it stays with the server: members are not granted it.

alter table public.kyc_record
  add column vendor_failure text check (length(vendor_failure) between 1 and 200),
  add column vendor_failed_at timestamptz,
  add constraint kyc_record_vendor_failure_dated check ((vendor_failure is null) = (vendor_failed_at is null));

comment on column public.kyc_record.vendor_failure is
  'The last vendor call that failed: its step and Cashfree''s error code, such as `start: Cashfree redirect_url_value_invalid` (#704).';

-- The kyc function's note, as the server, when a vendor call fails: the step (selfie, start, complete, pan) and the
-- failure (`Cashfree <code>`, `unavailable`, `rate_limited`). Any other step, or a blank reason, notes nothing.
create function public.note_kyc_vendor_failure(p_member_id uuid, p_step text, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kyc_record
  set vendor_failure = left(btrim(p_step) || ': ' || btrim(p_reason), 200), vendor_failed_at = now()
  where member_id = p_member_id and p_step in ('selfie', 'start', 'complete', 'pan') and coalesce(btrim(p_reason), '') <> '';
$$;

revoke execute on function public.note_kyc_vendor_failure(uuid, text, text) from public, anon, authenticated;
grant execute on function public.note_kyc_vendor_failure(uuid, text, text) to service_role;

-- A member's export gives why a vendor call failed as a staff note, beside the check's other notes (151_member_export).
insert into private.member_export_column (table_name, column_name, kind) values
  ('kyc_record', 'vendor_failure', 'note'), ('kyc_record', 'vendor_failed_at', 'note');

-- Erasure keeps the KYC record with the PAN alone where TDS was taken (20261027130000_member_erasure.sql): as there, with
-- why a vendor call failed gone too.
create or replace function private.anonymise_member(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payout_account p set removed_at = now() where p.member_id = p_member.id and p.removed_at is null;
  update public.consent c set withdrawn_at = now() where c.member_id = p_member.id and c.withdrawn_at is null;
  if exists (select 1 from public.tds_withholding t where t.member_id = p_member.id)
     or exists (select 1 from public.tournament_payout t where t.member_id = p_member.id and t.tds_paise > 0) then
    update public.kyc_record k
    set status = 'erased', refusal = null, verified_at = null, digilocker_session_id = null, date_of_birth = null, masked_aadhaar = null,
        address = null, vendor_reference = null, photo_path = null, liveness_score = null, face_match_score = null,
        aadhaar_reference = null, same_face_as = null, selfie_claimed_at = null, identity_key = null,
        vendor_failure = null, vendor_failed_at = null
    where k.member_id = p_member.id and k.status <> 'erased';
  else
    delete from public.kyc_record k where k.member_id = p_member.id;
  end if;
  update public.member m
  set full_name = 'Erased member', phone = null, user_id = null, qualifying_small_blind = null, qualifying_big_blind = null,
      erased_at = coalesce(m.erased_at, now())
  where m.id = p_member.id
    and (m.full_name <> 'Erased member' or m.phone is not null or m.user_id is not null or m.qualifying_small_blind is not null
         or m.erased_at is null);
end;
$$;

-- The practice venue's seed is captured again with the new columns (database.md, decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
