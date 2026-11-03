-- Members lists everyone on open (owner, 3 Nov; decision 0483): members_of_tier with no tier gives every member of the
-- venue, by name, at most 5,000, for staff who read members, as it gives a tier's. The tier chips and the search narrow
-- the list in the console. The venue is the one the console works in, so the practice venue lists its own members
-- only, and nothing leaves for an outside system.

create or replace function private.members_of_tier(p_venue_id uuid, p_tier_id uuid default null)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_name text, visits integer, last_visit_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name, m.phone, t.name,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id)
  from public.member m
  join public.tier t on t.id = m.tier_id
  where m.venue_id = p_venue_id and (p_tier_id is null or m.tier_id = p_tier_id) and private.has_permission(p_venue_id, 'members.read')
  order by m.full_name
  limit 5000;
$$;

create or replace function public.members_of_tier(p_venue_id uuid, p_tier_id uuid default null)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_name text, visits integer, last_visit_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.members_of_tier(p_venue_id, p_tier_id); $$;

revoke execute on function private.members_of_tier(uuid, uuid), public.members_of_tier(uuid, uuid) from public, anon;
grant execute on function private.members_of_tier(uuid, uuid), public.members_of_tier(uuid, uuid) to authenticated;
