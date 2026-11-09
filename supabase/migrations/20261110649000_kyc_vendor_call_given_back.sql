-- A paid vendor call that failed on the vendor's side is given back, so it does not use up one of the member's five a day (the
-- owner, 9 Nov, on #791). The kyc function calls this, as the server, once for each call that failed.
create function public.give_back_kyc_vendor_call(p_member_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kyc_record set vendor_calls = greatest(vendor_calls - 1, 0) where member_id = p_member_id;
$$;

revoke execute on function public.give_back_kyc_vendor_call(uuid) from public, anon, authenticated;
grant execute on function public.give_back_kyc_vendor_call(uuid) to service_role;
