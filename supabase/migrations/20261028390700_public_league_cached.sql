-- The website's League board is cached (#462): a visit reads the boards as last worked out, every ten minutes, not the
-- standings worked out again for each visitor. private.public_league_rows() still works them out; this table keeps the
-- result, refreshed by pg_cron, and public.public_league_table reads it. Private, as the boards are keyed by the
-- venue's slug for the website and never the practice venue's.
create table private.public_league_cache (
  venue_slug text not null,
  standing text not null,
  season_name text,
  first_month date,
  last_month date,
  place integer not null,
  display_name text,
  points bigint not null,
  refreshed_at timestamptz not null default now()
);

-- Works the boards out again and keeps them, in one go, so a visitor never reads half a board.
create function private.refresh_public_league()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.public_league_cache;
  insert into private.public_league_cache (venue_slug, standing, season_name, first_month, last_month, place, display_name, points)
  select venue_slug, standing, season_name, first_month, last_month, place, display_name, points from private.public_league_rows();
$$;

-- The boards as last cached, for the website.
create function private.public_league_cached()
returns table (venue_slug text, standing text, season_name text, first_month date, last_month date, place integer, display_name text,
               points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select venue_slug, standing, season_name, first_month, last_month, place, display_name, points from private.public_league_cache;
$$;

create or replace view public.public_league_table
with (security_invoker = true)
as
select venue_slug, standing, season_name, first_month, last_month, place, display_name, points from private.public_league_cached();

revoke execute on function private.refresh_public_league() from public, anon, authenticated;
revoke execute on function private.public_league_cached() from public;
grant execute on function private.public_league_cached() to anon, authenticated;

select cron.schedule('public-league-refresh', '*/10 * * * *', 'select private.refresh_public_league()');
select private.refresh_public_league();
