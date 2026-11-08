-- A member's mobile number reaches signed-in callers only through functions (audit of 8 Nov 2026: F-001, F-042):
-- in full for staff who may change it (members.change_phone, the super admins; owner, 8 Nov), otherwise not at all, as
-- the Members list already does (20261109240000_members_export_fields.sql). The table grant loses the phone column;
-- every other column stays readable as the policies give the rows.

-- Every column but phone. A column added later needs its own grant; test 333 names the columns.
revoke select on public.member from authenticated;
grant select (id, venue_id, user_id, member_number, full_name, tier_id, qualifying_small_blind, qualifying_big_blind,
              created_at, updated_at, erased_at, referral_code, known_as) on public.member to authenticated;

-- As 20261019092800_member_record.sql made it, with the number only for staff who may change it.
create or replace function private.member_search(p_venue_id uuid, p_query text)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_name text, visits integer,
               last_visit_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name,
         case when private.has_permission(p_venue_id, 'members.change_phone') then m.phone end,
         t.name,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id)
  from public.member m
  join public.tier t on t.id = m.tier_id
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
    -- A member number matches exactly, however short; a name from two characters. A mobile matches anywhere from four
    -- digits for staff who may read it; for other staff only its last four (which they see) or all ten, so trying digit
    -- after digit never spells out a number they may not read.
    and (m.member_number::text = trim(p_query)
         or (length(trim(coalesce(p_query, ''))) >= 2
             and (m.full_name ilike '%' || trim(p_query) || '%'
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
$$;

-- As 20261108090000_early_departure_withdrawal.sql made it, with the number only for staff who may change it.
create or replace function private.member_record(p_venue_id uuid, p_member_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_id uuid, tier_name text,
               tier_until date, qualifying_small_blind bigint, qualifying_big_blind bigint, is_kyc_complete boolean,
               photo_path text, visits integer, last_visit_at timestamptz, is_in_room boolean, early_departures integer,
               known_as text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name,
         case when private.has_permission(p_venue_id, 'members.change_phone') then m.phone end,
         t.id, t.name,
         (select ((c.ends_at at time zone 'Asia/Kolkata') - interval '1 day')::date from public.member_tier_change c
          where c.member_id = m.id and not c.is_expiry and (c.ends_at is null or c.ends_at > now()) order by c.created_at desc limit 1),
         m.qualifying_small_blind, m.qualifying_big_blind, private.is_kyc_complete(m.id), k.photo_path,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id),
         private.current_visit(m.id) is not null,
         (select count(*)::integer from public.early_departure e where e.member_id = m.id
            and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id)),
         m.known_as
  from public.member m
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  where m.id = p_member_id and m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read');
$$;

-- As 20261108110000_kyc_at_the_club.sql made it: a number matches only on its last four digits, which the list shows, or all
-- ten, so the desk cannot spell out a member's number digit by digit.
create or replace function private.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, right(m.phone, 4), k.status,
         case when k.at_club_from is not null then
           case when exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg')
                then m.venue_id || '/' || m.id || '/photo.jpg'
                else k.photo_path end
         end
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and (k.id is null or k.status = 'started')
    -- Null for a reviewer with no member record of their own, which is not their own check.
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and length(trim(p_search)) between 2 and 100
    -- position, not like: a search is text, never a pattern.
    and (position(lower(trim(p_search)) in lower(m.full_name)) > 0
         or (trim(p_search) ~ '^([0-9]{4}|[0-9]{10})$' and right(m.phone, length(trim(p_search))) = trim(p_search)))
  order by m.full_name
  limit 20;
$$;

-- The member with this mobile number, for the kill switch (control.engage) and an Academy booking's contact
-- (members.read). The caller brings the number, so only the id goes back; null when nobody has it.
create function private.member_id_for_phone(p_venue_id uuid, p_phone text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.member m
  where m.venue_id = p_venue_id and m.phone = p_phone
    and (private.has_permission(p_venue_id, 'members.read') or private.has_permission(p_venue_id, 'control.engage'))
  limit 1;
$$;

create function public.member_id_for_phone(p_venue_id uuid, p_phone text)
returns uuid
language sql
stable
set search_path = ''
as $$ select private.member_id_for_phone(p_venue_id, p_phone); $$;

revoke execute on function private.member_id_for_phone(uuid, text), public.member_id_for_phone(uuid, text) from public, anon;
grant execute on function private.member_id_for_phone(uuid, text), public.member_id_for_phone(uuid, text) to authenticated;
