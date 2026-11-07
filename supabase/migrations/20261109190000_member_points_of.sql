-- Points and bonus chips told apart on the member's record (the owner, 8 Nov): the record's one part shows both, points
-- first. Staff who read members read a member's points by the member (member_points finds one by number, for staff who
-- give points): earned, to spend on rewards, and locked until released. Nothing for an erased member, one of another
-- venue, or anyone who does not read members.

create function private.member_points_of(p_venue_id uuid, p_member_id uuid)
returns table (earned bigint, locked bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select h.o_earned, h.o_locked
  from public.member m cross join lateral private.points_held(m.id) h
  where m.id = p_member_id and m.venue_id = p_venue_id and m.erased_at is null and private.has_permission(p_venue_id, 'members.read');
$$;

create function public.member_points_of(p_venue_id uuid, p_member_id uuid)
returns table (earned bigint, locked bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_points_of(p_venue_id, p_member_id); $$;

revoke execute on function private.member_points_of(uuid, uuid), public.member_points_of(uuid, uuid) from public, anon;
grant execute on function private.member_points_of(uuid, uuid), public.member_points_of(uuid, uuid) to authenticated;
