-- The website's League board is cached (#462): a visit reads the boards as last worked out, every ten minutes, not the
-- standings worked out again for each visitor. private.league_board() still works them out; this table keeps the
-- result, refreshed by pg_cron, and public.public_league_table reads it. Private, as the boards are keyed by the
-- venue's slug for the website and never the practice venue's. Who may be named is read at each visit, not cached: a
-- member who hides their name, is erased or excludes themselves leaves the website at once.
create table private.public_league_cache (
  venue_slug text not null,
  standing text not null,
  season_name text,
  first_month date,
  last_month date,
  place integer not null,
  member_id uuid not null,
  display_name text,
  points bigint not null,
  refreshed_at timestamptz not null default now()
);

-- Read only through the functions below.
alter table private.public_league_cache enable row level security;

-- Works the boards out again and keeps them, in one go, so a visitor never reads half a board.
create function private.refresh_public_league()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.public_league_cache;
  insert into private.public_league_cache (venue_slug, standing, season_name, first_month, last_month, place, member_id, display_name, points)
  select v.slug, b.standing, b.season_name, b.first_month, b.last_month, b.place, b.member_id, b.display_name, b.points
  from public.venue v cross join lateral private.league_board(v.id) b where not v.is_practice;
$$;

-- The boards as last cached, for the website: a member erased or self-excluded since is left out, and one who has hidden
-- their name since is shown without it.
create function private.public_league_cached()
returns table (venue_slug text, standing text, season_name text, first_month date, last_month date, place integer, display_name text,
               points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.venue_slug, c.standing, c.season_name, c.first_month, c.last_month, c.place,
         case when coalesce(pr.name_on_tvs, true) then c.display_name end, c.points
  from private.public_league_cache c
  join public.member m on m.id = c.member_id and m.erased_at is null
  left join public.member_preference pr on pr.member_id = c.member_id
  where not exists (select 1 from public.self_exclusion x where x.member_id = c.member_id and x.starts_at <= now() and x.ends_at > now());
$$;

create or replace view public.public_league_table
with (security_invoker = true)
as
select venue_slug, standing, season_name, first_month, last_month, place, display_name, points from private.public_league_cached();

-- The boards worked out for each visitor, which the website read before, are no longer read.
drop function private.public_league_rows();

revoke execute on function private.refresh_public_league() from public, anon, authenticated;
revoke execute on function private.public_league_cached() from public;
grant execute on function private.public_league_cached() to anon, authenticated;

select cron.schedule('public-league-refresh', '*/10 * * * *', 'select private.refresh_public_league()');
select private.refresh_public_league();
