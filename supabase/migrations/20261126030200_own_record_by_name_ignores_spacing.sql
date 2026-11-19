-- A staff member's own record by name ignores spacing as well as case (#1019): "Vikram  Rao" with two spaces is Vikram
-- Rao's own record too, as is one with a tab, a line break or a no-break space, as every run of spaces becomes one before
-- the ends are trimmed, so a doubled or stray space no longer lets staff decide their own check or give themselves
-- Bonus (RVOWN; give_bonus_chips and the rest ask this function). Otherwise as 20261018092300_kyc_review.sql made it.
CREATE OR REPLACE FUNCTION private.is_own_kyc_check(p_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_member_id = private.current_member_id()
    or exists (select 1
               from public.member m join public.staff s on s.user_id = (select auth.uid())
               where m.id = p_member_id
                 and (s.phone = m.phone or lower(btrim(regexp_replace(s.full_name, '[[:space:]' || chr(160) || chr(8203) || chr(8239) || chr(65279) || ']+', ' ', 'g')))
                      = lower(btrim(regexp_replace(m.full_name, '[[:space:]' || chr(160) || chr(8203) || chr(8239) || chr(65279) || ']+', ' ', 'g')))));
$function$;
