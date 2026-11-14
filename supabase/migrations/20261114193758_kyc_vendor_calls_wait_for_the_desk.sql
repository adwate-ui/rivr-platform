-- While a venue checks identity at the club (decision 0502), no check goes to the KYC vendor. Only the app's screen kept
-- to that: a phone still running a copy of the app from before the switch sent its member through the vendor, whose
-- sandbox verified them under its test identity (the trial run, 13 Nov; decision 0583). The gate every vendor call passes
-- now refuses, as it does while KYC sign-up is stopped (RVKIL: the app says the check is stopped). The selfie that lets a
-- member in (take_kyc_at_the_club) and the desk's check (check_kyc_in_person) make no vendor call and are untouched.

-- As 20261018091400_kyc_record.sql made it, refusing while the venue checks identity at the club.
create or replace function public.begin_kyc_vendor_call(p_member_id uuid, p_is_paid boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_calls integer;
begin
  perform private.assert_writable(v_venue_id, 'kyc_signup', p_member_id);
  if private.kyc_at_the_club(v_venue_id, now()) then
    raise exception 'Identity is checked at the club: nothing goes to the vendor' using errcode = 'RVKIL';
  end if;
  if not private.has_consent(p_member_id, 'kyc_verification') then
    raise exception 'The member has not consented to the identity check' using errcode = 'RVCON';
  end if;
  if not p_is_paid then return; end if;
  insert into public.kyc_record (venue_id, member_id) values (v_venue_id, p_member_id) on conflict (member_id) do nothing;
  update public.kyc_record
  set vendor_calls = case when vendor_calls_since < now() - interval '24 hours' then 1 else vendor_calls + 1 end,
      vendor_calls_since = case when vendor_calls_since < now() - interval '24 hours' then now() else vendor_calls_since end
  where member_id = p_member_id
  returning vendor_calls into v_calls;
  if v_calls > 5 then
    raise exception 'Too many identity checks today' using errcode = 'RVRAT';
  end if;
end;
$$;
