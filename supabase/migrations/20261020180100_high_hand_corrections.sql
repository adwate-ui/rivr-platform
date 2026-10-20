-- High-hand corrections and reversals (#324; the owner's answer to question #315; decisions 0050 and
-- 0112). Before a claim is decided, staff who approve jackpots correct its hand, rank or seat: what the
-- dealer claimed is kept beside it (original_*) and in the audit log. A decided claim is reversed with a
-- reason: an approved one's payout is posted back once, as a bad-beat reversal is, and the hand may then
-- be claimed again. high_hand.reversed goes out, and the TVs are told when an approved hand goes.

alter table public.high_hand_claim
  add column original_category public.high_hand_category,
  add column original_rank text,
  add column original_seat smallint,
  add column corrected_by_staff_id uuid,
  add column corrected_at timestamptz,
  add column reversed_by_staff_id uuid,
  add column reversed_at timestamptz,
  add column reversed_reason text check (reversed_reason is null or length(trim(reversed_reason)) between 3 and 300),
  add constraint high_hand_claim_corrected_by_fkey foreign key (corrected_by_staff_id, venue_id) references public.staff (id, venue_id),
  add constraint high_hand_claim_reversed_by_fkey foreign key (reversed_by_staff_id, venue_id) references public.staff (id, venue_id),
  add constraint high_hand_claim_corrected check (
    (corrected_at is null) = (original_category is null) and (corrected_at is null) = (original_seat is null)
    and (corrected_at is null) = (corrected_by_staff_id is null)),
  add constraint high_hand_claim_reversed check (
    (status = 'reversed') = (reversed_at is not null) and (reversed_at is null) = (reversed_reason is null)
    and (reversed_at is null) = (reversed_by_staff_id is null));
create index high_hand_claim_corrector_venue_idx on public.high_hand_claim (corrected_by_staff_id, venue_id);
create index high_hand_claim_reverser_venue_idx on public.high_hand_claim (reversed_by_staff_id, venue_id);

-- A reversed claim keeps what was paid, or why it was rejected.
alter table public.high_hand_claim drop constraint high_hand_claim_check1, drop constraint high_hand_claim_check2,
  add constraint high_hand_claim_payout check (
    (status <> 'approved' or payout_paise is not null) and (status in ('approved', 'reversed') or payout_paise is null)),
  add constraint high_hand_claim_rejection check (
    (status <> 'rejected' or reason is not null) and (status in ('rejected', 'reversed') or reason is null));

-- One live claim a hand: a reversed one leaves the hand free to be claimed again.
alter table public.high_hand_claim drop constraint high_hand_claim_hand_id_key;
create unique index high_hand_claim_one_live_per_hand on public.high_hand_claim (hand_id) where status <> 'reversed';

-- A claim changes while it waits; once decided, only to be reversed, which nothing undoes.
create or replace function private.guard_high_hand_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A high hand is never removed' using errcode = '22023';
  end if;
  if old.status = 'claimed' then
    return new;
  end if;
  -- Only the reversal's own columns change: everything else stays as decided.
  if old.status in ('approved', 'rejected') and new.status = 'reversed'
     and to_jsonb(new) - '{status,reversed_by_staff_id,reversed_at,reversed_reason,updated_at}'::text[]
         = to_jsonb(old) - '{status,reversed_by_staff_id,reversed_at,reversed_reason,updated_at}'::text[] then
    return new;
  end if;
  raise exception 'A decided high hand is final, but for its reversal' using errcode = '22023';
end;
$$;

-- As in the high-hands migration, but a reversed claim is not the hand's claim, and the dealer's claim as
-- sent is still that claim after the floor corrects it (a tablet sends it again when an answer was lost).
create or replace function private.replayed_high_hand_claim(p_hand_id uuid, p_seat integer, p_category public.high_hand_category, p_rank text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claim public.high_hand_claim;
begin
  select * into v_claim from public.high_hand_claim c where c.hand_id = p_hand_id and c.status <> 'reversed';
  if v_claim.id is null then
    return null;
  end if;
  if (v_claim.seat::integer, v_claim.category, v_claim.rank) is not distinct from (p_seat, p_category, p_rank)
     or (v_claim.corrected_at is not null
         and (v_claim.original_seat::integer, v_claim.original_category, v_claim.original_rank) is not distinct from (p_seat, p_category, p_rank)) then
    return v_claim.id;
  end if;
  raise exception 'That hand already has a different high-hand claim' using errcode = '23505';
end;
$$;

-- As in the high-hands migration, but against the one live claim a hand.
create or replace function private.claim_high_hand(p_hand_id uuid, p_seat integer, p_category public.high_hand_category, p_rank text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
  v_hand public.hand;
  v_rank text := nullif(trim(p_rank), '');
  v_claim public.high_hand_claim;
  v_claim_id uuid;
begin
  select * into v_tablet from private.my_tablet_table();
  select h.* into v_hand
  from public.hand h join public.dealer_down d on d.id = h.down_id
  where h.id = p_hand_id and d.device_id = v_tablet.o_device_id and d.table_id = v_tablet.o_table_id and d.ended_at is null;
  if v_hand.id is null then
    raise exception 'That hand is not from the down on this tablet' using errcode = '22023';
  end if;
  v_claim_id := private.replayed_high_hand_claim(p_hand_id, p_seat, p_category, v_rank);
  if v_claim_id is not null then
    return v_claim_id;
  end if;
  if not private.is_dealer_at(v_hand.staff_id, v_hand.venue_id) then
    raise exception 'Sign a dealer in before claiming a high hand' using errcode = 'RVDWN';
  end if;
  perform private.assert_writable(v_hand.venue_id, 'promotions');
  if p_seat > (select t.seats from public.game_table t where t.id = v_hand.table_id) then
    raise exception 'That table has no such seat' using errcode = 'RVSEA';
  end if;
  if private.high_hand_payout(v_hand.venue_id, p_category, v_hand.played_at) = 0 then
    raise exception 'That high hand pays nothing here' using errcode = '22023';
  end if;
  insert into public.high_hand_claim (venue_id, hand_id, table_id, seat, category, rank, dealer_staff_id, device_id)
  values (v_hand.venue_id, v_hand.id, v_hand.table_id, p_seat, p_category, v_rank, v_hand.staff_id, v_hand.device_id)
  on conflict (hand_id) where status <> 'reversed' do nothing
  returning * into v_claim;
  -- Another claim for the hand landed at the same moment: the same one is a replay.
  if v_claim.id is null then
    return private.replayed_high_hand_claim(p_hand_id, p_seat, p_category, v_rank);
  end if;
  perform private.emit(v_hand.venue_id, 'high_hand.claimed',
    jsonb_build_object('claim_id', v_claim.id, 'table_id', v_claim.table_id, 'seat', v_claim.seat, 'category', v_claim.category),
    'high_hand.claimed:' || v_claim.id);
  return v_claim.id;
end;
$$;

-- Before a claim is decided, staff who approve jackpots (not the hand's dealer) correct its hand, rank
-- or seat. The dealer's claim is kept the first time; every change is in the audit log. Only to a hand
-- that pays (22023) and a seat the table has (RVSEA); a decided claim is RVDUP.
create function private.correct_high_hand(p_claim_id uuid, p_seat integer, p_category public.high_hand_category, p_rank text)
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
    raise exception 'Only staff who approve jackpots correct a high hand' using errcode = '42501';
  end if;
  if private.current_staff_id(v_claim.venue_id) = v_claim.dealer_staff_id then
    raise exception 'The dealer of the hand does not correct its claim' using errcode = '42501';
  end if;
  if v_claim.status <> 'claimed' then
    raise exception 'That high hand is already decided' using errcode = 'RVDUP';
  end if;
  perform private.assert_writable(v_claim.venue_id, 'promotions');
  if p_seat is null or p_seat < 1 or p_seat > (select t.seats from public.game_table t where t.id = v_claim.table_id) then
    raise exception 'That table has no such seat' using errcode = 'RVSEA';
  end if;
  if p_category is null
     or private.high_hand_payout(v_claim.venue_id, p_category, (select h.played_at from public.hand h where h.id = v_claim.hand_id)) = 0 then
    raise exception 'That high hand pays nothing here' using errcode = '22023';
  end if;
  -- Saving the claim as it stands corrects nothing, and records nothing.
  if (v_claim.seat::integer, v_claim.category, v_claim.rank) is not distinct from (p_seat, p_category, nullif(trim(p_rank), '')) then
    return;
  end if;
  update public.high_hand_claim c
  set seat = p_seat, category = p_category, rank = nullif(trim(p_rank), ''),
      original_category = coalesce(c.original_category, c.category),
      original_rank = case when c.corrected_at is null then c.rank else c.original_rank end,
      original_seat = coalesce(c.original_seat, c.seat),
      corrected_by_staff_id = private.current_staff_id(c.venue_id), corrected_at = now()
  where c.id = v_claim.id;
end;
$$;

-- Staff who approve jackpots (not the hand's dealer) reverse a decided claim, with the reason. An
-- approved claim's payout is posted back, linked to it, once; a rejected one is set aside. The hand may
-- then be claimed again. Reversing it again is the same reversal; a claim still waiting is rejected,
-- not reversed (22023). Not while the venue is frozen.
create function private.reverse_high_hand(p_claim_id uuid, p_reason text)
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
    raise exception 'Only staff who approve jackpots reverse a high hand' using errcode = '42501';
  end if;
  if private.current_staff_id(v_claim.venue_id) = v_claim.dealer_staff_id then
    raise exception 'The dealer of the hand does not reverse its claim' using errcode = '42501';
  end if;
  if v_claim.status = 'reversed' then
    return;
  end if;
  if v_claim.status = 'claimed' then
    raise exception 'A claim still waiting is rejected, not reversed' using errcode = '22023';
  end if;
  perform private.assert_writable(v_claim.venue_id);
  update public.high_hand_claim c
  set status = 'reversed', reversed_by_staff_id = private.current_staff_id(c.venue_id), reversed_at = now(), reversed_reason = trim(p_reason)
  where c.id = v_claim.id;
  if v_claim.status = 'approved' then
    perform private.reverse_ledger_transaction(
      (select t.id from public.ledger_transaction t where t.venue_id = v_claim.venue_id and t.idempotency_key = 'high_hand:' || v_claim.id),
      'high_hand_reversal:' || v_claim.id, trim(p_reason));
  end if;
  perform private.emit(v_claim.venue_id, 'high_hand.reversed',
    jsonb_build_object('claim_id', v_claim.id, 'table_id', v_claim.table_id, 'payout_paise', v_claim.payout_paise),
    'high_hand.reversed:' || v_claim.id);
end;
$$;

-- The console's list, as in the high-hands migration, with what the dealer claimed before a correction
-- and who reversed a claim, when and why.
drop function public.high_hands(uuid);
drop function private.high_hands(uuid);
create function private.high_hands(p_venue_id uuid)
returns table (claim_id uuid, status public.high_hand_status, category public.high_hand_category, rank text, seat smallint,
               table_name text, played_at timestamptz, payout_paise bigint, dealer_name text, decided_by_name text,
               decided_at timestamptz, reason text, original_category public.high_hand_category, original_rank text,
               original_seat smallint, corrected_by_name text, reversed_by_name text, reversed_reason text)
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
  select c.id, c.status, c.category, c.rank, c.seat, t.name, h.played_at,
         coalesce(c.payout_paise, case when c.status = 'claimed' then private.high_hand_payout(c.venue_id, c.category, h.played_at) end),
         dealer.full_name, decider.full_name, c.decided_at, c.reason, c.original_category, c.original_rank, c.original_seat,
         corrector.full_name, reverser.full_name, c.reversed_reason
  from public.high_hand_claim c
  join public.hand h on h.id = c.hand_id
  join public.game_table t on t.id = c.table_id
  join public.staff dealer on dealer.id = c.dealer_staff_id
  left join public.staff decider on decider.id = c.decided_by_staff_id
  left join public.staff corrector on corrector.id = c.corrected_by_staff_id
  left join public.staff reverser on reverser.id = c.reversed_by_staff_id
  where c.venue_id = p_venue_id
  order by c.created_at desc
  limit 200;
end;
$$;

create function public.high_hands(p_venue_id uuid)
returns table (claim_id uuid, status public.high_hand_status, category public.high_hand_category, rank text, seat smallint,
               table_name text, played_at timestamptz, payout_paise bigint, dealer_name text, decided_by_name text,
               decided_at timestamptz, reason text, original_category public.high_hand_category, original_rank text,
               original_seat smallint, corrected_by_name text, reversed_by_name text, reversed_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.high_hands(p_venue_id); $$;

create function public.correct_high_hand(p_claim_id uuid, p_seat integer, p_category public.high_hand_category, p_rank text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.correct_high_hand(p_claim_id, p_seat, p_category, p_rank); $$;
create function public.reverse_high_hand(p_claim_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.reverse_high_hand(p_claim_id, p_reason); $$;

revoke execute on function private.high_hands(uuid), private.correct_high_hand(uuid, integer, public.high_hand_category, text),
  private.reverse_high_hand(uuid, text), public.high_hands(uuid), public.correct_high_hand(uuid, integer, public.high_hand_category, text),
  public.reverse_high_hand(uuid, text) from public, anon;
grant execute on function private.high_hands(uuid), private.correct_high_hand(uuid, integer, public.high_hand_category, text),
  private.reverse_high_hand(uuid, text), public.high_hands(uuid), public.correct_high_hand(uuid, integer, public.high_hand_category, text),
  public.reverse_high_hand(uuid, text) to authenticated;

-- The TVs are told when an approved hand goes as well as when one comes (tonight's best may change).
drop trigger high_hand_claim_tv_signal on public.high_hand_claim;
create trigger high_hand_claim_tv_signal after update on public.high_hand_claim
  for each row when (old.status is distinct from new.status and (new.status = 'approved' or old.status = 'approved'))
  execute function private.signal_high_hand_change();
