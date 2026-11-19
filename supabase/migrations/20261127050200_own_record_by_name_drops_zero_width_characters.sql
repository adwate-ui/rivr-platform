-- A staff member's own record by name (#1019, the reviews of #1104): invisible characters are dropped before every run of
-- spaces becomes one: the soft hyphen, the grapheme joiner, the zero-width and direction marks (U+200B to U+200F), the
-- embeddings and overrides (U+202A to U+202E), U+2060 to U+2064, the isolates (U+2066 to U+2069), the variation
-- selectors (U+FE00 to U+FE0F) and U+FEFF, so "Vik\u200bram Rao" is Vikram Rao's own record
-- too. Before, the zero-width space became a space and the names differed. The live definition with the names'
-- normalising alone changed.

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
                 and (s.phone = m.phone or lower(btrim(regexp_replace(regexp_replace(s.full_name, '[' || chr(173) || chr(847) || chr(8203) || '-' || chr(8207) || chr(8234) || '-' || chr(8238) || chr(8288) || '-' || chr(8292) || chr(8294) || '-' || chr(8297) || chr(65024) || '-' || chr(65039) || chr(65279) || ']', '', 'g'), '[[:space:]' || chr(160) || chr(8239) || ']+', ' ', 'g')))
                      = lower(btrim(regexp_replace(regexp_replace(m.full_name, '[' || chr(173) || chr(847) || chr(8203) || '-' || chr(8207) || chr(8234) || '-' || chr(8238) || chr(8288) || '-' || chr(8292) || chr(8294) || '-' || chr(8297) || chr(65024) || '-' || chr(65039) || chr(65279) || ']', '', 'g'), '[[:space:]' || chr(160) || chr(8239) || ']+', ' ', 'g')))));
$function$;
