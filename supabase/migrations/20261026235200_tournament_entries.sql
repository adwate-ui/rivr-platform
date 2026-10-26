-- Tournament registration (#118; decisions 0203, 0204): a member buys in from the app with their wallet
-- cash, or at the cage with cash; late registration to the template's last level (decision 0202's rules,
-- private.tournament_purchase_refusal); a seat at random at the emptiest table, or the alternates list
-- when every seat is taken. Each buy puts its price less its fee in the prize pool (players' money,
-- venue.tournament_pool) and the fee in the club's revenue (venue.tournament_fees, which the nightly
-- rake's GST invoice covers from #469). An entry or re-entry emits tournament.entered.

-- The room a tournament is played in: how many tables, and seats at each.
alter table public.tournament
  add column tables integer not null default 6 check (tables between 1 and 30),
  add column seats_per_table integer not null default 9 check (seats_per_table between 2 and 10);

-- A player's run in a tournament: a first entry or a re-entry, seated at a table and seat, waiting as an
-- alternate, busted (in the order of the busts, which gives the place), or refunded as an alternate who never sat.
create table public.tournament_entry (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  tournament_id uuid not null,
  member_id uuid not null,
  -- 1 for the first entry; each re-entry the next.
  entry_number integer not null check (entry_number >= 1),
  status text not null check (status in ('seated', 'alternate', 'busted', 'refunded')),
  table_number integer check (table_number >= 1),
  seat_number integer check (seat_number >= 1),
  -- Where the bust stands in the tournament's busts, 1 the first; the place is worked out from it on reading
  -- (private.tournament_finish_place), so entries made later in late registration never share one.
  bust_order integer check (bust_order >= 1),
  busted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, member_id, entry_number),
  unique (id, venue_id),
  foreign key (tournament_id, venue_id) references public.tournament (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  check ((status = 'seated') = (table_number is not null and seat_number is not null)),
  check ((status = 'busted') = (busted_at is not null and bust_order is not null))
);

comment on table public.tournament_entry is 'A player''s run in a tournament (#118, #120): seated, an alternate, busted in its order, or refunded.';

create unique index tournament_entry_seat_idx on public.tournament_entry (tournament_id, table_number, seat_number) where status = 'seated';
create index tournament_entry_member_idx on public.tournament_entry (member_id, venue_id);
create index tournament_entry_tournament_idx on public.tournament_entry (tournament_id, venue_id, status);

-- Every buy: what it bought, what it cost and the fee in it, how it was paid, and its ledger transaction.
create table public.tournament_purchase (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  tournament_id uuid not null,
  entry_id uuid not null,
  member_id uuid not null,
  kind text not null check (kind in ('entry', 're_entry', 'rebuy', 'add_on')),
  paid_by text not null check (paid_by in ('wallet', 'cash')),
  price_paise bigint not null check (price_paise > 0 and price_paise % 5000 = 0),
  fee_paise bigint not null check (fee_paise >= 0 and fee_paise % 5000 = 0),
  chips integer not null check (chips > 0),
  ledger_transaction_id uuid not null,
  idempotency_key text not null,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, idempotency_key),
  foreign key (tournament_id, venue_id) references public.tournament (id, venue_id),
  foreign key (entry_id, venue_id) references public.tournament_entry (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  check (fee_paise < price_paise)
);

comment on table public.tournament_purchase is 'Every tournament buy (#118): entry, re-entry, rebuy or add-on, its price and fee, wallet or cash, and its ledger transaction; never changed.';

create index tournament_purchase_tournament_idx on public.tournament_purchase (tournament_id, venue_id);
create index tournament_purchase_entry_idx on public.tournament_purchase (entry_id, venue_id);
create index tournament_purchase_member_idx on public.tournament_purchase (member_id, venue_id);
create index tournament_purchase_txn_idx on public.tournament_purchase (ledger_transaction_id, venue_id);

create trigger tournament_entry_touch_updated_at before update on public.tournament_entry
  for each row execute function private.touch_updated_at();
create trigger tournament_entry_audit after insert or update or delete on public.tournament_entry
  for each row execute function private.audit_row_change();
create trigger tournament_purchase_never_changed before update or delete on public.tournament_purchase
  for each row execute function private.refuse_change();
create trigger tournament_purchase_no_truncate before truncate on public.tournament_purchase
  for each statement execute function private.refuse_change();
create trigger tournament_purchase_audit after insert on public.tournament_purchase
  for each row execute function private.audit_row_change();
-- A seat taken or freed tells the venue's TVs: the players left and the average stack change.
create trigger tournament_entry_tv_signal after insert or update on public.tournament_entry
  for each row execute function private.signal_tournament_change();

alter table public.tournament_entry enable row level security;
alter table public.tournament_purchase enable row level security;
grant select on public.tournament_entry to authenticated;
-- Not who took the cash, nor the request id: a member reads what they bought.
grant select (id, venue_id, tournament_id, entry_id, member_id, kind, paid_by, price_paise, fee_paise, chips, created_at)
  on public.tournament_purchase to authenticated;

create policy "staff who run tournaments or the cage see the venue's entries" on public.tournament_entry
  for select to authenticated
  using (venue_id in (select private.venues_where('tournaments.manage')) or venue_id in (select private.venues_where('cage.transact')));
create policy "members with tournament registration see their own entries" on public.tournament_entry
  for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature(member_id, 'tournaments.register'));
create policy "staff who run tournaments, the cage or read the ledger see the venue's buys" on public.tournament_purchase
  for select to authenticated
  using (venue_id in (select private.venues_where('tournaments.manage')) or venue_id in (select private.venues_where('cage.transact'))
         or venue_id in (select private.venues_where('ledger.read')));
create policy "members with tournament registration see their own buys" on public.tournament_purchase
  for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature(member_id, 'tournaments.register'));

-- The clock's level for registration: 0 before the clock starts; a break counts as the level before it.
create function private.tournament_level_now(p_tournament public.tournament)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when p_tournament.clock_started_at is null then 0
              else (select c.level from private.tournament_clock_at(p_tournament.levels, private.tournament_elapsed(
                      p_tournament.clock_started_at, p_tournament.clock_paused_at, p_tournament.clock_shift, now())) c) end;
$$;

-- Seats an entry at random among the free seats of the emptiest tables (private.tournament_eligible_seats);
-- with none free it stays an alternate. Gives whether it was seated.
create function private.seat_tournament_entry(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.tournament_entry := (select e from public.tournament_entry e where e.id = p_entry_id);
  v_tournament public.tournament := (select t from public.tournament t where t.id = v_entry.tournament_id);
  v_seat record;
begin
  select s.table_number, s.seat_number into v_seat
  from private.tournament_eligible_seats(
    (select coalesce(jsonb_agg(jsonb_build_array(e.table_number, e.seat_number)), '[]') from public.tournament_entry e
     where e.tournament_id = v_entry.tournament_id and e.status = 'seated'),
    v_tournament.tables, v_tournament.seats_per_table) s
  order by random()
  limit 1;
  if v_seat.table_number is null then
    return false;
  end if;
  update public.tournament_entry set status = 'seated', table_number = v_seat.table_number, seat_number = v_seat.seat_number,
                                     bust_order = null, busted_at = null
  where id = p_entry_id;
  return true;
end;
$$;

-- What a buy costs, the fee in it and its chips: the add-on's own, or the buy-in and starting stack.
create function private.tournament_buy_terms(p_tournament public.tournament, p_purchase text)
returns table (price_paise bigint, fee_paise bigint, chips integer)
language sql
immutable
set search_path = ''
as $$
  select case when p_purchase = 'add_on' then p_tournament.add_on_paise else p_tournament.buy_in_paise end,
         case when p_purchase = 'add_on' then p_tournament.add_on_fee_paise else p_tournament.fee_paise end,
         case when p_purchase = 'add_on' then p_tournament.add_on_chips else p_tournament.starting_stack end;
$$;

-- The entry a buy is for: a new entry for an entry or re-entry, seated at random or an alternate; the
-- player's latest run not refunded for a rebuy or an add-on. A busted player's rebuy needs a free seat
-- (RVTRN room_full otherwise), so an alternate is only ever a run that never sat.
create function private.tournament_buy_entry(p_tournament public.tournament, p_member_id uuid, p_purchase text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest public.tournament_entry := (select e from public.tournament_entry e where e.tournament_id = p_tournament.id
                                       and e.member_id = p_member_id and e.status <> 'refunded' order by e.entry_number desc limit 1);
  v_id uuid;
begin
  if p_purchase in ('entry', 're_entry') then
    insert into public.tournament_entry (venue_id, tournament_id, member_id, entry_number, status)
    values (p_tournament.venue_id, p_tournament.id, p_member_id,
            coalesce((select max(e.entry_number) from public.tournament_entry e where e.tournament_id = p_tournament.id and e.member_id = p_member_id), 0) + 1,
            'alternate')
    returning id into v_id;
    perform private.seat_tournament_entry(v_id);
    return v_id;
  end if;
  if p_purchase = 'rebuy' and v_latest.status = 'busted' and not private.seat_tournament_entry(v_latest.id) then
    raise exception 'Every seat is taken: a rebuy needs one' using errcode = 'RVTRN', hint = 'room_full';
  end if;
  return v_latest.id;
end;
$$;

-- Why a player may not make a buy now (decision 0202), or null: the twin of @rivr/domain checkPurchase fed
-- with the tournament's rules, the clock's level and the player's buys and latest entry.
create function private.tournament_buy_refusal(p_tournament public.tournament, p_member_id uuid, p_purchase text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- A refunded run never sat: it counts for nothing.
  with latest as (
    select e.id, e.status from public.tournament_entry e where e.tournament_id = p_tournament.id and e.member_id = p_member_id
      and e.status <> 'refunded'
    order by e.entry_number desc limit 1
  )
  select private.tournament_purchase_refusal(
    p_purchase, p_tournament.format, p_tournament.last_registration_level, p_tournament.max_buys, p_tournament.add_on_paise is not null,
    private.tournament_level_now(p_tournament),
    (select count(*)::integer from public.tournament_purchase p join public.tournament_entry e on e.id = p.entry_id
     where p.tournament_id = p_tournament.id and p.member_id = p_member_id and e.status <> 'refunded' and p.kind in ('entry', 're_entry', 'rebuy')),
    coalesce((select l.status in ('seated', 'alternate') from latest l), false),
    exists (select 1 from latest l join public.tournament_purchase p on p.entry_id = l.id where p.kind = 'add_on'));
$$;

-- The cash path's checks on the player, as the cage's buy-in makes them: frozen, identity, a break.
create function private.assert_tournament_player(p_venue_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  perform private.assert_kyc_for_cage(p_member_id);
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: no buy-ins until it ends' using errcode = 'RVBRK';
  end if;
end;
$$;

-- Posts a buy: from the wallet (private.debit_wallet) or the cash drawer, the pool share to the prize pool
-- and the fee to the club's revenue. Gives the ledger transaction.
create function private.post_tournament_buy(p_tournament public.tournament, p_member_id uuid, p_paid_by text, p_price bigint, p_fee bigint,
                                            p_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to jsonb := (select jsonb_agg(jsonb_build_object('code', l.code, 'amount', l.amount)) from (values
                   ('venue.tournament_pool', private.tournament_pool_share(p_price, p_fee)), ('venue.tournament_fees', p_fee)) as l (code, amount)
                 where l.amount > 0);
begin
  if p_paid_by = 'wallet' then
    return private.debit_wallet(p_tournament.venue_id, p_member_id, p_price, 'tournament_buy', p_key, v_to);
  end if;
  perform private.assert_tournament_player(p_tournament.venue_id, p_member_id);
  return private.post_ledger_transaction(p_tournament.venue_id, 'tournament_buy', p_key,
    (select jsonb_agg(jsonb_build_object('account_id', a.id, 'amount', l.amount::text))
     from (select 'venue.cash_drawer' as code, p_price as amount
           union all select t.value ->> 'code', -(t.value ->> 'amount')::bigint from jsonb_array_elements(v_to) t) l
     join public.ledger_account a on a.venue_id = p_tournament.venue_id and a.member_id is null and a.code = l.code),
    'tournament_registration', 'A tournament buy at the cage');
end;
$$;

-- The buy a request id already made, or none; the same id for another buy is 22023.
create function private.tournament_buy_replay(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_paid_by text, p_idempotency_key uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_replay public.tournament_purchase := (select p from public.tournament_purchase p join public.tournament t on t.id = p.tournament_id
                                          where t.id = p_tournament_id and p.venue_id = t.venue_id and p.idempotency_key = p_idempotency_key::text);
begin
  if v_replay.id is not null and (v_replay.member_id <> p_member_id or v_replay.kind <> p_purchase or v_replay.paid_by <> p_paid_by) then
    raise exception 'That request id was used for another buy' using errcode = '22023';
  end if;
  return v_replay.id;
end;
$$;

-- A player buys into a tournament: an entry, re-entry, rebuy or add-on, paid from the wallet or in cash,
-- once per request id (a replay gives the first buy; the same id for another buy is 22023). Refusals:
-- 22023 no such tournament or one with no levels; RVFRZ, RVKIL the venue frozen or registration switched
-- off; RVTRN the rules refuse it (the reason in the hint: registration_closed, already_entered,
-- still_playing, limit_reached..., or room_full for a busted player's rebuy with no free seat); and the
-- wallet's or the cage's own (RVNOM, RVKYC, RVBRK, RVSHT, RVNSH).
-- Gives the buy. An entry or re-entry emits tournament.entered.
create function private.tournament_buy(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_paid_by text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournament;
  v_refusal text;
  v_terms record;
  v_entry uuid;
  v_purchase uuid := private.tournament_buy_replay(p_tournament_id, p_member_id, p_purchase, p_paid_by, p_idempotency_key);
begin
  if v_purchase is not null then
    return v_purchase;
  end if;
  -- One buy at a time per tournament, so two never take one seat; a request that waited here may have been made.
  select * into v_tournament from public.tournament t where t.id = p_tournament_id for update;
  v_purchase := private.tournament_buy_replay(p_tournament_id, p_member_id, p_purchase, p_paid_by, p_idempotency_key);
  if v_purchase is not null then
    return v_purchase;
  end if;
  if v_tournament.id is null or v_tournament.levels is null or p_paid_by not in ('wallet', 'cash') then
    raise exception 'A tournament with levels, paid from the wallet or in cash' using errcode = '22023';
  end if;
  perform private.assert_writable(v_tournament.venue_id, 'tournament_registration');
  v_refusal := private.tournament_buy_refusal(v_tournament, p_member_id, p_purchase);
  if v_refusal is not null then
    raise exception 'The tournament''s rules refuse this buy: %', v_refusal using errcode = 'RVTRN', hint = v_refusal;
  end if;
  select * into v_terms from private.tournament_buy_terms(v_tournament, p_purchase);
  v_purchase := gen_random_uuid();
  v_entry := private.tournament_buy_entry(v_tournament, p_member_id, p_purchase);
  insert into public.tournament_purchase (id, venue_id, tournament_id, entry_id, member_id, kind, paid_by, price_paise, fee_paise, chips,
                                          ledger_transaction_id, idempotency_key, created_by_user_id)
  values (v_purchase, v_tournament.venue_id, v_tournament.id, v_entry, p_member_id, p_purchase, p_paid_by, v_terms.price_paise, v_terms.fee_paise,
          v_terms.chips, private.post_tournament_buy(v_tournament, p_member_id, p_paid_by, v_terms.price_paise, v_terms.fee_paise,
                                                     'tournament_buy:' || p_idempotency_key::text),
          p_idempotency_key::text, (select auth.uid()));
  if p_purchase in ('entry', 're_entry') then
    perform private.emit(v_tournament.venue_id, 'tournament.entered',
      jsonb_build_object('tournament_id', v_tournament.id, 'member_id', p_member_id, 'entry_id', v_entry, 'kind', p_purchase, 'paid_by', p_paid_by),
      'tournament.entered:' || v_purchase::text);
  end if;
  return v_purchase;
end;
$$;

-- From the app (#118): the signed-in member buys in with their wallet cash, with tournament registration
-- (42501 without it or at another venue's tournament).
create function private.register_tournament_entry(p_tournament_id uuid, p_purchase text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'tournaments.register')
     or not exists (select 1 from public.tournament t where t.id = p_tournament_id and t.is_published
                    and t.venue_id = private.current_member_venue_id()) then
    raise exception 'Registration from the app is for members with tournament registration, at their club' using errcode = '42501';
  end if;
  return private.tournament_buy(p_tournament_id, v_member_id, p_purchase, 'wallet', p_idempotency_key);
end;
$$;

-- At the cage (#118): a cashier takes a buy in cash for a member (42501 without cage.transact there).
create function private.cage_tournament_entry(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id);
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'cage.transact') then
    raise exception 'Only a cashier takes tournament buys in cash' using errcode = '42501';
  end if;
  return private.tournament_buy(p_tournament_id, p_member_id, p_purchase, 'cash', p_idempotency_key);
end;
$$;

create function public.register_tournament_entry(p_tournament_id uuid, p_purchase text, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.register_tournament_entry(p_tournament_id, p_purchase, p_idempotency_key); $$;
create function public.cage_tournament_entry(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.cage_tournament_entry(p_tournament_id, p_member_id, p_purchase, p_idempotency_key); $$;

revoke execute on function private.tournament_level_now(public.tournament), private.tournament_buy_replay(uuid, uuid, text, text, uuid),
  private.seat_tournament_entry(uuid), private.tournament_buy_terms(public.tournament, text), private.tournament_buy_entry(public.tournament, uuid, text),
  private.tournament_buy_refusal(public.tournament, uuid, text), private.assert_tournament_player(uuid, uuid),
  private.post_tournament_buy(public.tournament, uuid, text, bigint, bigint, text), private.tournament_buy(uuid, uuid, text, text, uuid),
  private.register_tournament_entry(uuid, text, uuid), private.cage_tournament_entry(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.register_tournament_entry(uuid, text, uuid), private.cage_tournament_entry(uuid, uuid, text, uuid) to authenticated;
revoke execute on function public.register_tournament_entry(uuid, text, uuid), public.cage_tournament_entry(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.register_tournament_entry(uuid, text, uuid), public.cage_tournament_entry(uuid, uuid, text, uuid) to authenticated;

-- The tournament gains its room, and the practice venue's seed keeps it (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
