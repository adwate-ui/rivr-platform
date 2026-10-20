-- The stakes the club runs, for the signed-in member's waitlist alerts (#206; decision 0069): every table
-- type's blinds at their own venue, smallest first and each once. Profile is core, so no tier is asked,
-- unlike reading table_type itself (floor.live_view); and a login that is also staff elsewhere gets only
-- its own club's, never another venue's or the practice venue's.
create function private.my_stakes()
returns table (small_blind_paise bigint, big_blind_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct t.small_blind_paise, t.big_blind_paise
  from public.table_type t
  where t.venue_id = private.current_member_venue_id()
  order by t.small_blind_paise, t.big_blind_paise;
$$;

create function public.my_stakes()
returns table (small_blind_paise bigint, big_blind_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_stakes(); $$;

revoke execute on function private.my_stakes(), public.my_stakes() from public, anon;
grant execute on function private.my_stakes(), public.my_stakes() to authenticated;
