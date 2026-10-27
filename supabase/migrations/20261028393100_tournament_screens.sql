-- The satellite and multi-flight screens (#519, #524; decisions 0250, 0251) read what the database already keeps.

drop function public.venue_tournaments(uuid);
drop function private.venue_tournaments(uuid);
-- As 20261027120200_tournament_finish.sql left it, with what each tournament is a satellite for, and the Day 2 a flight is of.
create function private.venue_tournaments(p_venue_id uuid)
returns table (id uuid, name text, starts_at timestamptz, is_published boolean, format text, buy_in_paise bigint, fee_paise bigint,
               guarantee_paise bigint, starting_stack integer, levels jsonb, last_registration_level integer, max_buys integer,
               add_on_paise bigint, add_on_fee_paise bigint, add_on_chips integer, places_paid integer, clock_started_at timestamptz,
               is_paused boolean, elapsed_seconds integer, tables integer, seats_per_table integer, entries integer, re_entries integer,
               players_left integer, chips_in_play bigint, pool_paise bigint, bounty_paise bigint, bounty_kind text, finished_at timestamptz,
               overlay_paise bigint, payout_shares integer[], satellite_target_id uuid, day_two_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.starts_at, t.is_published, t.format, t.buy_in_paise, t.fee_paise, t.guarantee_paise, t.starting_stack, t.levels,
         t.last_registration_level, t.max_buys, t.add_on_paise, t.add_on_fee_paise, t.add_on_chips, t.places_paid, t.clock_started_at,
         t.clock_paused_at is not null, private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now()),
         t.tables, t.seats_per_table, c.entries, c.re_entries, c.players_left, c.chips_in_play, c.pool_paise, t.bounty_paise, t.bounty_kind,
         t.finished_at, t.overlay_paise, t.payout_shares, t.satellite_target_id, t.day_two_id
  from public.tournament t cross join lateral private.tournament_counts(t.id) c
  where t.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'tournaments.manage') or private.has_permission(p_venue_id, 'cage.transact'))
    and (t.starts_at >= now() - interval '12 hours' or t.clock_started_at > now() - interval '1 day')
  order by t.clock_started_at desc nulls last, t.starts_at
  limit 100;
$$;

create function public.venue_tournaments(p_venue_id uuid)
returns table (id uuid, name text, starts_at timestamptz, is_published boolean, format text, buy_in_paise bigint, fee_paise bigint,
               guarantee_paise bigint, starting_stack integer, levels jsonb, last_registration_level integer, max_buys integer,
               add_on_paise bigint, add_on_fee_paise bigint, add_on_chips integer, places_paid integer, clock_started_at timestamptz,
               is_paused boolean, elapsed_seconds integer, tables integer, seats_per_table integer, entries integer, re_entries integer,
               players_left integer, chips_in_play bigint, pool_paise bigint, bounty_paise bigint, bounty_kind text, finished_at timestamptz,
               overlay_paise bigint, payout_shares integer[], satellite_target_id uuid, day_two_id uuid)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_tournaments(p_venue_id); $$;

-- As 20261026235300_tournament_floor.sql left it, but a Day 2 player who went through has the chips they bagged.
create or replace function private.tournament_seating(p_tournament_id uuid)
returns table (entry_id uuid, member_id uuid, full_name text, member_number bigint, entry_number integer, status text, table_number integer,
               seat_number integer, place integer, chips bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, m.id, m.full_name, m.member_number, e.entry_number, e.status, e.table_number, e.seat_number, p.place,
         coalesce((select f.bagged_chips from public.tournament_entry f where f.id = e.flight_entry_id),
                  (select coalesce(sum(b.chips), 0)::bigint from public.tournament_purchase b where b.entry_id = e.id))
  from public.tournament_entry e join public.member m on m.id = e.member_id
  left join private.tournament_places(p_tournament_id) p on p.entry_id = e.id
  where e.tournament_id = p_tournament_id
    and (private.has_permission(e.venue_id, 'tournaments.manage') or private.has_permission(e.venue_id, 'cage.transact'))
  order by array_position(array['seated', 'alternate', 'busted', 'refunded'], e.status), e.table_number, e.seat_number, p.place,
           e.created_at;
$$;

-- The tickets a satellite issued, by the place that won them: the floor and the cage see them after its finish.
create function private.satellite_tickets(p_tournament_id uuid)
returns table (full_name text, value_paise bigint, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.full_name, k.value_paise, k.status
  from public.tournament_ticket k join public.member m on m.id = k.member_id join public.tournament_entry e on e.id = k.entry_id
  where k.satellite_id = p_tournament_id
    and (private.has_permission(k.venue_id, 'tournaments.manage') or private.has_permission(k.venue_id, 'cage.transact'))
  order by e.place, k.created_at;
$$;

create function public.satellite_tickets(p_tournament_id uuid)
returns table (full_name text, value_paise bigint, status text)
language sql stable security invoker set search_path = ''
as $$ select * from private.satellite_tickets(p_tournament_id); $$;

-- The tickets the member holds, each with its target and when it starts, for Home (tournaments.register).
create function private.my_tournament_tickets()
returns table (ticket_id uuid, member_id uuid, tournament_id uuid, tournament_name text, starts_at timestamptz, value_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, k.member_id, t.id, t.name, t.starts_at, k.value_paise
  from public.tournament_ticket k join public.tournament t on t.id = k.target_id
  where k.member_id = private.current_member_id() and k.status = 'held' and private.has_feature(k.member_id, 'tournaments.register')
  order by t.starts_at;
$$;

create function public.my_tournament_tickets()
returns table (ticket_id uuid, member_id uuid, tournament_id uuid, tournament_name text, starts_at timestamptz, value_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tournament_tickets(); $$;

revoke execute on function private.venue_tournaments(uuid), private.satellite_tickets(uuid), private.my_tournament_tickets(),
  public.venue_tournaments(uuid), public.satellite_tickets(uuid), public.my_tournament_tickets() from public, anon;
grant execute on function private.venue_tournaments(uuid), private.satellite_tickets(uuid), private.my_tournament_tickets(),
  public.venue_tournaments(uuid), public.satellite_tickets(uuid), public.my_tournament_tickets() to authenticated;
