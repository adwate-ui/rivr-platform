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
-- failure (`Cashfree <code>`, `unavailable`, `rate_limited`). A blank step or reason notes nothing.
create function public.note_kyc_vendor_failure(p_member_id uuid, p_step text, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kyc_record
  set vendor_failure = left(btrim(p_step) || ': ' || btrim(p_reason), 200), vendor_failed_at = now()
  where member_id = p_member_id and coalesce(btrim(p_step), '') <> '' and coalesce(btrim(p_reason), '') <> '';
$$;

revoke execute on function public.note_kyc_vendor_failure(uuid, text, text) from public, anon, authenticated;
grant execute on function public.note_kyc_vendor_failure(uuid, text, text) to service_role;
