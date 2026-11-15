-- The member record shows the photo a member took at sign-up when their check has none of its own (issue 980). While the
-- club checks identity at the desk (decision 0502) the selfie is kept as the sign-up photo, <venue>/<member>/photo.jpg, and
-- kyc_record.photo_path stays empty until the desk takes its own. The record read that column alone, so it said "No photo"
-- for every member waiting for the desk, while the desk's own list showed their selfie.

-- As 20261110000000_member_phones.sql made it, with the sign-up photo where the check has no photo.
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
         m.qualifying_small_blind, m.qualifying_big_blind, private.is_kyc_complete(m.id),
         coalesce(k.photo_path,
                  case when exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg')
                       then m.venue_id || '/' || m.id || '/photo.jpg' end),
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
