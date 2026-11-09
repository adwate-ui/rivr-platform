-- A member's promotions on their record, as many as are asked for (8 Nov audit, I-73, F-103), in place of a silent cap of 200.
drop function public.member_promotion_grants(uuid);
drop function private.member_promotion_grants(uuid);

create function private.member_promotion_grants(p_member_id uuid, p_limit integer)
returns table (grant_id uuid, granted_at timestamptz, club_day date, promotion_name text, version integer, points bigint, chips bigint, spins integer,
               perk text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.created_at, g.club_day, coalesce(v.name, p.name), v.version, g.points, g.chips, g.spins, g.perk
  from public.promotion_grant g
  join public.promotion p on p.id = g.promotion_id
  left join public.promotion_version v on v.id = g.promotion_version_id
  where g.member_id = p_member_id and private.has_permission(g.venue_id, 'members.read')
  order by g.created_at desc, g.id
  limit greatest(least(coalesce(p_limit, 20), 5000), 1);
$$;

create function public.member_promotion_grants(p_member_id uuid, p_limit integer default 20)
returns table (grant_id uuid, granted_at timestamptz, club_day date, promotion_name text, version integer, points bigint, chips bigint, spins integer,
               perk text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_promotion_grants(p_member_id, p_limit); $$;

revoke execute on function private.member_promotion_grants(uuid, integer), public.member_promotion_grants(uuid, integer) from public, anon;
grant execute on function private.member_promotion_grants(uuid, integer), public.member_promotion_grants(uuid, integer) to authenticated;
