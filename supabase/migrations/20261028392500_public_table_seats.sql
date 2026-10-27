-- The live floor on the website (#130): each table's seats and how many are taken, so the games block shows open seats.
-- Counts only, never who sits. Otherwise as 20261019090100_website_live_blocks.sql.
drop view public.public_table_status;
drop function private.public_table_status_rows();

create function private.public_table_status_rows()
returns table (venue_slug text, table_name text, table_position integer, is_open boolean, table_type_code text,
               table_type_name text, game text, small_blind_paise bigint, big_blind_paise bigint,
               buy_in_min_paise bigint, buy_in_max_paise bigint, straddle_paise bigint, seats integer, seats_taken integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, g.name, g.position, g.is_open, t.code, t.name, t.game, t.small_blind_paise, t.big_blind_paise,
         t.buy_in_min_paise, t.buy_in_max_paise, t.straddle_paise, g.seats,
         (select count(*)::integer from public.seat_session s where s.table_id = g.id and s.ended_at is null)
  from public.game_table g
  join public.table_type t on t.id = g.table_type_id
  join public.venue v on v.id = g.venue_id
  where not v.is_practice;
$$;

grant execute on function private.public_table_status_rows() to anon, authenticated;

create view public.public_table_status
with (security_invoker = true)
as
select venue_slug, table_name, table_position, is_open, table_type_code, table_type_name, game, small_blind_paise,
       big_blind_paise, buy_in_min_paise, buy_in_max_paise, straddle_paise, seats, seats_taken
from private.public_table_status_rows();

grant select on public.public_table_status to anon, authenticated;
