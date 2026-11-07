-- More on the Members list (the owner, 8 Nov): each member's KYC status, total time played, city and member-since day,
-- and the mobile number for super admins. The full number goes only to staff who change numbers (members.change_phone,
-- super admins); the rest get its last four digits, which the console's search matches. As 20261107410000 made it
-- otherwise: every member of the venue in use, or of a tier, by name, at most 5,000, for staff who read members.
--
-- KYC status, as the console shows it: verified; in_review (waiting for a reviewer); at_desk (let in by their selfie,
-- the desk checks them on their first visit); refused; not_done (no check, or one the member has not finished).

drop function public.members_of_tier(uuid, uuid);
drop function private.members_of_tier(uuid, uuid);

create function private.members_of_tier(p_venue_id uuid, p_tier_id uuid default null)
returns table (member_id uuid, member_number bigint, full_name text, phone text, phone_last4 text, tier_name text, visits integer,
               last_visit_at timestamptz, kyc_status text, minutes_played bigint, city text, member_since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with access as (
    select private.has_permission(p_venue_id, 'members.read') as reads,
           coalesce(private.has_permission(p_venue_id, 'members.change_phone'), false) as sees_phone
  ),
  played as (
    select s.member_id, sum(private.minutes_played(s, now()))::bigint as minutes
    from public.seat_session s
    where s.venue_id = p_venue_id and (select reads from access)
    group by s.member_id
  )
  select m.id, m.member_number, m.full_name, case when a.sees_phone then m.phone end, right(m.phone, 4), t.name,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id),
         case when k.status = 'verified' then 'verified'
              when k.status = 'needs_review' then 'in_review'
              when k.status = 'refused' then 'refused'
              when k.status = 'started' and k.at_club_from is not null then 'at_desk'
              else 'not_done' end,
         coalesce(p.minutes, 0), pr.city, m.created_at
  from public.member m
  cross join access a
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  left join played p on p.member_id = m.id
  left join public.member_preference pr on pr.member_id = m.id
  where m.venue_id = p_venue_id and (p_tier_id is null or m.tier_id = p_tier_id) and a.reads
  order by m.full_name
  limit 5000;
$$;

create function public.members_of_tier(p_venue_id uuid, p_tier_id uuid default null)
returns table (member_id uuid, member_number bigint, full_name text, phone text, phone_last4 text, tier_name text, visits integer,
               last_visit_at timestamptz, kyc_status text, minutes_played bigint, city text, member_since timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.members_of_tier(p_venue_id, p_tier_id); $$;

revoke execute on function private.members_of_tier(uuid, uuid), public.members_of_tier(uuid, uuid) from public, anon;
grant execute on function private.members_of_tier(uuid, uuid), public.members_of_tier(uuid, uuid) to authenticated;
