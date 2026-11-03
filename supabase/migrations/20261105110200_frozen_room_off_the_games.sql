-- A second room's freeze and the shared website (#613, decision 0460). A later room shares the club's website and has no
-- pages of its own (decision 0036), and since #609 the site pauses only for a freeze on the venue whose pages it serves.
-- The games block still counted every real venue's tables, so a frozen room's open tables showed seats. A venue under a
-- venue freeze now leaves the games block; the rest of the site carries on.

-- public_table_status_rows, as 20261028392500_public_table_seats.sql made it, without a frozen venue's tables.
create or replace function private.public_table_status_rows()
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
  where not v.is_practice
    and not exists (select 1 from public.control_state c where c.venue_id = v.id and c.level = 'venue_freeze' and c.released_at is null);
$$;
