-- High hands (#47; scope-v1 module 8, design prompt flow 6). A dealer claims a high hand on the
-- tablet for a hand of the down: the category, the seat, and the rank that makes it. The floor
-- approves or rejects it on the console. Approval pays the high_hand.payouts amount for the category,
-- as it stood when the hand was played, in chips at the table: chips in play are credited and the
-- club's high-hand cost debited, because the club funds high hands as a promotion and they are not
-- players' money (decision 0050, question #313). A decision is final. high_hand.claimed
-- and high_hand.approved go out, and public_high_hand gives tonight's best to the TVs and the app.

insert into public.setting_key (key, description, scope, value_schema) values
  ('high_hand.payouts',
   'What each high hand pays, in paise, in whole ₹50 chips: royal flush, straight flush and four of a kind; 0 pays nothing (scope-v1 module 8).',
   'venue',
   '{"type":"object","properties":{"royal_flush":{"type":"integer","minimum":0,"maximum":10000000,"multipleOf":5000},"straight_flush":{"type":"integer","minimum":0,"maximum":10000000,"multipleOf":5000},"four_of_a_kind":{"type":"integer","minimum":0,"maximum":10000000,"multipleOf":5000}},"required":["royal_flush","straight_flush","four_of_a_kind"],"additionalProperties":false}');

-- Lowest first, so the order of the values is the order of the hands.
create type public.high_hand_category as enum ('four_of_a_kind', 'straight_flush', 'royal_flush');
create type public.high_hand_status as enum ('claimed', 'approved', 'rejected');

-- The club's cost of the high hands it pays, for every venue, and for venues created from now on.
insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money)
select v.id, 'venue.high_hand_expense', 'High hands paid', 'expense', 'paise', false from public.venue v
on conflict do nothing;

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

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1), (p_venue_id, 'Academy graduate', 2),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');

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
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  return p_venue_id;
end;
$$;

create table public.high_hand_claim (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  -- One claim per hand.
  hand_id uuid not null unique references public.hand (id),
  table_id uuid not null,
  seat smallint not null check (seat between 1 and 10),
  category public.high_hand_category not null,
  -- The rank that makes it, as the dealer chose it, for example Queens; shown on the TV.
  detail text check (detail is null or length(trim(detail)) between 1 and 40),
  status public.high_hand_status not null default 'claimed',
  -- The dealer of the down, and the tablet.
  dealer_staff_id uuid not null,
  device_id uuid not null,
  -- Paid on approval: whole ₹50 chips.
  payout_paise bigint check (payout_paise is null or (payout_paise > 0 and payout_paise % 5000 = 0)),
  decided_by_staff_id uuid,
  decided_at timestamptz,
  reason text check (reason is null or length(trim(reason)) between 3 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (dealer_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (device_id, venue_id) references public.device (id, venue_id),
  check ((status = 'approved') = (payout_paise is not null)),
  check ((status = 'rejected') = (reason is not null)),
  check ((status = 'claimed') = (decided_at is null) and (decided_at is null) = (decided_by_staff_id is null))
);

comment on table public.high_hand_claim is 'High hands claimed on the tablet, approved or rejected by the floor, and what was paid (#47).';

create index high_hand_claim_venue_created_idx on public.high_hand_claim (venue_id, created_at desc);
create index high_hand_claim_table_venue_idx on public.high_hand_claim (table_id, venue_id);
create index high_hand_claim_dealer_venue_idx on public.high_hand_claim (dealer_staff_id, venue_id);
create index high_hand_claim_decider_venue_idx on public.high_hand_claim (decided_by_staff_id, venue_id);
create index high_hand_claim_device_venue_idx on public.high_hand_claim (device_id, venue_id);
create trigger high_hand_claim_touch_updated_at before update on public.high_hand_claim
  for each row execute function private.touch_updated_at();
create trigger high_hand_claim_audit after insert or update or delete on public.high_hand_claim
  for each row execute function private.audit_row_change();

-- A claim is decided once and never removed: only a claim still waiting changes.
create function private.guard_high_hand_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.status <> 'claimed' then
    raise exception 'A decided high hand is final' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger high_hand_claim_guard before update or delete on public.high_hand_claim
  for each row execute function private.guard_high_hand_claim();

alter table public.high_hand_claim enable row level security;
grant select on public.high_hand_claim to authenticated;

create policy "staff and the claiming tablet see high hands" on public.high_hand_claim
  for select to authenticated
  using (venue_id in (select private.staff_venues()) or device_id = (select private.current_device_id()));

-- What a high hand of this category pays at the venue under the rule in force at p_at: 0 when no
-- rule is set or it pays nothing.
create function private.high_hand_payout(p_venue_id uuid, p_category public.high_hand_category, p_at timestamptz)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.setting_at(p_venue_id, 'high_hand.payouts', '', p_at) ->> p_category::text)::numeric::bigint, 0);
$$;

-- The dealer claims a high hand on the tablet, for a hand of the down open on it: the category, the
-- seat and the rank. Only a category that pays is claimed. A replay of the same claim is that claim;
-- a different claim for a hand already claimed is 23505. Not while the venue is frozen or promotions
-- are switched off.
create function private.claim_high_hand(p_hand_id uuid, p_seat integer, p_category public.high_hand_category, p_detail text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
  v_hand public.hand;
  v_claim public.high_hand_claim;
begin
  select * into v_tablet from private.my_tablet_table();
  select h.* into v_hand
  from public.hand h join public.dealer_down d on d.id = h.down_id
  where h.id = p_hand_id and d.device_id = v_tablet.o_device_id and d.table_id = v_tablet.o_table_id and d.ended_at is null;
  if v_hand.id is null then
    raise exception 'That hand is not from the down on this tablet' using errcode = '22023';
  end if;
  select * into v_claim from public.high_hand_claim c where c.hand_id = p_hand_id;
  if v_claim.id is not null then
    if (v_claim.seat, v_claim.category, v_claim.detail) is not distinct from (p_seat, p_category, nullif(trim(p_detail), '')) then
      return v_claim.id;
    end if;
    raise exception 'That hand already has a different high-hand claim' using errcode = '23505';
  end if;
  perform private.assert_writable(v_hand.venue_id, 'promotions');
  if private.high_hand_payout(v_hand.venue_id, p_category, v_hand.played_at) = 0 then
    raise exception 'That high hand pays nothing here' using errcode = '22023';
  end if;
  insert into public.high_hand_claim (venue_id, hand_id, table_id, seat, category, detail, dealer_staff_id, device_id)
  values (v_hand.venue_id, v_hand.id, v_hand.table_id, p_seat, p_category, nullif(trim(p_detail), ''), v_hand.staff_id, v_hand.device_id)
  returning * into v_claim;
  perform private.emit(v_hand.venue_id, 'high_hand.claimed',
    jsonb_build_object('claim_id', v_claim.id, 'table_id', v_claim.table_id, 'seat', v_claim.seat, 'category', v_claim.category),
    'high_hand.claimed:' || v_claim.id);
  return v_claim.id;
end;
$$;

-- Staff with jackpots.approve approve a claim: it pays what the console showed (RVSTL if the payout
-- changed since), in chips at the table, and high_hand.approved goes out. Approving it again is the
-- same approval; a claim already rejected is RVDUP. Not while the venue is frozen or promotions are
-- switched off.
create function private.approve_high_hand(p_claim_id uuid, p_expected_paise bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_claim public.high_hand_claim;
  v_played_at timestamptz;
  v_payout bigint;
begin
  select * into v_claim from public.high_hand_claim c where c.id = p_claim_id for update;
  if v_claim.id is null or not private.has_permission(v_claim.venue_id, 'jackpots.approve') then
    raise exception 'Only staff who approve jackpots decide a high hand' using errcode = '42501';
  end if;
  if v_claim.status = 'approved' and v_claim.payout_paise = p_expected_paise then
    return v_claim.payout_paise;
  end if;
  if v_claim.status <> 'claimed' then
    raise exception 'That high hand is already decided' using errcode = 'RVDUP';
  end if;
  perform private.assert_writable(v_claim.venue_id, 'promotions');
  select h.played_at into v_played_at from public.hand h where h.id = v_claim.hand_id;
  v_payout := private.high_hand_payout(v_claim.venue_id, v_claim.category, v_played_at);
  if v_payout = 0 then
    raise exception 'That high hand pays nothing here' using errcode = '22023';
  end if;
  if p_expected_paise is distinct from v_payout then
    raise exception 'The payout has changed since it was shown' using errcode = 'RVSTL';
  end if;
  update public.high_hand_claim c
  set status = 'approved', payout_paise = v_payout, decided_by_staff_id = private.current_staff_id(v_claim.venue_id), decided_at = now()
  where c.id = v_claim.id;
  -- Chips into play at the table, at the club's cost: one balanced transaction, keyed by the claim.
  perform private.post_ledger_transaction(v_claim.venue_id, 'high_hand_payout', 'high_hand:' || v_claim.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_claim.venue_id and a.code = 'venue.high_hand_expense'),
                         'amount', v_payout::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_claim.venue_id and a.code = 'venue.chips_outstanding'),
                         'amount', (-v_payout)::text)),
    'promotions', 'High hand paid in chips');
  perform private.emit(v_claim.venue_id, 'high_hand.approved',
    jsonb_build_object('claim_id', v_claim.id, 'table_id', v_claim.table_id, 'seat', v_claim.seat, 'category', v_claim.category,
                       'detail', v_claim.detail, 'payout_paise', v_payout, 'played_at', v_played_at),
    'high_hand.approved:' || v_claim.id);
  return v_payout;
end;
$$;

-- Staff with jackpots.approve reject a claim, with the reason. Rejecting it again is the same; a
-- claim already approved is RVDUP. Not while the venue is frozen.
create function private.reject_high_hand(p_claim_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_claim public.high_hand_claim;
begin
  select * into v_claim from public.high_hand_claim c where c.id = p_claim_id for update;
  if v_claim.id is null or not private.has_permission(v_claim.venue_id, 'jackpots.approve') then
    raise exception 'Only staff who approve jackpots decide a high hand' using errcode = '42501';
  end if;
  if v_claim.status = 'rejected' then
    return;
  end if;
  if v_claim.status <> 'claimed' then
    raise exception 'That high hand is already decided' using errcode = 'RVDUP';
  end if;
  perform private.assert_writable(v_claim.venue_id);
  update public.high_hand_claim c
  set status = 'rejected', reason = trim(p_reason), decided_by_staff_id = private.current_staff_id(v_claim.venue_id), decided_at = now()
  where c.id = v_claim.id;
end;
$$;

-- The venue's high hands for the console, latest first, with what a waiting claim would pay now:
-- for staff who approve jackpots or read the ledger, at the practice venue too. 42501 otherwise.
create function private.high_hands(p_venue_id uuid)
returns table (claim_id uuid, status public.high_hand_status, category public.high_hand_category, detail text, seat smallint,
               table_name text, played_at timestamptz, payout_paise bigint, dealer_name text, decided_by_name text,
               decided_at timestamptz, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission(p_venue_id, 'jackpots.approve') or private.has_permission(p_venue_id, 'ledger.read')) then
    raise exception 'Only staff who approve jackpots or read the ledger see high hands' using errcode = '42501';
  end if;
  return query
  select c.id, c.status, c.category, c.detail, c.seat, t.name, h.played_at,
         coalesce(c.payout_paise, case when c.status = 'claimed' then private.high_hand_payout(c.venue_id, c.category, h.played_at) end),
         dealer.full_name, decider.full_name, c.decided_at, c.reason
  from public.high_hand_claim c
  join public.hand h on h.id = c.hand_id
  join public.game_table t on t.id = c.table_id
  join public.staff dealer on dealer.id = c.dealer_staff_id
  left join public.staff decider on decider.id = c.decided_by_staff_id
  where c.venue_id = p_venue_id
  order by c.created_at desc
  limit 200;
end;
$$;

-- When tonight began: 06:00 IST, the club's day turning over long after the last table closes.
create function private.tonight_began(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('day', (p_at at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata';
$$;

-- Tonight's best high hand at each venue, for the TVs, the app and the website: the highest
-- category approved for a hand played tonight, the latest of those. No names; never the practice venue.
create function private.public_high_hand_rows()
returns table (venue_slug text, category public.high_hand_category, detail text, table_name text, played_at timestamptz, payout_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (v.id) v.slug, c.category, c.detail, t.name, h.played_at, c.payout_paise
  from public.high_hand_claim c
  join public.venue v on v.id = c.venue_id and not v.is_practice
  join public.hand h on h.id = c.hand_id
  join public.game_table t on t.id = c.table_id
  where c.status = 'approved' and h.played_at >= private.tonight_began(now())
  order by v.id, c.category desc, h.played_at desc;
$$;

create view public.public_high_hand
with (security_invoker = true)
as
select venue_slug, category, detail, table_name, played_at, payout_paise from private.public_high_hand_rows();

grant select on public.public_high_hand to anon, authenticated;

revoke execute on function private.guard_high_hand_claim(), private.high_hand_payout(uuid, public.high_hand_category, timestamptz),
  private.claim_high_hand(uuid, integer, public.high_hand_category, text), private.approve_high_hand(uuid, bigint),
  private.reject_high_hand(uuid, text), private.high_hands(uuid), private.tonight_began(timestamptz), private.public_high_hand_rows()
  from public, anon, authenticated;
grant execute on function private.claim_high_hand(uuid, integer, public.high_hand_category, text), private.approve_high_hand(uuid, bigint),
  private.reject_high_hand(uuid, text), private.high_hands(uuid) to authenticated;
grant execute on function private.public_high_hand_rows() to anon, authenticated;

create function public.claim_high_hand(p_hand_id uuid, p_seat integer, p_category public.high_hand_category, p_detail text)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.claim_high_hand(p_hand_id, p_seat, p_category, p_detail); $$;

create function public.approve_high_hand(p_claim_id uuid, p_expected_paise bigint)
returns bigint
language sql volatile security invoker set search_path = ''
as $$ select private.approve_high_hand(p_claim_id, p_expected_paise); $$;

create function public.reject_high_hand(p_claim_id uuid, p_reason text)
returns void
language sql volatile security invoker set search_path = ''
as $$ select private.reject_high_hand(p_claim_id, p_reason); $$;

create function public.high_hands(p_venue_id uuid)
returns table (claim_id uuid, status public.high_hand_status, category public.high_hand_category, detail text, seat smallint,
               table_name text, played_at timestamptz, payout_paise bigint, dealer_name text, decided_by_name text,
               decided_at timestamptz, reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.high_hands(p_venue_id); $$;

revoke execute on function public.claim_high_hand(uuid, integer, public.high_hand_category, text), public.approve_high_hand(uuid, bigint),
  public.reject_high_hand(uuid, text), public.high_hands(uuid) from public, anon;
grant execute on function public.claim_high_hand(uuid, integer, public.high_hand_category, text), public.approve_high_hand(uuid, bigint),
  public.reject_high_hand(uuid, text), public.high_hands(uuid) to authenticated;
