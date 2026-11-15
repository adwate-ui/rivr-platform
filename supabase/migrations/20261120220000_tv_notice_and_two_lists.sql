-- The TV's stage as the redesign draws it (redesign of 15 Nov 2026, issue 971; renders tv-boards-01 to 05; decision 0631):
-- the club's notice runs along the foot of every board, and the hours leaderboard shows two lists side by side.

-- The notice on a TV: the text of its own venue's notice in force that started last, the one a member's Home shows in its
-- top slot (redesign correction 20). A TV reads its own venue's alone, so a practice venue's notice never shows on the
-- club's TVs, nor the club's on a practice TV. Null with none in force, and for anyone who is not a paired TV.
create function private.tv_notice()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select n.body
  from public.device d
  join public.notice n on n.venue_id = d.venue_id
  where d.id = (select private.current_device_id()) and d.kind = 'tv'
    and n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
  order by n.starts_at desc, n.created_at desc, n.id desc
  limit 1;
$$;
create function public.tv_notice()
returns text
language sql stable security invoker set search_path = ''
as $$ select private.tv_notice(); $$;
revoke execute on function private.tv_notice(), public.tv_notice() from public, anon;
grant execute on function private.tv_notice(), public.tv_notice() to authenticated;

-- The hours leaderboard's two lists, tonight's first: tonight, and the period the club set in tv.leaderboard, or this
-- week where it set tonight or nothing. Each list as the club set the board: the top N, those past the hours, or both.
-- As 20261112120100_tv_leaderboard.sql made it, which read the one period.
create or replace function private.tv_leaderboard()
returns table (period text, place integer, display_name text, member_number bigint, played_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  with board as (
    select v.venue_id, coalesce(c.value ->> 'period', 'tonight') as period, (c.value -> 'top')::integer as top,
           (c.value -> 'min_hours')::integer as min_hours
    from (select private.tv_showing('leaderboard') as venue_id) v
    cross join lateral (select private.setting_at(v.venue_id, 'tv.leaderboard', '', now()) as value) c
    where v.venue_id is not null
  )
  select p.period, l.place, l.display_name, l.member_number, l.played_minutes
  from board b
  cross join lateral unnest(array['tonight', case when b.period = 'tonight' then 'week' else b.period end]) with ordinality as p (period, list)
  cross join lateral private.hours_leaderboard(b.venue_id, p.period, b.top, b.min_hours, now()) with ordinality
    as l (place, member_id, display_name, member_number, played_minutes, n)
  order by p.list, l.n;
$$;
