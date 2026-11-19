-- Staff's member search takes the typed text as text (#1019): `%` and `_` are no longer wildcards, so typing `%%` no
-- longer lists up to 200 members, and a text longer than 100 characters, which no name, number or mobile is, finds no
-- one. Otherwise as 20261110000000_member_phones.sql made it.
CREATE OR REPLACE FUNCTION private.member_search(p_venue_id uuid, p_query text)
 RETURNS TABLE(member_id uuid, member_number bigint, full_name text, phone text, tier_name text, visits integer, last_visit_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.id, m.member_number, m.full_name,
         case when private.has_permission(p_venue_id, 'members.change_phone') then m.phone end,
         t.name,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id)
  from public.member m
  join public.tier t on t.id = m.tier_id
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
    and length(coalesce(p_query, '')) <= 100
    -- The name is matched as typed: a backslash, `%` and `_` are escaped for ilike (whose escape is the backslash).
    -- A member number matches exactly, however short; a name from two characters. A mobile matches anywhere from four
    -- digits for staff who may read it; for other staff only its last four (which they see) or all ten, so trying digit
    -- after digit never spells out a number they may not read.
    and (m.member_number::text = trim(p_query)
         or (length(trim(coalesce(p_query, ''))) >= 2
             and (m.full_name ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
                  or (length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 4
                      and case when private.has_permission(p_venue_id, 'members.change_phone')
                               then m.phone like '%' || right(regexp_replace(p_query, '[^0-9]', '', 'g'), 10) || '%'
                               -- Ten digits or more is the whole number, +91 typed or not.
                               when length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 10
                               then right(m.phone, 10) = right(regexp_replace(p_query, '[^0-9]', '', 'g'), 10)
                               else length(regexp_replace(p_query, '[^0-9]', '', 'g')) = 4
                                    and right(m.phone, 4) = regexp_replace(p_query, '[^0-9]', '', 'g')
                          end))))
  order by m.full_name
  limit 200;
$function$;
