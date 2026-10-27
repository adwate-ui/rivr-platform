-- Satellites (#117; decision 0250; question #489, answered "as recommended" on 27 Oct). A tournament may be a
-- satellite for another at the venue, its target. When it finishes, its prize pool buys seats at the target's
-- buy-in, rounded down and never more than its runs (private.tournament_satellite_seats, the twin of
-- @rivr/domain satelliteSeats): each of that many top finishers wins a ticket, and what is left of the pool
-- is paid in cash to the next finisher (to the last seat when every run has one). The seats' value moves from
-- the prize pool to the tickets held (venue.tournament_tickets, players' money). A ticket pays one entry into
-- the target, its fee included, from the app or at the cage; it has no cash value and never moves to another
-- member. A ticket still held when the target's registration closes (or the target finishes) lapses and is
-- refunded to the member's wallet.

-- Every venue holds satellite tickets apart from its prize pools.
insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money)
select v.id, 'venue.tournament_tickets', 'Satellite tickets held', 'liability', 'paise', true
from public.venue v
where not exists (select 1 from public.ledger_account a where a.venue_id = v.id and a.code = 'venue.tournament_tickets' and a.member_id is null);

-- As before (20261027200000_withdrawal_methods.sql), with the satellite tickets held.
create or replace function private.bootstrap_venue(
  p_venue_id uuid,
  p_name text,
  p_slug text,
  p_is_practice boolean,
  p_legal_name text,
  p_address text,
  p_invoice_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_tier_id uuid;
begin
  if exists (select 1 from public.venue v where v.id = p_venue_id) then
    return p_venue_id;
  end if;

  insert into public.venue (id, name, slug, is_practice) values (p_venue_id, p_name, p_slug, p_is_practice);
  insert into public.venue_config (venue_id, legal_name, address, invoice_prefix)
  values (p_venue_id, p_legal_name, p_address, p_invoice_prefix);
  insert into public.invoice_series (venue_id, code, name) values (p_venue_id, 'S', 'Club services');

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1), (p_venue_id, 'Academy graduate', 2),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tds.config', '',
          '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
          '-infinity', 'Switched off until the owner sets TDS (#22)');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'gst.config', '', '{"rate_basis_points": 1800, "basis": "rake"}', '-infinity', 'A placeholder until the owner sets GST (#23)');

  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, true, 'locked', '-infinity'
  from public.tier t cross join public.feature f
  where t.venue_id = p_venue_id and f.is_gateable;

  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money) values
    (p_venue_id, 'venue.cash_drawer', 'Cash drawer', 'asset', 'paise', false),
    (p_venue_id, 'venue.bank', 'Bank and UPI', 'asset', 'paise', false),
    (p_venue_id, 'venue.chips_outstanding', 'Chips in play', 'liability', 'paise', true),
    (p_venue_id, 'venue.rake', 'Rake', 'revenue', 'paise', false),
    (p_venue_id, 'venue.jackpot.main', 'Bad-beat jackpot', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.season', 'Season jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.freeroll', 'Freeroll jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.bonus_expense', 'Bonus issued', 'expense', 'paise', false),
    (p_venue_id, 'venue.high_hand_expense', 'High hands paid', 'expense', 'paise', false),
    (p_venue_id, 'venue.withdrawals_pending', 'Withdrawals waiting to be paid', 'liability', 'paise', true),
    (p_venue_id, 'venue.tds_payable', 'TDS withheld, to be paid to the government', 'liability', 'paise', false),
    (p_venue_id, 'venue.tournament_pool', 'Tournament prize pools', 'liability', 'paise', true),
    (p_venue_id, 'venue.tournament_fees', 'Tournament fees', 'revenue', 'paise', false),
    (p_venue_id, 'venue.tournament_overlay', 'Tournament overlay', 'expense', 'paise', false),
    (p_venue_id, 'venue.tournament_tickets', 'Satellite tickets held', 'liability', 'paise', true),
    (p_venue_id, 'venue.cashfree', 'Cashfree payout balance', 'asset', 'paise', false),
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  if p_is_practice then
    perform private.add_certification_quizzes(p_venue_id);
  end if;

  perform private.add_training_sops(p_venue_id);
  perform private.add_promotion_templates(p_venue_id);
  if not p_is_practice and not exists (select 1 from public.venue v where not v.is_practice and v.id <> p_venue_id) then
    perform private.add_website(p_venue_id);
  end if;

  return p_venue_id;
end;
$$;

-- The event a satellite's tickets are for: another tournament at the venue. A satellite has no bounty.
alter table public.tournament
  add column satellite_target_id uuid,
  add constraint tournament_satellite_target_fkey foreign key (satellite_target_id, venue_id) references public.tournament (id, venue_id),
  add constraint tournament_satellite check (satellite_target_id is null or (satellite_target_id <> id and bounty_paise is null));
create index tournament_satellite_target_idx on public.tournament (satellite_target_id, venue_id);

-- A buy may be paid with a satellite's ticket.
alter table public.tournament_purchase drop constraint tournament_purchase_paid_by_check;
alter table public.tournament_purchase add constraint tournament_purchase_paid_by_check check (paid_by in ('wallet', 'cash', 'ticket'));

-- A satellite's ticket: one seat in its target, worth the target's buy-in, won by a run of the satellite and
-- moved into the tickets held. It is held until it pays an entry into the target (used), or lapses unused and
-- is refunded to the wallet. An alternate's refund gives a used ticket back.
create table public.tournament_ticket (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  satellite_id uuid not null,
  entry_id uuid not null unique,
  target_id uuid not null,
  value_paise bigint not null check (value_paise > 0 and value_paise % 5000 = 0),
  status text not null default 'held' check (status in ('held', 'used', 'refunded')),
  issue_transaction_id uuid not null,
  use_transaction_id uuid,
  refund_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (satellite_id, venue_id) references public.tournament (id, venue_id),
  foreign key (entry_id, venue_id) references public.tournament_entry (id, venue_id),
  foreign key (target_id, venue_id) references public.tournament (id, venue_id),
  foreign key (issue_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (use_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (refund_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  check ((status = 'used') = (use_transaction_id is not null)),
  check ((status = 'refunded') = (refund_transaction_id is not null))
);

comment on table public.tournament_ticket is 'A satellite''s ticket to its target event (#117): held, used for an entry, or lapsed and refunded to the wallet.';

create index tournament_ticket_held_idx on public.tournament_ticket (target_id, member_id) where status = 'held';
create index tournament_ticket_member_idx on public.tournament_ticket (member_id, venue_id);
create index tournament_ticket_satellite_idx on public.tournament_ticket (satellite_id, venue_id);
create index tournament_ticket_target_idx on public.tournament_ticket (target_id, venue_id);
create index tournament_ticket_issue_txn_idx on public.tournament_ticket (issue_transaction_id, venue_id);
create index tournament_ticket_use_txn_idx on public.tournament_ticket (use_transaction_id, venue_id);
create index tournament_ticket_refund_txn_idx on public.tournament_ticket (refund_transaction_id, venue_id);

create trigger tournament_ticket_touch_updated_at before update on public.tournament_ticket
  for each row execute function private.touch_updated_at();
create trigger tournament_ticket_audit after insert or update or delete on public.tournament_ticket
  for each row execute function private.audit_row_change();

alter table public.tournament_ticket enable row level security;
-- Not the ledger transactions, as a buy's is not shown either.
grant select (id, venue_id, member_id, satellite_id, entry_id, target_id, value_paise, status, created_at, updated_at)
  on public.tournament_ticket to authenticated;
create policy "staff who run tournaments, the cage or read the ledger see the venue's tickets" on public.tournament_ticket
  for select to authenticated
  using (venue_id in (select private.venues_where('tournaments.manage')) or venue_id in (select private.venues_where('cage.transact'))
         or venue_id in (select private.venues_where('ledger.read')));
create policy "members with tournament registration see their own tickets" on public.tournament_ticket
  for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature(member_id, 'tournaments.register'));

-- A member's export gives their tickets whole (decision 0240).
insert into private.member_export_column (table_name, column_name, kind)
select 'tournament_ticket', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'member_id', 'satellite_id', 'entry_id', 'target_id', 'value_paise', 'status', 'issue_transaction_id',
                  'use_transaction_id', 'refund_transaction_id', 'created_at', 'updated_at']) c (column_name);

-- A satellite's seats: the pool at the target's buy-in, rounded down and never more than the runs, and what is
-- left over with the place it is paid to (the next finisher, or the last seat when every run has one). 22023
-- for a pool or buy-in not in ₹50 chips, a buy-in of nothing or no runs. The twin of @rivr/domain
-- satelliteSeats (golden tournamentPayouts.json).
create function private.tournament_satellite_seats(p_pool bigint, p_buy_in bigint, p_runs integer)
returns table (seats integer, leftover_paise bigint, leftover_place integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_seats integer;
begin
  if p_pool is null or p_buy_in is null or p_runs is null or p_pool < 0 or p_pool % 5000 <> 0 or p_buy_in <= 0 or p_buy_in % 5000 <> 0
     or p_runs < 1 then
    raise exception 'A pool and a buy-in in ₹50 chips, and a run' using errcode = '22023';
  end if;
  v_seats := least(p_pool / p_buy_in, p_runs);
  return query select v_seats, p_pool - v_seats * p_buy_in, case when v_seats < p_runs then v_seats + 1 else v_seats end;
end;
$$;

-- A satellite's seats as its field stands: its prize pool (with any overlay its guarantee needs) at its
-- target's buy-in, over its runs. Nothing for a tournament that is not a satellite.
create function private.tournament_satellite_result(p_tournament public.tournament)
returns table (seats integer, leftover_paise bigint, leftover_place integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_tournament.satellite_target_id is null then
    return;
  end if;
  return query
    select s.seats, s.leftover_paise, s.leftover_place
    from private.tournament_prize_pool((select c.pool_paise from private.tournament_counts(p_tournament.id) c), p_tournament.guarantee_paise) p
    cross join lateral private.tournament_satellite_seats(p.pool_paise,
      (select t.buy_in_paise from public.tournament t where t.id = p_tournament.satellite_target_id),
      greatest((select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status <> 'refunded'), 1)) s;
end;
$$;

-- Makes a tournament a satellite for p_target_id, or an ordinary one again (null), for tournaments.manage
-- before anyone has entered it or its clock has started, so no player's buy-in changes what it pays. The
-- target is another tournament at the venue with levels, not finished, its registration open. Refusals: 42501;
-- 22023 any of those, or a satellite with a bounty; RVFRZ.
create function private.set_tournament_satellite(p_tournament_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id);
  v_target public.tournament;
begin
  perform private.assert_runs_tournaments(v_venue_id);
  perform private.assert_writable(v_venue_id);
  perform 1 from public.tournament t where t.id = p_tournament_id for update;
  select * into v_target from public.tournament t where t.id = p_target_id for update;
  if (select t.clock_started_at from public.tournament t where t.id = p_tournament_id) is not null or p_target_id = p_tournament_id
     or exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament_id and e.status <> 'refunded')
     or (p_target_id is not null
         and (v_target.levels is null or v_target.finished_at is not null
              or not coalesce(private.tournament_level_now(v_target) <= v_target.last_registration_level, false))) then
    raise exception 'Before anyone enters, a satellite for another tournament whose registration is open' using errcode = '22023';
  end if;
  begin
    update public.tournament set satellite_target_id = p_target_id where id = p_tournament_id;
  exception when check_violation or foreign_key_violation then
    raise exception 'A satellite, with no bounty, for a tournament at this venue' using errcode = '22023';
  end;
end;
$$;

-- Moves a finished satellite's seats from the prize pool to the tickets held, and gives each run that finished
-- in a seat its ticket to the target, worth the target's buy-in.
create function private.issue_tournament_tickets(p_satellite public.tournament)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buy_in bigint := (select t.buy_in_paise from public.tournament t where t.id = p_satellite.satellite_target_id);
  v_seats integer := (select s.seats from private.tournament_satellite_result(p_satellite) s);
  v_transaction_id uuid;
begin
  if v_seats = 0 then
    return;
  end if;
  v_transaction_id := private.post_ledger_transaction(p_satellite.venue_id, 'tournament_tickets', 'tournament_tickets:' || p_satellite.id,
    (select jsonb_agg(jsonb_build_object('account_id', a.id,
                                         'amount', case when a.code = 'venue.tournament_pool' then v_seats * v_buy_in else -(v_seats * v_buy_in) end::text))
     from public.ledger_account a where a.venue_id = p_satellite.venue_id and a.member_id is null
       and a.code in ('venue.tournament_pool', 'venue.tournament_tickets')),
    null, 'A satellite''s seats, held as tickets to its target');
  insert into public.tournament_ticket (venue_id, member_id, satellite_id, entry_id, target_id, value_paise, issue_transaction_id)
  select e.venue_id, e.member_id, e.tournament_id, e.id, p_satellite.satellite_target_id, v_buy_in, v_transaction_id
  from public.tournament_entry e
  where e.tournament_id = p_satellite.id and e.place <= v_seats;
end;
$$;

-- As 20261027120200_tournament_finish.sql left it, with satellites: one needs no places' shares, takes no deal,
-- and is played out once no more players are left than it has seats (one, when it has none). With more than one
-- left, the floor counts their chips, as for a deal, and the chips give their places. A ticket carries no TDS
-- until question #517 is answered, so a satellite finishes only while TDS is switched off (RVTRN tds_switched_on).
create or replace function private.tournament_finishers(p_tournament public.tournament, p_method text, p_stacks jsonb)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_left integer := (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated');
  v_most_left integer := 1;
  -- A deal, or a satellite finished with more than one left: the chips of each player left are counted.
  v_is_counted boolean := p_method is not null or v_left > 1;
begin
  if p_tournament.clock_started_at is null or p_method not in ('icm', 'chip_chop')
     or (p_tournament.satellite_target_id is not null and p_method is not null) then
    raise exception 'A tournament under way, played out or by ICM or chip-chop (a satellite is played out)' using errcode = '22023';
  end if;
  if p_tournament.payout_shares is null and p_tournament.satellite_target_id is null then
    raise exception 'Set each paid place''s share of the pool first' using errcode = 'RVTRN', hint = 'payouts_unset';
  end if;
  if exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'alternate') then
    raise exception 'Refund the alternates who never sat first' using errcode = 'RVTRN', hint = 'alternates_waiting';
  end if;
  if p_tournament.satellite_target_id is not null then
    if coalesce((private.setting_at(p_tournament.venue_id, 'tds.config', '', now()) ->> 'enabled')::boolean, false) then
      raise exception 'A satellite finishes while TDS is switched off, until question #517 is answered'
        using errcode = 'RVTRN', hint = 'tds_switched_on';
    end if;
    v_most_left := greatest((select s.seats from private.tournament_satellite_result(p_tournament) s), 1);
  end if;
  if (p_method is null and v_left > v_most_left) or (p_method is not null and v_left not between 2 and 9)
     or not exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status in ('seated', 'busted')) then
    raise exception 'Played out with one player left (no more than the seats in a satellite), or a deal among two to nine'
      using errcode = 'RVTRN', hint = 'players_left';
  end if;
  if v_is_counted and (jsonb_typeof(p_stacks) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_stacks)) <> v_left
     or exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated'
                and coalesce(p_stacks ->> e.id::text, '') !~ '^[1-9][0-9]{0,11}$')
     or (select sum((s.value)::text::bigint) from jsonb_each(p_stacks) s) > (select c.chips_in_play from private.tournament_counts(p_tournament.id) c)) then
    raise exception 'The chips of each player left, a whole number above nothing, no more than were bought' using errcode = '22023';
  end if;
  if exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated'
             and coalesce(private.is_own_kyc_check(e.member_id), false)) then
    raise exception 'Staff never finish a tournament they are still playing' using errcode = '42501';
  end if;
  return array(select e.id from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated'
               order by case when v_is_counted then (p_stacks ->> e.id::text)::bigint else 0 end desc, e.created_at, e.id);
end;
$$;

-- As 20261027120200_tournament_finish.sql left it, with satellites: the seats are paid in tickets, so only what
-- is left over is paid in cash, to its place.
create or replace function private.tournament_winnings(p_tournament public.tournament, p_method text, p_stacks jsonb, p_left uuid[])
returns table (entry_id uuid, place integer, prize_paise bigint, bounty_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pool record;
  v_satellite record;
  v_runs integer := (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status <> 'refunded');
  v_prizes bigint[];
  v_deal bigint[];
  v_top bigint[];
begin
  select * into v_pool from private.tournament_prize_pool((select c.pool_paise from private.tournament_counts(p_tournament.id) c),
                                                          p_tournament.guarantee_paise);
  if p_tournament.satellite_target_id is not null then
    select * into v_satellite from private.tournament_satellite_result(p_tournament);
    v_prizes := array(select case when n = v_satellite.leftover_place then v_satellite.leftover_paise else 0 end
                      from generate_series(1, v_runs) n order by n);
  else
    v_prizes := private.tournament_payout_table(v_pool.pool_paise, p_tournament.payout_shares, v_runs);
  end if;
  if p_method is not null then
    v_top := array(select coalesce(v_prizes[n], 0) from generate_series(1, cardinality(p_left)) n order by n);
    v_deal := case p_method
      when 'icm' then private.tournament_icm(array(select (p_stacks ->> l.id::text)::bigint from unnest(p_left) with ordinality l (id, n) order by l.n), v_top)
      else private.tournament_chip_chop(array(select (p_stacks ->> l.id::text)::bigint from unnest(p_left) with ordinality l (id, n) order by l.n), v_top) end;
  end if;
  return query
    select e.id, e.place, coalesce(v_deal[e.place], v_prizes[e.place], 0),
           case when e.id = any(p_left) then private.tournament_bounty_on(e.id) else 0 end
    from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status <> 'refunded';
end;
$$;

-- As 20261027120200_tournament_finish.sql left it, a satellite's tickets issued as it finishes.
create or replace function private.finish_tournament(p_tournament_id uuid, p_method text, p_stacks jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournament := (select t from public.tournament t where t.id = p_tournament_id);
  v_left uuid[];
  v_overlay bigint;
begin
  perform private.assert_runs_tournaments(v_tournament.venue_id);
  perform 1 from public.tournament t where t.id = p_tournament_id for update;
  v_tournament := (select t from public.tournament t where t.id = p_tournament_id);
  if v_tournament.finished_at is not null then
    return;
  end if;
  perform private.assert_writable(v_tournament.venue_id);
  v_left := private.tournament_finishers(v_tournament, p_method, p_stacks);
  -- Every run's place: those left by the order above, the rest by their busts.
  update public.tournament_entry e set place = array_position(v_left, e.id) where e.id = any(v_left);
  update public.tournament_entry e set place = p.place from private.tournament_places(p_tournament_id) p where p.entry_id = e.id and e.status = 'busted';
  v_overlay := (select p.overlay_paise from private.tournament_prize_pool((select c.pool_paise from private.tournament_counts(p_tournament_id) c),
                                                                       v_tournament.guarantee_paise) p);
  if v_overlay > 0 then
    perform private.post_ledger_transaction(v_tournament.venue_id, 'tournament_overlay', 'tournament_overlay:' || p_tournament_id,
      (select jsonb_agg(jsonb_build_object('account_id', a.id, 'amount', case when a.code = 'venue.tournament_overlay' then v_overlay else -v_overlay end::text))
       from public.ledger_account a where a.venue_id = v_tournament.venue_id and a.member_id is null
         and a.code in ('venue.tournament_overlay', 'venue.tournament_pool')),
      null, 'The overlay a tournament''s guarantee needs');
  end if;
  if v_tournament.satellite_target_id is not null then
    perform private.issue_tournament_tickets(v_tournament);
  end if;
  perform private.pay_tournament_run(w.entry_id, w.place, w.prize_paise, w.bounty_paise, 0, null)
  from private.tournament_winnings(v_tournament, p_method, p_stacks, v_left) w where w.prize_paise + w.bounty_paise > 0;
  perform private.award_league_points(p_tournament_id, b.member_id, b.place, now())
  from (select e.member_id, min(e.place) as place from public.tournament_entry e where e.tournament_id = p_tournament_id and e.place is not null
        group by e.member_id) b;
  update public.tournament set finished_at = now(), overlay_paise = v_overlay, deal_method = p_method,
                               deal_stacks = case when p_method is not null then p_stacks end
  where id = p_tournament_id;
  perform private.emit(v_tournament.venue_id, 'tournament.finished',
    jsonb_build_object('tournament_id', p_tournament_id, 'overlay_paise', v_overlay, 'deal_method', p_method,
                       'deal_stacks', case when p_method is not null then p_stacks end,
                       'winner_member_id', (select e.member_id from public.tournament_entry e where e.tournament_id = p_tournament_id and e.place = 1)),
    'tournament.finished:' || p_tournament_id);
end;
$$;

-- As 20261026235200_tournament_entries.sql left it, with a satellite's ticket: it pays the buy-in, its fee
-- included, from the tickets held, with the cage's checks on the player (frozen, identity, a break).
-- RVTRN no_ticket when the member holds none to this tournament.
create or replace function private.post_tournament_buy(p_tournament public.tournament, p_member_id uuid, p_paid_by text, p_price bigint, p_fee bigint,
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
  v_ticket public.tournament_ticket;
  v_transaction_id uuid;
begin
  if p_paid_by = 'wallet' then
    return private.debit_wallet(p_tournament.venue_id, p_member_id, p_price, 'tournament_buy', p_key, v_to);
  end if;
  -- The ticket before the member, the order the minute's lapse locks them in.
  if p_paid_by = 'ticket' then
    select * into v_ticket from public.tournament_ticket k
    where k.target_id = p_tournament.id and k.member_id = p_member_id and k.status = 'held'
    order by k.created_at, k.id limit 1
    for update;
    if v_ticket.id is null then
      raise exception 'No ticket to this tournament' using errcode = 'RVTRN', hint = 'no_ticket';
    end if;
    if v_ticket.value_paise <> p_price then
      raise exception 'A ticket pays the buy-in it was won for' using errcode = '22023';
    end if;
  end if;
  perform private.assert_tournament_player(p_tournament.venue_id, p_member_id);
  v_transaction_id := private.post_ledger_transaction(p_tournament.venue_id, 'tournament_buy', p_key,
    (select jsonb_agg(jsonb_build_object('account_id', a.id, 'amount', l.amount::text))
     from (select case when p_paid_by = 'ticket' then 'venue.tournament_tickets' else 'venue.cash_drawer' end as code, p_price as amount
           union all select t.value ->> 'code', -(t.value ->> 'amount')::bigint from jsonb_array_elements(v_to) t) l
     join public.ledger_account a on a.venue_id = p_tournament.venue_id and a.member_id is null and a.code = l.code),
    'tournament_registration', case when p_paid_by = 'ticket' then 'A tournament entry paid with a satellite ticket' else 'A tournament buy at the cage' end);
  update public.tournament_ticket set status = 'used', use_transaction_id = v_transaction_id where id = v_ticket.id;
  return v_transaction_id;
end;
$$;

-- As 20261026235200_tournament_entries.sql left it, paid from the wallet, in cash or with a satellite's ticket.
create or replace function private.tournament_buy(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_paid_by text, p_idempotency_key uuid)
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
  if v_tournament.id is null or v_tournament.levels is null or p_paid_by not in ('wallet', 'cash', 'ticket') then
    raise exception 'A tournament with levels, paid from the wallet, in cash or with a ticket' using errcode = '22023';
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

-- A member enters a tournament with their satellite ticket: from the app, the member themselves with
-- tournament registration at their club's published tournament; at the cage, a cashier for them (never their
-- own member record). Once per request id, as any buy. Refusals: 42501; RVOWN; RVTRN the rules (already
-- entered, registration closed...) or no_ticket; and the cage's checks on the player (RVNOM, RVKYC, RVBRK).
create function private.use_tournament_ticket(p_tournament_id uuid, p_member_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id);
  v_is_own boolean := coalesce(p_member_id = private.current_member_id() and private.has_feature(p_member_id, 'tournaments.register')
                               and exists (select 1 from public.tournament t where t.id = p_tournament_id and t.is_published
                                           and t.venue_id = private.current_member_venue_id()), false);
begin
  if v_venue_id is null or not (v_is_own or coalesce(private.has_permission(v_venue_id, 'cage.transact'), false)) then
    raise exception 'A member enters with their own ticket, or a cashier for them' using errcode = '42501';
  end if;
  if not v_is_own and private.is_own_cage_record(p_member_id) then
    raise exception 'A cashier never serves their own member record' using errcode = 'RVOWN';
  end if;
  return private.tournament_buy(p_tournament_id, p_member_id, 'entry', 'ticket', p_idempotency_key);
end;
$$;

-- As 20261026235300_tournament_floor.sql left it, an alternate's ticket given back to be used again.
create or replace function private.refund_tournament_alternate(p_entry_id uuid)
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
  update public.tournament_ticket k set status = 'held', use_transaction_id = null
  from public.tournament_purchase p where p.entry_id = p_entry_id and k.use_transaction_id = p.ledger_transaction_id;
  update public.tournament_entry set status = 'refunded' where id = p_entry_id;
end;
$$;

-- Refunds to the wallet, from the tickets held, each ticket still held once its target's registration has
-- closed, the target has finished, or a day has passed since its start with its clock never started. Each
-- minute; a frozen venue's or member's waits until released.
create function private.lapse_tournament_tickets()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tournament_ticket;
begin
  for v_ticket in
    select k.* from public.tournament_ticket k join public.tournament t on t.id = k.target_id
    where k.status = 'held'
      and (t.finished_at is not null or private.tournament_level_now(t) > t.last_registration_level
           or (t.clock_started_at is null and t.starts_at < now() - interval '1 day'))
      and not exists (select 1 from public.control_state c where c.venue_id = k.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = k.member_id)))
    order by k.created_at
    for update of k skip locked
  loop
    update public.tournament_ticket
    set status = 'refunded',
        refund_transaction_id = private.credit_wallet(v_ticket.venue_id, v_ticket.member_id, v_ticket.value_paise, 'tournament_ticket_refund',
          'tournament_ticket_refund:' || v_ticket.id,
          jsonb_build_array(jsonb_build_object('code', 'venue.tournament_tickets', 'amount', v_ticket.value_paise)), 0)
    where id = v_ticket.id;
  end loop;
end;
$$;

select cron.schedule('tournament-ticket-lapse', '* * * * *', 'select private.lapse_tournament_tickets()');

-- As 20261027130000_member_erasure.sql left it, a satellite ticket still held counting as a tournament.
create or replace function private.member_erasure_blockers(p_member_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with balance as (
    select a.code, private.account_balance(a.id) as amount from public.ledger_account a where a.member_id = p_member_id
  )
  select array_remove(array[
    case when exists (select 1 from public.control_state c where c.venue_id = m.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = m.id))) then 'frozen' end,
    case when exists (select 1 from balance b where b.code = 'member.cash' and b.amount <> 0) then 'cash' end,
    case when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null)
           or exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'chips' end,
    case when exists (select 1 from balance b where b.code = 'member.receivable' and b.amount <> 0)
           or exists (select 1 from public.marker k where k.member_id = m.id and k.settled_at is null) then 'markers' end,
    -- Points or bonus owed to the club (a liability above zero): never forfeited, so set right first.
    case when exists (select 1 from balance b where b.code in ('member.points', 'member.bonus') and b.amount > 0) then 'rewards' end,
    case when exists (select 1 from public.redemption r where r.member_id = m.id and r.handed_over_at is null) then 'redemptions' end,
    case when exists (select 1 from public.waitlist_entry w where w.member_id = m.id and w.status = 'waiting') then 'waitlist' end,
    case when exists (select 1 from public.tournament_entry e join public.tournament t on t.id = e.tournament_id
                      where e.member_id = m.id and e.status <> 'refunded' and t.finished_at is null)
           or exists (select 1 from public.tournament_ticket k where k.member_id = m.id and k.status = 'held') then 'tournament' end,
    case when exists (select 1 from public.buy_in_request b where b.member_id = m.id and b.status = 'waiting')
           or exists (select 1 from public.withdrawal_request w where w.member_id = m.id and w.status = 'waiting')
           or exists (select 1 from public.deposit_request d where d.member_id = m.id and d.status = 'waiting') then 'requests' end,
    case when exists (select 1 from public.academy_booking a where a.member_id = m.id and a.status in ('awaiting_payment', 'payment_claimed'))
      then 'academy' end
  ], null)
  from public.member m
  where m.id = p_member_id;
$$;

create function public.set_tournament_satellite(p_tournament_id uuid, p_target_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_tournament_satellite(p_tournament_id, p_target_id); $$;
create function public.use_tournament_ticket(p_tournament_id uuid, p_member_id uuid, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.use_tournament_ticket(p_tournament_id, p_member_id, p_idempotency_key); $$;

revoke execute on function private.tournament_satellite_seats(bigint, bigint, integer), private.tournament_satellite_result(public.tournament),
  private.set_tournament_satellite(uuid, uuid), private.issue_tournament_tickets(public.tournament), private.use_tournament_ticket(uuid, uuid, uuid),
  private.lapse_tournament_tickets() from public, anon, authenticated;
grant execute on function private.set_tournament_satellite(uuid, uuid), private.use_tournament_ticket(uuid, uuid, uuid) to authenticated;
revoke execute on function public.set_tournament_satellite(uuid, uuid), public.use_tournament_ticket(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_tournament_satellite(uuid, uuid), public.use_tournament_ticket(uuid, uuid, uuid) to authenticated;

-- The tournament gains its target and every venue its tickets account; the practice venue's seed keeps them (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
