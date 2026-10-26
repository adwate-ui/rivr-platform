-- Finishing a tournament and paying it out (#121, #149; decisions 0205, 0206). The floor finishes it when
-- one player is left, or with a deal (ICM or chip-chop) among the two to nine left. Every run keeps its
-- place; the overlay a guarantee needs is booked from venue.tournament_overlay into the pool; each run in
-- the money, and each player left with their own bounty, is paid to the wallet after TDS; each member's
-- best place earns League points (private.award_league_points); tournament.finished is emitted. A finished
-- tournament takes no more buys, busts, moves or refunds, and leaves the TVs and Home.

alter table public.tournament
  -- Each paid place's share of the prize pool, in basis points adding up to 100%, as the floor sets them
  -- for the tournament (question #470); there is no default.
  add column payout_shares integer[] check (payout_shares is null or private.tournament_shares_whole(payout_shares)),
  add column finished_at timestamptz,
  add column overlay_paise bigint check (overlay_paise >= 0 and overlay_paise % 5000 = 0),
  add column deal_method text check (deal_method in ('icm', 'chip_chop')),
  -- A deal's stacks as counted, {"<entry id>": chips}, kept so the deal can be worked again.
  add column deal_stacks jsonb,
  add constraint tournament_finish_whole check ((finished_at is null) = (overlay_paise is null) and (deal_method is null or finished_at is not null)
                                                and (deal_method is null) = (deal_stacks is null));
-- The place a run finished in, kept when the tournament finishes.
alter table public.tournament_entry add column place integer check (place >= 1);

-- A finished tournament changes no more (a purge of the practice venue aside, decision 0117).
create function private.refuse_after_finish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not coalesce(private.purging(new.venue_id), false)
     and exists (select 1 from public.tournament t where t.id = new.tournament_id and t.finished_at is not null) then
    raise exception 'The tournament is finished' using errcode = 'RVTRN', hint = 'finished';
  end if;
  return new;
end;
$$;
create trigger tournament_entry_after_finish before insert or update on public.tournament_entry
  for each row execute function private.refuse_after_finish();
create trigger tournament_purchase_after_finish before insert on public.tournament_purchase
  for each row execute function private.refuse_after_finish();
create trigger tournament_payout_after_finish before insert on public.tournament_payout
  for each row execute function private.refuse_after_finish();

-- Each run's place: the one kept at the finish, or for a bust as things stand (the runs not refunded, less
-- where its bust stands among the busts). As 20261026235300_tournament_floor.sql left it, with the kept places.
create or replace function private.tournament_places(p_tournament_id uuid)
returns table (entry_id uuid, place integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, coalesce(b.place, private.tournament_finish_place(
    (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament_id and e.status <> 'refunded'),
    (rank() over (order by b.bust_order))::integer))
  from public.tournament_entry b where b.tournament_id = p_tournament_id and b.status = 'busted'
  union all
  select s.id, s.place from public.tournament_entry s where s.tournament_id = p_tournament_id and s.status = 'seated' and s.place is not null;
$$;

-- Sets each paid place's share of the prize pool, for tournaments.manage, until a player busts into a paid
-- place (by the old shares or the new) or the tournament finishes; the places paid become as many as the
-- shares. Refusals: 42501; 22023 not one to a hundred shares above nothing, none above the place before's,
-- in basis points adding up to 100%; RVTRN shares_locked, finished; RVFRZ.
create function private.set_tournament_payouts(p_tournament_id uuid, p_shares integer[])
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
  if not coalesce(private.tournament_shares_whole(p_shares), false) then
    raise exception 'One to a hundred shares above nothing, adding up to 100%%' using errcode = '22023';
  end if;
  if (select t.finished_at from public.tournament t where t.id = p_tournament_id) is not null then
    raise exception 'The tournament is finished' using errcode = 'RVTRN', hint = 'finished';
  end if;
  -- Once a player is out in the money, what each place pays stays as it was.
  if exists (select 1 from private.tournament_places(p_tournament_id) p
             where p.place <= greatest(cardinality(p_shares),
                                       coalesce((select cardinality(t.payout_shares) from public.tournament t where t.id = p_tournament_id), 0))) then
    raise exception 'A player is already out in the money' using errcode = 'RVTRN', hint = 'shares_locked';
  end if;
  update public.tournament set payout_shares = p_shares, places_paid = cardinality(p_shares) where id = p_tournament_id;
end;
$$;

-- The runs left at the finish, first place first: the one left when played out (p_method null; none when
-- the last was busted too, the last out winning), or the two to nine in a deal by their chips in p_stacks
-- ({"<entry id>": chips}, no more than the chips bought), the earlier entry first on a tie. Refusals: 42501
-- a player left who is the caller's own member record; 22023 the clock not started, another method, or not
-- a whole number of chips above nothing for each player left; RVTRN payouts_unset (the floor sets the
-- places' shares first), alternates_waiting (an alternate who never sat must be refunded first, or they
-- would count as a run) or players_left.
create function private.tournament_finishers(p_tournament public.tournament, p_method text, p_stacks jsonb)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_left integer := (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'seated');
begin
  if p_tournament.clock_started_at is null or p_method not in ('icm', 'chip_chop') then
    raise exception 'A tournament under way, played out or by ICM or chip-chop' using errcode = '22023';
  end if;
  if p_tournament.payout_shares is null then
    raise exception 'Set each paid place''s share of the pool first' using errcode = 'RVTRN', hint = 'payouts_unset';
  end if;
  if exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status = 'alternate') then
    raise exception 'Refund the alternates who never sat first' using errcode = 'RVTRN', hint = 'alternates_waiting';
  end if;
  if (p_method is null and v_left > 1) or (p_method is not null and v_left not between 2 and 9)
     or not exists (select 1 from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status in ('seated', 'busted')) then
    raise exception 'Played out with one player left, or a deal among two to nine' using errcode = 'RVTRN', hint = 'players_left';
  end if;
  if p_method is not null and (jsonb_typeof(p_stacks) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_stacks)) <> v_left
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
               order by case when p_method is null then 0 else (p_stacks ->> e.id::text)::bigint end desc, e.created_at, e.id);
end;
$$;

-- What each run wins: its place's prize, or its share of the deal for the places the players left would
-- have played for; and its own bounty when it was left at the end.
create function private.tournament_winnings(p_tournament public.tournament, p_method text, p_stacks jsonb, p_left uuid[])
returns table (entry_id uuid, place integer, prize_paise bigint, bounty_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pool record;
  v_prizes bigint[];
  v_deal bigint[];
  v_top bigint[];
begin
  select * into v_pool from private.tournament_prize_pool((select c.pool_paise from private.tournament_counts(p_tournament.id) c),
                                                          p_tournament.guarantee_paise);
  v_prizes := private.tournament_payout_table(v_pool.pool_paise, p_tournament.payout_shares,
    (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament.id and e.status <> 'refunded'));
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

-- Finishes a tournament and pays it out, for tournaments.manage, once (a replay changes nothing): played
-- out (p_method null) with one player left (or none, the last out winning), or with a deal ('icm' or
-- 'chip_chop') among the two to nine left, p_stacks giving each one's chips. Refusals: 42501; 22023
-- (private.tournament_finishers); RVTRN payouts_unset, alternates_waiting or players_left; RVFRZ the venue;
-- RVMBR a winner frozen.
create function private.finish_tournament(p_tournament_id uuid, p_method text, p_stacks jsonb)
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

-- What a finished (or running) tournament paid, for staff who run tournaments, the cage or read the
-- ledger: prizes by place, then bounties as they were paid; each with the player, the TDS and whether it
-- was shadow.
create function private.tournament_payouts(p_tournament_id uuid)
returns table (payout_id uuid, kind text, place integer, member_id uuid, full_name text, entry_number integer, prize_paise bigint,
               bounty_paise bigint, tds_paise bigint, is_tds_shadow boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kind, p.place, m.id, m.full_name, e.entry_number, p.prize_paise, p.bounty_paise, p.tds_paise, p.is_tds_shadow, p.created_at
  from public.tournament_payout p join public.member m on m.id = p.member_id join public.tournament_entry e on e.id = p.entry_id
  where p.tournament_id = p_tournament_id
    and (private.has_permission(p.venue_id, 'tournaments.manage') or private.has_permission(p.venue_id, 'cage.transact')
         or private.has_permission(p.venue_id, 'ledger.read'))
  order by p.kind desc, p.place, p.created_at;
$$;

-- The running tournament leaves the TVs and Home once finished. As 20261026231200_tournament_clock.sql left it.
create or replace function private.running_tournament(p_venue_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.tournament t
  where t.venue_id = p_venue_id and t.is_published and t.clock_started_at > now() - interval '1 day' and t.finished_at is null
    and private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now())
        < private.tournament_stage_start(t.levels, jsonb_array_length(t.levels))
  order by t.clock_started_at desc
  limit 1;
$$;

drop function public.venue_tournaments(uuid);
drop function private.venue_tournaments(uuid);
-- As 20261026235300_tournament_floor.sql left it, with the bounty, and the finish and its overlay.
create function private.venue_tournaments(p_venue_id uuid)
returns table (id uuid, name text, starts_at timestamptz, is_published boolean, format text, buy_in_paise bigint, fee_paise bigint,
               guarantee_paise bigint, starting_stack integer, levels jsonb, last_registration_level integer, max_buys integer,
               add_on_paise bigint, add_on_fee_paise bigint, add_on_chips integer, places_paid integer, clock_started_at timestamptz,
               is_paused boolean, elapsed_seconds integer, tables integer, seats_per_table integer, entries integer, re_entries integer,
               players_left integer, chips_in_play bigint, pool_paise bigint, bounty_paise bigint, bounty_kind text, finished_at timestamptz,
               overlay_paise bigint, payout_shares integer[])
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.starts_at, t.is_published, t.format, t.buy_in_paise, t.fee_paise, t.guarantee_paise, t.starting_stack, t.levels,
         t.last_registration_level, t.max_buys, t.add_on_paise, t.add_on_fee_paise, t.add_on_chips, t.places_paid, t.clock_started_at,
         t.clock_paused_at is not null, private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now()),
         t.tables, t.seats_per_table, c.entries, c.re_entries, c.players_left, c.chips_in_play, c.pool_paise, t.bounty_paise, t.bounty_kind,
         t.finished_at, t.overlay_paise, t.payout_shares
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
               overlay_paise bigint, payout_shares integer[])
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_tournaments(p_venue_id); $$;
create function public.set_tournament_payouts(p_tournament_id uuid, p_shares integer[])
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_tournament_payouts(p_tournament_id, p_shares); $$;
create function public.finish_tournament(p_tournament_id uuid, p_method text default null, p_stacks jsonb default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.finish_tournament(p_tournament_id, p_method, p_stacks); $$;
create function public.tournament_payouts(p_tournament_id uuid)
returns table (payout_id uuid, kind text, place integer, member_id uuid, full_name text, entry_number integer, prize_paise bigint,
               bounty_paise bigint, tds_paise bigint, is_tds_shadow boolean, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tournament_payouts(p_tournament_id); $$;

revoke execute on function private.set_tournament_payouts(uuid, integer[]), public.set_tournament_payouts(uuid, integer[]) from public, anon;
grant execute on function private.set_tournament_payouts(uuid, integer[]), public.set_tournament_payouts(uuid, integer[]) to authenticated;
revoke execute on function private.refuse_after_finish(), private.tournament_finishers(public.tournament, text, jsonb),
  private.tournament_winnings(public.tournament, text, jsonb, uuid[]), private.finish_tournament(uuid, text, jsonb),
  private.tournament_payouts(uuid), private.venue_tournaments(uuid) from public, anon, authenticated;
grant execute on function private.finish_tournament(uuid, text, jsonb), private.tournament_payouts(uuid), private.venue_tournaments(uuid) to authenticated;
revoke execute on function public.venue_tournaments(uuid), public.finish_tournament(uuid, text, jsonb), public.tournament_payouts(uuid) from public, anon;
grant execute on function public.venue_tournaments(uuid), public.finish_tournament(uuid, text, jsonb), public.tournament_payouts(uuid) to authenticated;

-- The tournament gains its bounty and its finish, and the practice venue's seed keeps them (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
