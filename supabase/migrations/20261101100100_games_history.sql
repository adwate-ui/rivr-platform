-- Games history (#643; owner's feedback doc of 29 Oct, super admin module 7): the tables run on each club day (06:00 to
-- 06:00 IST) and the hours each ran, from their runs (table_run, #638), for the super admin (tables.manage). A run belongs to
-- the club day it opened on; one still open counts to now.

create function private.games_history(p_venue_id uuid, p_from date, p_to date)
returns table (club_day date, table_id uuid, table_name text, game text, small_blind_paise bigint, big_blind_paise bigint, runs integer,
               seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (date_trunc('day', (r.opened_at at time zone 'Asia/Kolkata') - interval '6 hours'))::date as club_day, g.id, g.name, t.game,
         t.small_blind_paise, t.big_blind_paise, count(*)::integer,
         floor(sum(extract(epoch from coalesce(r.closed_at, now()) - r.opened_at)))::integer
  from public.table_run r
  join public.game_table g on g.id = r.table_id
  join public.table_type t on t.id = g.table_type_id
  where r.venue_id = p_venue_id and private.has_permission(p_venue_id, 'tables.manage')
    and (date_trunc('day', (r.opened_at at time zone 'Asia/Kolkata') - interval '6 hours'))::date between p_from and p_to
  group by 1, g.id, g.name, t.game, t.small_blind_paise, t.big_blind_paise, g.position
  order by 1 desc, g.position;
$$;
create function public.games_history(p_venue_id uuid, p_from date, p_to date)
returns table (club_day date, table_id uuid, table_name text, game text, small_blind_paise bigint, big_blind_paise bigint, runs integer,
               seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.games_history(p_venue_id, p_from, p_to); $$;

revoke execute on function private.games_history(uuid, date, date), public.games_history(uuid, date, date) from public, anon;
grant execute on function private.games_history(uuid, date, date), public.games_history(uuid, date, date) to authenticated;
