-- Home's tonight without the jackpot (#1019): no app reads my_tonight's jackpot_paise. A column leaves a function's
-- result only by making the function again, so both are dropped and made as
-- 20261120200000_tournaments_interest_and_notify.sql made them, less the jackpot, with its grants.
drop function public.my_tonight();
drop function private.my_tonight();

CREATE OR REPLACE FUNCTION private.my_tonight()
 RETURNS TABLE(is_kyc_complete boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.is_kyc_complete(me.member_id)
  from (select private.current_member_id() as member_id) me
  where me.member_id is not null;
$function$;

CREATE OR REPLACE FUNCTION public.my_tonight()
 RETURNS TABLE(is_kyc_complete boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.my_tonight(); $function$;

revoke execute on function private.my_tonight(), public.my_tonight() from public, anon;
grant execute on function private.my_tonight(), public.my_tonight() to authenticated;
