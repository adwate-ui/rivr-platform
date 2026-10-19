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
  -- Whole ₹50 chips, up to ₹1 crore.
  pot_paise bigint not null check (pot_paise > 0 and pot_paise <= 1000000000 and pot_paise % 5000 = 0),
  rake_paise bigint not null check (rake_paise >= 0 and rake_paise % 5000 = 0),
  drop_paise bigint not null check (drop_paise >= 0 and drop_paise % 5000 = 0),
  is_cap_applied boolean not null,
  -- When the hand was played, as the tablet says: within its down; its rules are those in force then.
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
-- No client writes a hand: only log_hand does, and a hand is never changed (corrections reverse it later).
create trigger hand_append_only before update or delete on public.hand
  for each row execute function private.refuse_change();
create trigger hand_no_truncate before truncate on public.hand
  for each statement execute function private.refuse_change();
create trigger hand_audit after insert on public.hand
  for each row execute function private.audit_row_change();
alter table public.hand enable row level security;
grant select on public.hand to authenticated;

-- A hand's rake is the house's takings: staff who read the ledger see hands. The tablet reads its
-- own down's hands through down_hands.
create policy "staff who read the ledger see the venue's hands" on public.hand
  for select to authenticated
  using (venue_id in (select private.venues_where('ledger.read')));

-- @rivr/domain potTake in SQL, proved on the same golden file (packages/testing/golden/rake.json,
-- 024_golden_twins). Rake is the rate's share of the pot (floored), no more than the cap, rounded
-- down to ₹50 chips; while the jackpot is live a pot above the threshold drops the drop (in chips);
-- the pull is both; the cap applied when the share was more than the cap. Like potTake, it refuses
-- a negative or missing amount and a rate outside 0% to 100%.
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
  if p_pot is null or p_pot < 0 or p_cap is null or p_cap < 0 or p_drop is null or p_drop < 0
     or p_drop_above is null or p_drop_above < 0 or p_is_jackpot_live is null then
    raise exception 'A pot and its rules are never negative or missing' using errcode = '22023';
  end if;
  if p_rate_basis_points is null or p_rate_basis_points not between 0 and 10000 then
    raise exception 'A rate is between 0%% and 100%%' using errcode = '22023';
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

-- The hand an earlier send of the same request logged, if any; refused if that was a different
-- hand. log_hand asks before logging, and again if a send at the same moment logged it first.
create function private.replayed_hand(p_venue_id uuid, p_table_id uuid, p_idempotency_key text, p_pot bigint,
                                      p_variant public.hand_variant, p_played_at timestamptz)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_existing public.hand;
begin
  select * into v_existing from public.hand h where h.venue_id = p_venue_id and h.idempotency_key = p_idempotency_key;
  if v_existing.id is not null and (v_existing.table_id, v_existing.pot_paise, v_existing.variant, v_existing.played_at)
                                   is distinct from (p_table_id, p_pot, p_variant, p_played_at) then
    raise exception 'That request was a different hand' using errcode = '22023';
  end if;
  return v_existing.id;
end;
$$;

-- The dealer logs a hand on the tablet (#42): during their down, begun on this tablet, while they
-- may still log hands; a pot of whole ₹50 chips up to ₹1 crore; a variant the table plays; played
-- in the down. Rake and drop come from the rules in force when it was played, post to the ledger,
-- and hand.logged goes out (promotions, lane D). A replay of the same request returns the same
-- hand. Not while the venue is frozen.
create function private.log_hand(p_pot bigint, p_variant public.hand_variant, p_played_at timestamptz, p_idempotency_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
  v_down public.dealer_down;
  v_rules record;
  v_take record;
  v_hand_id uuid;
begin
  select * into v_tablet from private.my_tablet_table();
  v_hand_id := private.replayed_hand(v_tablet.o_venue_id, v_tablet.o_table_id, p_idempotency_key, p_pot, p_variant, p_played_at);
  if v_hand_id is not null then
    return v_hand_id;
  end if;
  perform private.assert_writable(v_tablet.o_venue_id);
  select * into v_down from public.dealer_down d
  where d.table_id = v_tablet.o_table_id and d.device_id = v_tablet.o_device_id and d.ended_at is null;
  if v_down.id is null or not private.is_dealer_at(v_down.staff_id, v_tablet.o_venue_id) then
    raise exception 'Sign a dealer in before logging hands' using errcode = 'RVDWN';
  end if;
  if p_pot is null or p_pot <= 0 or p_pot > 1000000000 or p_pot % 5000 <> 0 then
    raise exception 'A pot is a whole number of ₹50 chips, up to ₹1 crore' using errcode = '22023';
  end if;
  -- A minute either side for the tablet's clock.
  if p_played_at is null or p_played_at > now() + interval '1 minute' or p_played_at < v_down.started_at - interval '1 minute' then
    raise exception 'A hand is played during the down it is logged in' using errcode = '22023';
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
  on conflict (venue_id, idempotency_key) do nothing
  returning id into v_hand_id;
  if v_hand_id is null then
    return private.replayed_hand(v_tablet.o_venue_id, v_tablet.o_table_id, p_idempotency_key, p_pot, p_variant, p_played_at);
  end if;
  perform private.post_hand(v_tablet.o_venue_id, v_hand_id, v_take.rake, v_take.drop_paise);
  perform private.emit(v_tablet.o_venue_id, 'hand.logged',
    jsonb_build_object('hand_id', v_hand_id, 'table_id', v_tablet.o_table_id, 'variant', p_variant, 'pot_paise', p_pot,
                       'rake_paise', v_take.rake, 'drop_paise', v_take.drop_paise, 'played_at', p_played_at),
    'hand.logged:' || v_hand_id);
  return v_hand_id;
end;
$$;

-- The hands of the open down on this tablet, latest first: the hand counter and the last hands.
create function private.down_hands()
returns table (hand_id uuid, played_at timestamptz, variant public.hand_variant, pot_paise bigint, rake_paise bigint,
               drop_paise bigint, is_cap_applied boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.played_at, h.variant, h.pot_paise, h.rake_paise, h.drop_paise, h.is_cap_applied
  from private.my_tablet_table() t
  join public.dealer_down d on d.table_id = t.o_table_id and d.device_id = t.o_device_id and d.ended_at is null
  join public.hand h on h.down_id = d.id
  order by h.played_at desc, h.created_at desc;
$$;

-- A down ends when its dealer may no longer log hands (access revoked, or made inactive) or its
-- tablet leaves the table (moved, freed or revoked): the tablet then asks for a dealer, and no hand
-- lands on a down that is not that dealer's on that tablet. Also while the venue is frozen, as End
-- of down is (decision 0046).
create function private.end_stale_downs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'tablet_assignment' then
    if tg_op = 'DELETE' or old.table_id <> new.table_id then
      update public.dealer_down d set ended_at = now()
      where d.ended_at is null and (d.device_id = old.device_id or d.table_id = old.table_id);
    end if;
  elsif tg_table_name = 'staff' then
    update public.dealer_down d set ended_at = now() where d.ended_at is null and d.staff_id = new.id;
  else
    -- An access revoke, of a person or a device.
    update public.dealer_down d set ended_at = now()
    where d.ended_at is null and (d.staff_id = new.staff_id or d.device_id = new.device_id);
  end if;
  return null;
end;
$$;

create trigger tablet_assignment_end_downs after update or delete on public.tablet_assignment
  for each row execute function private.end_stale_downs();
create trigger staff_end_downs after update of is_active on public.staff
  for each row when (old.is_active and not new.is_active) execute function private.end_stale_downs();
create trigger control_state_end_downs after insert on public.control_state
  for each row when (new.level = 'access_revoke') execute function private.end_stale_downs();

revoke execute on function private.pot_take(bigint, integer, bigint, boolean, bigint, bigint), private.rake_rules_at(uuid, timestamptz),
  private.post_hand(uuid, uuid, bigint, bigint),
  private.replayed_hand(uuid, uuid, text, bigint, public.hand_variant, timestamptz), private.end_stale_downs()
  from public, anon, authenticated;
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
