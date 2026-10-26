-- Interest lists (#113; scope-v1 module 2: "Interest lists open a new table when enough players are
-- waiting"; decision 0184) and pot data (#114; features "Pot data"; decision 0185).
--
-- Interest: a member registers interest in a game that is not running by joining its waitlist, from
-- the app or through the floor, as for any game. The interest list is that waitlist while none of the
-- game's tables is open: one list, so whoever registered first is called first once a table opens.
-- Once as many wait as the venue's waitlist.interest_to_open, the console's Waitlist tells the floor,
-- who opens one of the game's tables.
--
-- Pot data: every hand from the tablets, by table, dealer, variant and period, for the super admin
-- (pot_data.read). The console filters and sorts them; the export is the DataTable's (#102).

insert into public.setting_key (key, description, scope, value_schema) values
  ('waitlist.interest_to_open',
   'Interest lists (decision 0184): how many members waiting for a game with no open table tell the floor to open one; none set never tells.',
   'venue',
   '{"type":"object","properties":{"players":{"type":"integer","minimum":2,"maximum":10}},"required":["players"],"additionalProperties":false}');

insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array['pot_data.read']) as permission;

-- Each game at the venue with tables, none of them open: how many wait for it, how many the venue
-- wants before opening one (null when not set), and whether that many wait. For waitlist.manage.
create function private.interest_lists(p_venue_id uuid)
returns table (table_type_id uuid, waiting integer, players_to_open integer, is_ready boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select tt.id, count(e.id)::integer, s.players, coalesce(count(e.id) >= s.players, false)
  from public.table_type tt
  cross join lateral (select (private.setting_at(p_venue_id, 'waitlist.interest_to_open', '', now()) ->> 'players')::integer as players) s
  left join public.waitlist_entry e on e.table_type_id = tt.id and e.status = 'waiting'
  where tt.venue_id = p_venue_id and private.has_permission(p_venue_id, 'waitlist.manage')
    and exists (select 1 from public.game_table g where g.table_type_id = tt.id)
    and not exists (select 1 from public.game_table g where g.table_type_id = tt.id and g.is_open)
  group by tt.id, s.players;
$$;

-- The venue's hands played from p_from up to p_until, newest first, for pot_data.read: when, the table,
-- the dealer, the variant, the pot, rake and jackpot drop, whether the cap applied, and a high hand
-- claimed on it (not one rejected or reversed). At most 5,000: a period is chosen to fit.
create function private.pot_data(p_venue_id uuid, p_from timestamptz, p_until timestamptz)
returns table (hand_id uuid, played_at timestamptz, table_id uuid, table_name text, dealer_id uuid, dealer_name text, variant text,
               pot_paise bigint, rake_paise bigint, drop_paise bigint, is_cap_applied boolean, high_hand text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.played_at, g.id, g.name, s.id, s.full_name, h.variant::text, h.pot_paise, h.rake_paise, h.drop_paise, h.is_cap_applied,
         c.category::text
  from public.hand h
  join public.game_table g on g.id = h.table_id
  join public.staff s on s.id = h.staff_id
  left join public.high_hand_claim c on c.hand_id = h.id and c.status in ('claimed', 'approved')
  where h.venue_id = p_venue_id and private.has_permission(p_venue_id, 'pot_data.read')
    and h.played_at >= p_from and h.played_at < p_until
  order by h.played_at desc, h.id
  limit 5000;
$$;

create function public.interest_lists(p_venue_id uuid)
returns table (table_type_id uuid, waiting integer, players_to_open integer, is_ready boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.interest_lists(p_venue_id); $$;
create function public.pot_data(p_venue_id uuid, p_from timestamptz, p_until timestamptz)
returns table (hand_id uuid, played_at timestamptz, table_id uuid, table_name text, dealer_id uuid, dealer_name text, variant text,
               pot_paise bigint, rake_paise bigint, drop_paise bigint, is_cap_applied boolean, high_hand text)
language sql stable security invoker set search_path = ''
as $$ select * from private.pot_data(p_venue_id, p_from, p_until); $$;

revoke execute on function private.interest_lists(uuid), private.pot_data(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function private.interest_lists(uuid), private.pot_data(uuid, timestamptz, timestamptz) to authenticated;
revoke execute on function public.interest_lists(uuid), public.pot_data(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.interest_lists(uuid), public.pot_data(uuid, timestamptz, timestamptz) to authenticated;
