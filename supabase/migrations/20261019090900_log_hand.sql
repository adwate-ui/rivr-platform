-- Hand entry (#42, scope-v1 module 4; design prompt flows 4 and 5). On the tablet fixed to a table,
-- during a dealer's down, the dealer types the final pot (whole ₹50 chips) and taps the variant: the
-- hand is logged with its rake, whether the cap applied, and the jackpot drop, from the rules in
-- force when it was played (rake.config for the table's game, jackpot.drop for the venue). Rake and
-- drop post to the ledger: chips leave play for the house's rake and the bad-beat jackpot.
-- High-hand claims (#47), CCTV references (#122) and the jackpot's sub-pools (#48) add to this.

create type public.hand_variant as enum ('holdem', 'plo', 'bomb_pot');

create table public.hand (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  table_id uuid not null,
  down_id uuid not null references public.dealer_down (id),
  -- The dealer whose down it was.
  staff_id uuid not null,
  device_id uuid not null,
  variant public.hand_variant not null,
  pot_paise bigint not null check (pot_paise > 0 and pot_paise % 5000 = 0),
  rake_paise bigint not null check (rake_paise >= 0 and rake_paise % 5000 = 0),
  drop_paise bigint not null check (drop_paise >= 0 and drop_paise % 5000 = 0),
  is_cap_applied boolean not null,
  -- When the hand was played, as the tablet says (an offline tablet sends it later, B-013); its rules are those in force then.
  played_at timestamptz not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (device_id, venue_id) references public.device (id, venue_id),
  unique (venue_id, idempotency_key),
  check (rake_paise + drop_paise <= pot_paise)
);

comment on table public.hand is 'Every hand from the dealer tablet: pot, variant, rake, cap applied, jackpot drop (#42).';

create index hand_table_played_idx on public.hand (table_id, played_at);
create index hand_venue_played_idx on public.hand (venue_id, played_at);
create index hand_down_idx on public.hand (down_id);
create index hand_staff_venue_idx on public.hand (staff_id, venue_id);
create index hand_device_venue_idx on public.hand (device_id, venue_id);
create trigger hand_touch_updated_at before update on public.hand
  for each row execute function private.touch_updated_at();
alter table public.hand enable row level security;
-- No client writes a hand: only log_hand does, and a hand is never changed (corrections reverse it later).
grant select on public.hand to authenticated;

create policy "staff see the venue's hands, and a tablet its table's" on public.hand
  for select to authenticated
  using (venue_id in (select private.staff_venues())
         or table_id = (select a.table_id from public.tablet_assignment a where a.device_id = (select private.current_device_id())));

-- @rivr/domain potTake in SQL, proved on the same golden file (packages/testing/golden/rake.json,
-- 024_golden_twins). Rake is the rate's share of the pot (floored), no more than the cap, rounded
-- down to ₹50 chips; while the jackpot is live a pot above the threshold drops the drop (in chips);
-- the pull is both; the cap applied when the share was more than the cap.
create function private.pot_take(p_pot bigint, p_rate_basis_points integer, p_cap bigint, p_is_jackpot_live boolean,
                                 p_drop bigint, p_drop_above bigint)
returns table (rake bigint, drop_paise bigint, pull bigint, is_cap_applied boolean)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_share bigint;
  v_rake bigint;
  v_drop bigint;
begin
  if p_pot is null or p_pot < 0 then
    raise exception 'A pot is never negative' using errcode = '22023';
  end if;
  v_share := (p_pot * p_rate_basis_points) / 10000;
  v_rake := least(v_share, p_cap) - least(v_share, p_cap) % 5000;
  v_drop := case when p_is_jackpot_live and p_pot > p_drop_above then p_drop - p_drop % 5000 else 0 end;
  return query select v_rake, v_drop, v_rake + v_drop, v_share > p_cap;
end;
$$;

-- The rules for a table's game at a time: its rake (rake.config), whether it plays variations, and
-- the venue's jackpot drop (jackpot.drop). The jackpot is live while the venue sets a drop above
-- zero (decision 0047). Nothing when the game has no rake set.
create function private.rake_rules_at(p_table_id uuid, p_at timestamptz)
returns table (rate_basis_points integer, cap_paise bigint, is_jackpot_live boolean, drop_paise bigint,
               drop_above_paise bigint, has_variation boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (rake.config ->> 'rate_basis_points')::integer, (rake.config ->> 'cap_paise')::bigint,
         coalesce((jackpot.config ->> 'drop_paise')::bigint, 0) > 0, coalesce((jackpot.config ->> 'drop_paise')::bigint, 0),
         coalesce((jackpot.config ->> 'above_paise')::bigint, 0), tt.has_variation
  from public.game_table t
  join public.table_type tt on tt.id = t.table_type_id
  cross join lateral (select private.setting_at(t.venue_id, 'rake.config', tt.code, p_at) as config) rake
  cross join lateral (select private.setting_at(t.venue_id, 'jackpot.drop', '', p_at) as config) jackpot
  where t.id = p_table_id and rake.config is not null;
$$;

-- The tablet's rules now, so it shows the rake, drop and pull as the pot is typed.
create function private.tablet_rake_rules()
returns table (rate_basis_points integer, cap_paise bigint, is_jackpot_live boolean, drop_paise bigint,
               drop_above_paise bigint, has_variation boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.rake_rules_at((select o_table_id from private.my_tablet_table()), now());
$$;

-- Posts a hand's rake and drop: chips leave play (Chips in play, a liability, is debited) for the
-- house's rake (revenue) and the bad-beat jackpot (players' money). One balanced transaction each,
-- keyed by the hand, so a replay posts nothing twice. Nothing posts for a nought.
create function private.post_hand(p_venue_id uuid, p_hand_id uuid, p_rake bigint, p_drop bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chips uuid := (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.chips_outstanding');
  v_rake uuid := (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.rake');
  v_jackpot uuid := (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.jackpot.main');
begin
  if p_rake > 0 then
    perform private.post_ledger_transaction(p_venue_id, 'hand_rake', 'hand:' || p_hand_id || ':rake',
      jsonb_build_array(jsonb_build_object('account_id', v_chips, 'amount', p_rake::text),
                        jsonb_build_object('account_id', v_rake, 'amount', (-p_rake)::text)),
      null, 'Rake from a hand');
  end if;
  if p_drop > 0 then
    perform private.post_ledger_transaction(p_venue_id, 'jackpot_drop', 'hand:' || p_hand_id || ':drop',
      jsonb_build_array(jsonb_build_object('account_id', v_chips, 'amount', p_drop::text),
                        jsonb_build_object('account_id', v_jackpot, 'amount', (-p_drop)::text)),
      null, 'Jackpot drop from a hand');
  end if;
end;
$$;

-- The dealer logs a hand on the tablet (#42): during their down at the tablet's table, a pot of
-- whole ₹50 chips, a variant the table plays, played within the last day. Rake and drop come from
-- the rules in force when it was played, post to the ledger, and hand.logged goes out (promotions,
-- lane D). A replay of the same request returns the same hand. Not while the venue is frozen.
create function private.log_hand(p_pot bigint, p_variant public.hand_variant, p_played_at timestamptz, p_idempotency_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
  v_existing public.hand;
  v_down public.dealer_down;
  v_rules record;
  v_take record;
  v_hand_id uuid;
begin
  select * into v_tablet from private.my_tablet_table();
  select * into v_existing from public.hand h where h.venue_id = v_tablet.o_venue_id and h.idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    if v_existing.pot_paise is distinct from p_pot or v_existing.variant is distinct from p_variant or v_existing.table_id <> v_tablet.o_table_id then
      raise exception 'That request was a different hand' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;
  perform private.assert_writable(v_tablet.o_venue_id);
  select * into v_down from public.dealer_down d where d.table_id = v_tablet.o_table_id and d.ended_at is null;
  if v_down.id is null then
    raise exception 'Sign a dealer in before logging hands' using errcode = 'RVDWN';
  end if;
  if p_pot is null or p_pot <= 0 or p_pot % 5000 <> 0 then
    raise exception 'A pot is a whole number of ₹50 chips' using errcode = '22023';
  end if;
  if p_played_at is null or p_played_at > now() + interval '1 minute' or p_played_at < now() - interval '1 day' then
    raise exception 'A hand is logged within a day of being played' using errcode = '22023';
  end if;
  select * into v_rules from private.rake_rules_at(v_tablet.o_table_id, p_played_at);
  if v_rules.rate_basis_points is null then
    raise exception 'No rake is set for this table''s game' using errcode = '22023';
  end if;
  if p_variant is null or (p_variant <> 'holdem' and not v_rules.has_variation) then
    raise exception 'This table plays Hold''em only' using errcode = '22023';
  end if;
  select * into v_take from private.pot_take(p_pot, v_rules.rate_basis_points, v_rules.cap_paise, v_rules.is_jackpot_live,
                                             v_rules.drop_paise, v_rules.drop_above_paise);
  insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise,
                           is_cap_applied, played_at, idempotency_key)
  values (v_tablet.o_venue_id, v_tablet.o_table_id, v_down.id, v_down.staff_id, v_tablet.o_device_id, p_variant, p_pot,
          v_take.rake, v_take.drop_paise, v_take.is_cap_applied, p_played_at, p_idempotency_key)
  returning id into v_hand_id;
  perform private.post_hand(v_tablet.o_venue_id, v_hand_id, v_take.rake, v_take.drop_paise);
  perform private.emit(v_tablet.o_venue_id, 'hand.logged',
    jsonb_build_object('hand_id', v_hand_id, 'table_id', v_tablet.o_table_id, 'variant', p_variant, 'pot_paise', p_pot,
                       'rake_paise', v_take.rake, 'drop_paise', v_take.drop_paise, 'played_at', p_played_at),
    'hand.logged:' || v_hand_id);
  return v_hand_id;
end;
$$;

-- The hands of the down at the tablet's table, latest first: the hand counter and the last hands.
create function private.down_hands()
returns table (hand_id uuid, played_at timestamptz, variant public.hand_variant, pot_paise bigint, rake_paise bigint,
               drop_paise bigint, is_cap_applied boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.played_at, h.variant, h.pot_paise, h.rake_paise, h.drop_paise, h.is_cap_applied
  from public.hand h
  join public.dealer_down d on d.id = h.down_id and d.ended_at is null
  where d.table_id = (select o_table_id from private.my_tablet_table())
  order by h.played_at desc, h.created_at desc;
$$;

revoke execute on function private.pot_take(bigint, integer, bigint, boolean, bigint, bigint), private.rake_rules_at(uuid, timestamptz),
  private.post_hand(uuid, uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function private.tablet_rake_rules(), private.log_hand(bigint, public.hand_variant, timestamptz, text),
  private.down_hands() to authenticated;

create function public.tablet_rake_rules()
returns table (rate_basis_points integer, cap_paise bigint, is_jackpot_live boolean, drop_paise bigint,
               drop_above_paise bigint, has_variation boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.tablet_rake_rules(); $$;

create function public.log_hand(p_pot bigint, p_variant public.hand_variant, p_played_at timestamptz, p_idempotency_key text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.log_hand(p_pot, p_variant, p_played_at, p_idempotency_key); $$;

create function public.down_hands()
returns table (hand_id uuid, played_at timestamptz, variant public.hand_variant, pot_paise bigint, rake_paise bigint,
               drop_paise bigint, is_cap_applied boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.down_hands(); $$;

revoke execute on function public.tablet_rake_rules(), public.log_hand(bigint, public.hand_variant, timestamptz, text),
  public.down_hands() from public, anon;
grant execute on function public.tablet_rake_rules(), public.log_hand(bigint, public.hand_variant, timestamptz, text),
  public.down_hands() to authenticated;
