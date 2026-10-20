-- Cage shifts guard the cage's money (#376; the owner's answer to #367; decision 0107). Opening a shift
-- compares the float and chips typed with the last close's counted figures: a difference is an anomaly
-- needing a reviewed reason under eod.review, as at the close. And while no shift is open at a venue,
-- no request from an app moves money in or out of the cage's drawer or bank: buy-ins, cash-outs,
-- markers, withdrawals, deposits and every other cage move are refused (RVNSH).

-- What an opening found against the last close, and an anomaly's review.
alter table public.cage_shift
  add column last_close_id uuid,
  add column opening_cash_variance_paise bigint,
  add column opening_chips_variance_paise bigint,
  add column opening_is_anomaly boolean not null default false,
  add column opening_reason text check (length(btrim(opening_reason)) between 3 and 500),
  add column opening_reviewed_by_staff_id uuid,
  add column opening_reviewed_at timestamptz,
  add constraint cage_shift_last_close_fk foreign key (last_close_id) references public.eod_close (id),
  add constraint cage_shift_opening_reviewer_fk foreign key (opening_reviewed_by_staff_id, venue_id) references public.staff (id, venue_id),
  add constraint cage_shift_opening_review_check check (
    (opening_reviewed_at is null) = (opening_reviewed_by_staff_id is null) and (opening_reviewed_at is null) = (opening_reason is null)
    and (opening_is_anomaly or opening_reviewed_at is null));

create index cage_shift_last_close_idx on public.cage_shift (last_close_id);
create index cage_shift_opening_reviewer_idx on public.cage_shift (opening_reviewed_by_staff_id, venue_id);

-- As #24's (20261020090600_chip_inventory.sql), and then the opening set against the venue's last close:
-- the float against the cash it counted, the chips against the chips it counted. Any difference is an
-- anomaly: an alert, and a manager's reason (review_shift_opening).
create or replace function private.open_cage_shift(p_venue_id uuid, p_float_paise bigint, p_counts jsonb, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay public.cage_shift;
  v_last public.eod_close;
  v_id uuid;
  v_count uuid;
  v_chips bigint;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier opens the cage' using errcode = '42501';
  end if;
  -- One at a time per venue; a twin request that waited here is the same shift.
  perform pg_advisory_xact_lock(hashtextextended('cage_shift:' || p_venue_id, 0));
  select * into v_replay from public.cage_shift s where s.venue_id = p_venue_id and s.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.float_paise is distinct from p_float_paise or not private.is_same_chip_count(
      (select c.id from public.chip_inventory_count c where c.venue_id = p_venue_id and c.idempotency_key = p_idempotency_key), p_counts) then
      raise exception 'That request id opened a shift with another float or count' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  if p_float_paise is null or p_float_paise < 0 or p_float_paise % 100 <> 0 then
    raise exception 'The float is whole rupees' using errcode = '22023';
  end if;
  if exists (select 1 from public.cage_shift s where s.venue_id = p_venue_id and s.closed_at is null) then
    raise exception 'A shift is open already' using errcode = 'RVSHO';
  end if;
  insert into public.cage_shift (venue_id, float_paise, opened_by_staff_id, idempotency_key)
  values (p_venue_id, p_float_paise, private.current_staff_id(p_venue_id), p_idempotency_key)
  returning id into v_id;
  v_count := private.record_chip_count(p_venue_id, v_id, p_counts, p_idempotency_key);
  select * into v_last from public.eod_close c where c.venue_id = p_venue_id order by c.closed_at desc, c.id desc limit 1;
  if v_last.id is not null then
    select coalesce(sum(l.value_paise * l.quantity), 0)::bigint into v_chips from public.chip_inventory_line l where l.count_id = v_count;
    perform private.check_shift_opening(v_id, v_last, v_chips);
  end if;
  return v_id;
end;
$$;

-- Sets a new shift's opening against the last close, and raises an alert for any difference.
create function private.check_shift_opening(p_shift_id uuid, p_last public.eod_close, p_chips_paise bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.cage_shift;
  v_set record;
begin
  -- The close's own rule (private.shift_close, twin of @rivr/domain shiftClose, proved on eod.json): each
  -- figure as counted now less what the last close counted, and an anomaly when either differs at all.
  select c.* into v_set from public.cage_shift s
  cross join lateral private.shift_close(s.float_paise, p_last.counted_cash_paise, p_chips_paise, p_last.counted_chips_paise, 0, 0, 0, 0) c
  where s.id = p_shift_id;
  update public.cage_shift s
  set last_close_id = p_last.id, opening_cash_variance_paise = v_set.cash_paise, opening_chips_variance_paise = v_set.chips_paise,
      opening_is_anomaly = v_set.is_anomaly
  where s.id = p_shift_id
  returning * into v_shift;
  if v_shift.opening_is_anomaly then
    perform private.raise_alert(v_shift.venue_id, 'eod.opening_variance', jsonb_build_object('shift_id', v_shift.id, 'last_close_id', p_last.id,
      'cash_paise', v_shift.opening_cash_variance_paise, 'chips_paise', v_shift.opening_chips_variance_paise));
  end if;
end;
$$;

-- A manager (eod.review) who neither opened the shift nor closed the one before gives the reason for an
-- opening that differs from the last close. RVREV for an opening with no difference, or one reviewed.
create function private.review_shift_opening(p_shift_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.cage_shift;
  v_closer uuid;
begin
  select * into v_shift from public.cage_shift s where s.id = p_shift_id for update;
  select c.closed_by_staff_id into v_closer from public.eod_close c where c.id = v_shift.last_close_id;
  if v_shift.id is null or not private.has_permission(v_shift.venue_id, 'eod.review')
     or private.current_staff_id(v_shift.venue_id) is null
     or private.current_staff_id(v_shift.venue_id) in (v_shift.opened_by_staff_id, v_closer) then
    raise exception 'Only a manager who neither opened this shift nor closed the last reviews its opening' using errcode = '42501';
  end if;
  if not v_shift.opening_is_anomaly or v_shift.opening_reviewed_at is not null then
    raise exception 'This opening has no difference waiting for a review' using errcode = 'RVREV';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Give the reason in 3 to 500 characters' using errcode = '22023';
  end if;
  update public.cage_shift s
  set opening_reason = btrim(p_reason), opening_reviewed_by_staff_id = private.current_staff_id(v_shift.venue_id), opening_reviewed_at = now()
  where s.id = v_shift.id;
end;
$$;

-- Openings that differed from the last close, newest first (the latest 14 and every one still waiting),
-- for ledger readers: what was typed against what the last close counted, and whether the signed-in staff
-- member may give the reason.
create function private.shift_openings(p_venue_id uuid)
returns table (shift_id uuid, opened_at timestamptz, opened_by text, float_paise bigint, last_closed_at timestamptz, last_cash_paise bigint,
               last_chips_paise bigint, cash_variance_paise bigint, chips_variance_paise bigint, may_review boolean, reason text,
               reviewed_by text, reviewed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.opened_at, opener.full_name, s.float_paise, c.closed_at, c.counted_cash_paise, c.counted_chips_paise,
         s.opening_cash_variance_paise, s.opening_chips_variance_paise,
         s.opening_reviewed_at is null and private.has_permission(p_venue_id, 'eod.review')
           and private.current_staff_id(p_venue_id) is not null
           and private.current_staff_id(p_venue_id) not in (s.opened_by_staff_id, c.closed_by_staff_id),
         s.opening_reason, reviewer.full_name, s.opening_reviewed_at
  from (select s.*, row_number() over (order by s.opened_at desc, s.id) as n
        from public.cage_shift s where s.venue_id = p_venue_id and s.opening_is_anomaly) s
  join public.eod_close c on c.id = s.last_close_id
  join public.staff opener on opener.id = s.opened_by_staff_id
  left join public.staff reviewer on reviewer.id = s.opening_reviewed_by_staff_id
  where private.has_permission(p_venue_id, 'ledger.read') and (s.n <= 14 or s.opening_reviewed_at is null)
  order by s.opened_at desc, s.id;
$$;

-- No request from an app moves the cage's money while no shift is open at the venue: nothing in or out of
-- the drawer or the bank (cash and UPI buy-ins and cash-outs, deposits, withdrawals, Academy payments,
-- payouts in cash), and no chips issued or taken back however they are paid for (buy-ins and cash-outs
-- by wallet, markers). Migrations, the seed and jobs, with nobody signed in, post as before.
create function private.require_open_shift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (exists (select 1 from public.ledger_account a where a.id = new.account_id and a.code in ('venue.cash_drawer', 'venue.bank'))
          or (select t.kind from public.ledger_transaction t where t.id = new.transaction_id) in ('buy_in', 'cash_out', 'marker'))
     and not exists (select 1 from public.cage_shift s where s.venue_id = new.venue_id and s.closed_at is null) then
    raise exception 'The cage has no shift open: open one on Treasury first' using errcode = 'RVNSH';
  end if;
  return new;
end;
$$;

create trigger ledger_entry_needs_open_shift before insert on public.ledger_entry
  for each row execute function private.require_open_shift();

create function public.review_shift_opening(p_shift_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.review_shift_opening(p_shift_id, p_reason); $$;
create function public.shift_openings(p_venue_id uuid)
returns table (shift_id uuid, opened_at timestamptz, opened_by text, float_paise bigint, last_closed_at timestamptz, last_cash_paise bigint,
               last_chips_paise bigint, cash_variance_paise bigint, chips_variance_paise bigint, may_review boolean, reason text,
               reviewed_by text, reviewed_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.shift_openings(p_venue_id); $$;

revoke execute on function private.check_shift_opening(uuid, public.eod_close, bigint), private.require_open_shift() from public, anon, authenticated;
revoke execute on function private.review_shift_opening(uuid, text), private.shift_openings(uuid), public.review_shift_opening(uuid, text),
  public.shift_openings(uuid) from public, anon;
grant execute on function private.review_shift_opening(uuid, text), private.shift_openings(uuid), public.review_shift_opening(uuid, text),
  public.shift_openings(uuid) to authenticated;
