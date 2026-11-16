-- The re-check breaker trips once in a row for a reason (#1033; decision 0674). kyc-recheck pauses every re-check when one
-- refusal reason turns down three checks in a run, as when Zoop refuses the account. Checks are claimed oldest first, so
-- three real checks Zoop turns down alike would come first again after each pause, trip it again, and the checks behind
-- them would never be asked. So a reason that paused the re-checks last time pauses nothing when it trips again: the
-- function counts the three checks that tripped it (the third refusal ends each one's re-check) and goes on, still armed
-- for that reason: three more checks turned down alike in the same run pause the re-checks outright (pause_kyc_rechecks).

-- For the kyc-recheck function (service role): true when the re-checks are paused for the reason, false when that same
-- reason paused them last time, ending within the day (a fault days later trips afresh).
create function private.trip_kyc_recheck_breaker(p_member_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.kyc_recheck_pause p
             where p.reason = left(coalesce(p_reason, ''), 200) and p.paused_until > now() - interval '1 day') then
    return false;
  end if;
  perform private.pause_kyc_rechecks(p_member_id, p_reason);
  return true;
end;
$$;

create function public.trip_kyc_recheck_breaker(p_member_id uuid, p_reason text)
returns boolean language sql volatile security invoker set search_path = ''
as $$ select private.trip_kyc_recheck_breaker(p_member_id, p_reason); $$;

revoke execute on function private.trip_kyc_recheck_breaker(uuid, text), public.trip_kyc_recheck_breaker(uuid, text)
  from public, anon, authenticated;
grant execute on function private.trip_kyc_recheck_breaker(uuid, text), public.trip_kyc_recheck_breaker(uuid, text)
  to service_role;
