-- A KYC vendor call that is not paid still makes the member's check (decision 0671). Zoop checks no liveness, so the
-- selfie passes the gate as an unpaid call, and the gate returned before it made the member's kyc_record: a new member's
-- selfie then found no record to claim, and every one was refused. The record is now made before that return, as it was
-- for a paid call; nothing else changes.

-- As 20261114193758_kyc_vendor_calls_wait_for_the_desk.sql made it, making the record before an unpaid call returns.
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
  insert into public.kyc_record (venue_id, member_id) values (v_venue_id, p_member_id) on conflict (member_id) do nothing;
  if not p_is_paid then return; end if;
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
