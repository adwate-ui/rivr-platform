-- The tournament floor (#120; decision 0204): the room's tables and seats, bust-outs with the place each
-- player finished in (the oldest alternate then takes a seat), balancing prompts and seat moves, and
-- refunding an alternate who never sat. The clock's reads gain the field: entries, re-entries, players
-- left, chips in play and the pool. Home's read becomes the member's tournament: the running one, or
-- the next, with their own seat and what they may buy.

-- A buy changes the pool and the chips in play, so the TVs are told (an entry's seat already tells them).
create trigger tournament_purchase_tv_signal after insert on public.tournament_purchase
  for each row execute function private.signal_tournament_change();

-- Each busted run's place as things stand: the runs not refunded, less where its bust stands among the busts.
create function private.tournament_places(p_tournament_id uuid)
returns table (entry_id uuid, place integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, private.tournament_finish_place(
    (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament_id and e.status <> 'refunded'),
    (rank() over (order by b.bust_order))::integer)
  from public.tournament_entry b where b.tournament_id = p_tournament_id and b.status = 'busted';
$$;

-- The tournament for a floor change to one of its entries, locked, once the caller runs tournaments there.
create function private.entry_for_floor(p_entry_id uuid)
returns public.tournament_entry
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.tournament_entry := (select e from public.tournament_entry e where e.id = p_entry_id);
begin
  perform private.assert_runs_tournaments(v_entry.venue_id);
  perform 1 from public.tournament t where t.id = v_entry.tournament_id for update;
  perform private.assert_writable(v_entry.venue_id);
  return (select e from public.tournament_entry e where e.id = p_entry_id);
end;
$$;

-- The room: how many tables and seats at each, for tournaments.manage. Refusals: 42501, 22023 out of
-- bounds or a seated player outside the new room; RVFRZ.
create function private.set_tournament_room(p_tournament_id uuid, p_tables integer, p_seats_per_table integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id);
begin
  perform private.assert_runs_tournaments(v_venue_id);
  perform private.assert_writable(v_venue_id);
  perform 1 from public.tournament t where t.id = p_tournament_id for update;
  if p_tables is null or p_seats_per_table is null or p_tables not between 1 and 30 or p_seats_per_table not between 2 and 10
     or exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament_id and e.status = 'seated'
                and (e.table_number > p_tables or e.seat_number > p_seats_per_table)) then
    raise exception '1 to 30 tables of 2 to 10 seats, with every seated player inside' using errcode = '22023';
  end if;
  update public.tournament set tables = p_tables, seats_per_table = p_seats_per_table where id = p_tournament_id;
end;
$$;

-- A seated player busts, for tournaments.manage: the bust takes the next place in the order of busts, and
-- the oldest alternate takes a seat. Gives the place it finishes in as things stand (private.tournament_finish_place:
-- late registration may add runs). Refusals: 42501, 22023 not seated; RVFRZ.
create function private.bust_tournament_entry(p_entry_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.tournament_entry := private.entry_for_floor(p_entry_id);
  v_place integer;
begin
  if v_entry.status is distinct from 'seated' then
    raise exception 'Only a seated player busts' using errcode = '22023';
  end if;
  update public.tournament_entry
  set status = 'busted', busted_at = now(), table_number = null, seat_number = null,
      bust_order = coalesce((select max(e.bust_order) from public.tournament_entry e where e.tournament_id = v_entry.tournament_id), 0) + 1
  where id = p_entry_id;
  v_place := (select r.place from private.tournament_places(v_entry.tournament_id) r where r.entry_id = p_entry_id);
  perform private.seat_tournament_entry(e.id) from public.tournament_entry e
  where e.id = (select a.id from public.tournament_entry a where a.tournament_id = v_entry.tournament_id and a.status = 'alternate'
                order by a.created_at, a.id limit 1);
  return v_place;
end;
$$;

-- Moves a seated player to a free seat at random at another table, as a balancing prompt asks, for
-- tournaments.manage. Gives the seat. Refusals: 42501, 22023 not seated, no such table, the same table or
-- a full one; RVFRZ.
create function private.move_tournament_entry(p_entry_id uuid, p_table integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.tournament_entry := private.entry_for_floor(p_entry_id);
  v_tournament public.tournament := (select t from public.tournament t where t.id = v_entry.tournament_id);
  v_seat integer;
begin
  if v_entry.status is distinct from 'seated' or p_table is null or p_table not between 1 and v_tournament.tables or p_table = v_entry.table_number then
    raise exception 'A seated player, to another of the tournament''s tables' using errcode = '22023';
  end if;
  v_seat := (select s.n from generate_series(1, v_tournament.seats_per_table) s (n)
             where not exists (select 1 from public.tournament_entry e where e.tournament_id = v_entry.tournament_id and e.status = 'seated'
                               and e.table_number = p_table and e.seat_number = s.n)
             order by random() limit 1);
  if v_seat is null then
    raise exception 'That table is full' using errcode = '22023';
  end if;
  update public.tournament_entry set table_number = p_table, seat_number = v_seat where id = p_entry_id;
  return v_seat;
end;
$$;

-- Refunds an alternate who never sat: every buy on the entry reversed (the wallet paid back, or the cash
-- from the drawer), the entry refunded. A cashier refunds any; staff who run tournaments refund wallet
-- buys only. Refusals: 42501, 22023 not an alternate; RVFRZ, RVNSH for cash with no shift open.
create function private.refund_tournament_alternate(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.tournament_entry := (select e from public.tournament_entry e where e.id = p_entry_id);
  v_is_cashier boolean := v_entry.venue_id is not null and private.has_permission(v_entry.venue_id, 'cage.transact');
begin
  if not v_is_cashier and not coalesce(private.has_permission(v_entry.venue_id, 'tournaments.manage'), false) then
    raise exception 'A cashier refunds; staff who run tournaments refund wallet buys' using errcode = '42501';
  end if;
  perform 1 from public.tournament t where t.id = v_entry.tournament_id for update;
  -- After the lock, so a cash buy made meanwhile is seen.
  if not v_is_cashier and exists (select 1 from public.tournament_purchase p where p.entry_id = p_entry_id and p.paid_by = 'cash') then
    raise exception 'A cashier refunds cash' using errcode = '42501';
  end if;
  perform private.assert_writable(v_entry.venue_id);
  if (select e.status from public.tournament_entry e where e.id = p_entry_id) is distinct from 'alternate' then
    raise exception 'Only an alternate who never sat is refunded' using errcode = '22023';
  end if;
  perform private.reverse_ledger_transaction(p.ledger_transaction_id, 'tournament_refund:' || p.id::text, 'An alternate refunded')
  from public.tournament_purchase p where p.entry_id = p_entry_id;
  update public.tournament_entry set status = 'refunded' where id = p_entry_id;
end;
$$;

-- A tournament's field: its entries and re-entries, the players still seated, the chips bought and the
-- pool, leaving out the buys of refunded alternates.
create function private.tournament_counts(p_tournament_id uuid)
returns table (entries integer, re_entries integer, players_left integer, chips_in_play bigint, pool_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where p.kind in ('entry', 're_entry'))::integer, count(*) filter (where p.kind = 're_entry')::integer,
         (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament_id and e.status = 'seated'),
         coalesce(sum(p.chips), 0)::bigint, coalesce(sum(p.price_paise - p.fee_paise), 0)::bigint
  from public.tournament_purchase p join public.tournament_entry e on e.id = p.entry_id
  where p.tournament_id = p_tournament_id and e.status <> 'refunded';
$$;

-- The floor's view of a tournament's players, for staff who run tournaments or the cage: seated by table
-- and seat, then alternates in the order they came, then busted by place; each with the chips they bought.
create function private.tournament_seating(p_tournament_id uuid)
returns table (entry_id uuid, member_id uuid, full_name text, member_number bigint, entry_number integer, status text, table_number integer,
               seat_number integer, place integer, chips bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, m.id, m.full_name, m.member_number, e.entry_number, e.status, e.table_number, e.seat_number, p.place,
         (select coalesce(sum(b.chips), 0)::bigint from public.tournament_purchase b where b.entry_id = e.id)
  from public.tournament_entry e join public.member m on m.id = e.member_id
  left join private.tournament_places(p_tournament_id) p on p.entry_id = e.id
  where e.tournament_id = p_tournament_id
    and (private.has_permission(e.venue_id, 'tournaments.manage') or private.has_permission(e.venue_id, 'cage.transact'))
  order by array_position(array['seated', 'alternate', 'busted', 'refunded'], e.status), e.table_number, e.seat_number, p.place,
           e.created_at;
$$;

-- The balancing prompts (decision 0204): the moves that bring every table within one player of the others.
create function private.tournament_balance(p_tournament_id uuid)
returns table (move integer, from_table integer, to_table integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.move, b.from_table, b.to_table
  from public.tournament t
  cross join lateral private.tournament_balancing_moves(array(
    select (select count(*)::integer from public.tournament_entry e where e.tournament_id = t.id and e.status = 'seated' and e.table_number = g.n)
    from generate_series(1, t.tables) g (n) order by g.n)) b
  where t.id = p_tournament_id
    and (private.has_permission(t.venue_id, 'tournaments.manage') or private.has_permission(t.venue_id, 'cage.transact'));
$$;

drop function public.venue_tournaments(uuid);
drop function private.venue_tournaments(uuid);
-- As 20261026231200_tournament_clock.sql left it, with the room and the field, and for the cage too (it takes buys in cash).
create function private.venue_tournaments(p_venue_id uuid)
returns table (id uuid, name text, starts_at timestamptz, is_published boolean, format text, buy_in_paise bigint, fee_paise bigint,
               guarantee_paise bigint, starting_stack integer, levels jsonb, last_registration_level integer, max_buys integer,
               add_on_paise bigint, add_on_fee_paise bigint, add_on_chips integer, places_paid integer, clock_started_at timestamptz,
               is_paused boolean, elapsed_seconds integer, tables integer, seats_per_table integer, entries integer, re_entries integer,
               players_left integer, chips_in_play bigint, pool_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.starts_at, t.is_published, t.format, t.buy_in_paise, t.fee_paise, t.guarantee_paise, t.starting_stack, t.levels,
         t.last_registration_level, t.max_buys, t.add_on_paise, t.add_on_fee_paise, t.add_on_chips, t.places_paid, t.clock_started_at,
         t.clock_paused_at is not null, private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now()),
         t.tables, t.seats_per_table, c.entries, c.re_entries, c.players_left, c.chips_in_play, c.pool_paise
  from public.tournament t cross join lateral private.tournament_counts(t.id) c
  where t.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'tournaments.manage') or private.has_permission(p_venue_id, 'cage.transact'))
    and (t.starts_at >= now() - interval '12 hours' or t.clock_started_at > now() - interval '1 day')
  order by t.clock_started_at desc nulls last, t.starts_at
  limit 100;
$$;

drop function public.tv_tournament_clock();
drop function private.tv_tournament_clock();
-- As 20261026231200_tournament_clock.sql left it, with the field.
create function private.tv_tournament_clock()
returns table (name text, levels jsonb, elapsed_seconds integer, is_paused boolean, entries integer, players_left integer, chips_in_play bigint,
               pool_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select t.name, t.levels, private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now()),
         t.clock_paused_at is not null, c.entries, c.players_left, c.chips_in_play, c.pool_paise
  from public.tournament t cross join lateral private.tournament_counts(t.id) c
  where t.id = private.running_tournament(private.tv_showing('tournament_clock'));
$$;

drop function public.live_tournament();
drop function private.live_tournament();
-- Home's tournament for the signed-in member with tournament registration: the one running at their
-- club, or else the next published whose clock has not started, from twelve hours ago on; its clock and field; their own latest run's standing and seat (a refunded one counts for nothing); and
-- what the app may offer them now (an entry, a re-entry or a rebuy), or nothing.
create function private.my_tournament()
returns table (id uuid, name text, starts_at timestamptz, buy_in_paise bigint, guarantee_paise bigint, is_running boolean, levels jsonb,
               elapsed_seconds integer, is_paused boolean, entries integer, players_left integer, pool_paise bigint, my_status text,
               my_table integer, my_seat integer, offer text)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select private.current_member_id() as member_id, private.current_member_venue_id() as venue_id
  ),
  chosen as (
    select coalesce(private.running_tournament(me.venue_id),
                    (select t.id from public.tournament t where t.venue_id = me.venue_id and t.is_published and t.clock_started_at is null
                     and t.starts_at >= now() - interval '12 hours' order by t.starts_at limit 1)) as id, me.member_id
    from me where me.member_id is not null and private.has_feature(me.member_id, 'tournaments.register')
  )
  select t.id, t.name, t.starts_at, t.buy_in_paise, t.guarantee_paise, coalesce(t.id = private.running_tournament(t.venue_id), false), t.levels,
         private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now()), t.clock_paused_at is not null,
         c.entries, c.players_left, c.pool_paise, mine.status, mine.table_number, mine.seat_number,
         case when t.levels is not null then (select o.purchase from unnest(array['entry', 're_entry', 'rebuy']) with ordinality o (purchase, n)
                                              where private.tournament_buy_refusal(t, chosen.member_id, o.purchase) is null order by o.n limit 1) end
  from chosen join public.tournament t on t.id = chosen.id
  cross join lateral private.tournament_counts(t.id) c
  left join lateral (select e.status, e.table_number, e.seat_number from public.tournament_entry e
                     where e.tournament_id = t.id and e.member_id = chosen.member_id and e.status <> 'refunded'
                     order by e.entry_number desc limit 1) mine on true;
$$;

create function public.set_tournament_room(p_tournament_id uuid, p_tables integer, p_seats_per_table integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_tournament_room(p_tournament_id, p_tables, p_seats_per_table); $$;
create function public.bust_tournament_entry(p_entry_id uuid)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.bust_tournament_entry(p_entry_id); $$;
create function public.move_tournament_entry(p_entry_id uuid, p_table integer)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.move_tournament_entry(p_entry_id, p_table); $$;
create function public.refund_tournament_alternate(p_entry_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.refund_tournament_alternate(p_entry_id); $$;
create function public.tournament_seating(p_tournament_id uuid)
returns table (entry_id uuid, member_id uuid, full_name text, member_number bigint, entry_number integer, status text, table_number integer,
               seat_number integer, place integer, chips bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tournament_seating(p_tournament_id); $$;
create function public.tournament_balance(p_tournament_id uuid)
returns table (move integer, from_table integer, to_table integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.tournament_balance(p_tournament_id); $$;
create function public.venue_tournaments(p_venue_id uuid)
returns table (id uuid, name text, starts_at timestamptz, is_published boolean, format text, buy_in_paise bigint, fee_paise bigint,
               guarantee_paise bigint, starting_stack integer, levels jsonb, last_registration_level integer, max_buys integer,
               add_on_paise bigint, add_on_fee_paise bigint, add_on_chips integer, places_paid integer, clock_started_at timestamptz,
               is_paused boolean, elapsed_seconds integer, tables integer, seats_per_table integer, entries integer, re_entries integer,
               players_left integer, chips_in_play bigint, pool_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_tournaments(p_venue_id); $$;
create function public.tv_tournament_clock()
returns table (name text, levels jsonb, elapsed_seconds integer, is_paused boolean, entries integer, players_left integer, chips_in_play bigint,
               pool_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_tournament_clock(); $$;
create function public.my_tournament()
returns table (id uuid, name text, starts_at timestamptz, buy_in_paise bigint, guarantee_paise bigint, is_running boolean, levels jsonb,
               elapsed_seconds integer, is_paused boolean, entries integer, players_left integer, pool_paise bigint, my_status text,
               my_table integer, my_seat integer, offer text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tournament(); $$;

revoke execute on function private.tournament_places(uuid), private.entry_for_floor(uuid), private.set_tournament_room(uuid, integer, integer), private.bust_tournament_entry(uuid),
  private.move_tournament_entry(uuid, integer), private.refund_tournament_alternate(uuid), private.tournament_counts(uuid),
  private.tournament_seating(uuid), private.tournament_balance(uuid), private.venue_tournaments(uuid), private.tv_tournament_clock(),
  private.my_tournament() from public, anon, authenticated;
grant execute on function private.set_tournament_room(uuid, integer, integer), private.bust_tournament_entry(uuid),
  private.move_tournament_entry(uuid, integer), private.refund_tournament_alternate(uuid), private.tournament_seating(uuid),
  private.tournament_balance(uuid), private.venue_tournaments(uuid), private.tv_tournament_clock(), private.my_tournament() to authenticated;
revoke execute on function public.set_tournament_room(uuid, integer, integer), public.bust_tournament_entry(uuid),
  public.move_tournament_entry(uuid, integer), public.refund_tournament_alternate(uuid), public.tournament_seating(uuid),
  public.tournament_balance(uuid), public.venue_tournaments(uuid), public.tv_tournament_clock(), public.my_tournament() from public, anon;
grant execute on function public.set_tournament_room(uuid, integer, integer), public.bust_tournament_entry(uuid),
  public.move_tournament_entry(uuid, integer), public.refund_tournament_alternate(uuid), public.tournament_seating(uuid),
  public.tournament_balance(uuid), public.venue_tournaments(uuid), public.tv_tournament_clock(), public.my_tournament() to authenticated;
