-- The end-of-day close of a cage shift (#45; scope-v1 module 5 acceptance, module 16; decision 0067). The
-- cashier closes the shift (#24) by counting the cash in the drawer and the chips in the cage, and giving
-- the UPI and bank receipts the statement shows and the signed markers held. Each is set against what
-- the ledger expects. A shift closes to zero variance; any variance is an anomaly: the shift closes, an
-- alert is raised, and the close waits for a reviewer's reason before eod.closed is emitted.

-- A review of a close's variance is a manager's (decision 0067, question #367).
insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array['eod.review']) as permission;

insert into public.role_permission (role, permission)
select 'admin', permission
from unnest(array['eod.review']) as permission;

-- What a shift moved is every ledger entry after the last one when it opened. Entry ids are handed out
-- before their transactions commit, so a posting still in flight could hold a lower id and land after
-- the mark. Every posting therefore holds the venue's ledger lock shared until it commits, and opening
-- or closing a shift takes it alone: the mark is taken, and the close counts, with nothing in flight.
create function private.share_ledger_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('ledger:' || new.venue_id, 0));
  return new;
end;
$$;

create trigger ledger_transaction_share_lock before insert on public.ledger_transaction
  for each row execute function private.share_ledger_lock();

alter table public.cage_shift add column opened_after_entry_id bigint not null default 0;
comment on column public.cage_shift.opened_after_entry_id is 'The last ledger entry when the shift opened: the shift moved every entry after it (#45).';

-- Marks where a shift's ledger begins, once every posting in flight at the venue has committed.
create function private.mark_shift_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ledger:' || new.venue_id, 0));
  new.opened_after_entry_id := coalesce((select max(e.id) from public.ledger_entry e), 0);
  return new;
end;
$$;

create trigger cage_shift_mark_open before insert on public.cage_shift
  for each row execute function private.mark_shift_open();

revoke execute on function private.share_ledger_lock(), private.mark_shift_open() from public, anon, authenticated;

-- @rivr/domain shiftClose in SQL, proved on the same golden file (packages/testing/golden/eod.json,
-- 024_golden_twins): each figure counted less expected, and an anomaly when any differs at all.
create function private.shift_close(p_counted_cash bigint, p_expected_cash bigint, p_counted_chips bigint, p_expected_chips bigint,
                                    p_counted_receipts bigint, p_expected_receipts bigint, p_counted_markers bigint, p_expected_markers bigint)
returns table (cash_paise bigint, chips_paise bigint, receipts_paise bigint, markers_paise bigint, is_anomaly boolean)
language sql
immutable
set search_path = ''
as $$
  select p_counted_cash - p_expected_cash, p_counted_chips - p_expected_chips, p_counted_receipts - p_expected_receipts,
         p_counted_markers - p_expected_markers,
         (p_counted_cash, p_counted_chips, p_counted_receipts, p_counted_markers)
           is distinct from (p_expected_cash, p_expected_chips, p_expected_receipts, p_expected_markers);
$$;

revoke execute on function private.shift_close(bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) from public, anon, authenticated;

-- What the ledger says a shift's close should find: the float plus the cash the drawer took in less what
-- it paid out; the chips the shift opened with, less those issued and plus those returned (cash-outs, and
-- the rake and drops in the drop boxes, which come to the cage); the UPI and bank receipts; and every
-- marker still owed, whose signed slips the cage holds.
create function private.shift_expected(p_shift_id uuid)
returns table (cash_paise bigint, chips_paise bigint, receipts_paise bigint, markers_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with shift as (select * from public.cage_shift s where s.id = p_shift_id),
  moved as (
    select a.code, e.amount
    from shift
    join public.ledger_account a on a.venue_id = shift.venue_id and a.code in ('venue.cash_drawer', 'venue.chips_outstanding', 'venue.bank')
    join public.ledger_entry e on e.account_id = a.id and e.id > shift.opened_after_entry_id
  ),
  opening as (
    select c.id from public.chip_inventory_count c join shift on c.shift_id = shift.id order by c.counted_at, c.id limit 1
  )
  select (shift.float_paise + coalesce((select sum(m.amount) from moved m where m.code = 'venue.cash_drawer'), 0))::bigint,
         (coalesce((select sum(l.value_paise * l.quantity) from public.chip_inventory_line l join opening o on o.id = l.count_id), 0)
          + coalesce((select sum(m.amount) from moved m where m.code = 'venue.chips_outstanding'), 0))::bigint,
         coalesce((select sum(m.amount) from moved m where m.code = 'venue.bank' and m.amount > 0), 0)::bigint,
         coalesce((select sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.venue_id = shift.venue_id and a.code = 'member.receivable'), 0)::bigint
  from shift;
$$;

revoke execute on function private.shift_expected(uuid) from public, anon, authenticated;

create table public.eod_close (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  shift_id uuid not null,
  -- The closing count of the chips in the cage.
  count_id uuid not null,
  counted_cash_paise bigint not null check (counted_cash_paise >= 0),
  counted_chips_paise bigint not null check (counted_chips_paise >= 0),
  counted_receipts_paise bigint not null check (counted_receipts_paise >= 0),
  counted_markers_paise bigint not null check (counted_markers_paise >= 0),
  expected_cash_paise bigint not null,
  expected_chips_paise bigint not null,
  expected_receipts_paise bigint not null,
  expected_markers_paise bigint not null,
  is_anomaly boolean not null,
  closed_by_staff_id uuid not null,
  -- The clock, not the transaction's start, so closes in one transaction keep their order.
  closed_at timestamptz not null default clock_timestamp(),
  -- An anomaly's reason, from a reviewer who did not close the shift.
  reason text check (length(btrim(reason)) between 3 and 500),
  reviewed_by_staff_id uuid,
  reviewed_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id),
  unique (venue_id, idempotency_key),
  foreign key (shift_id, venue_id) references public.cage_shift (id, venue_id),
  foreign key (count_id, venue_id) references public.chip_inventory_count (id, venue_id),
  foreign key (closed_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (reviewed_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((reviewed_at is null) = (reviewed_by_staff_id is null) and (reviewed_at is null) = (reason is null)),
  check (is_anomaly or reviewed_at is null)
);

comment on table public.eod_close is 'A cage shift''s close: what was counted, what the ledger expected, and an anomaly''s reviewed reason (#45).';

create index eod_close_venue_closed_idx on public.eod_close (venue_id, closed_at desc);
create index eod_close_count_idx on public.eod_close (count_id, venue_id);
create index eod_close_closer_idx on public.eod_close (closed_by_staff_id, venue_id);
create index eod_close_reviewer_idx on public.eod_close (reviewed_by_staff_id, venue_id);
create trigger eod_close_touch_updated_at before update on public.eod_close
  for each row execute function private.touch_updated_at();
create trigger eod_close_audit after insert or update on public.eod_close
  for each row execute function private.audit_row_change();

alter table public.eod_close enable row level security;
grant select on public.eod_close to authenticated;
create policy "ledger readers see the venue's closes" on public.eod_close
  for select to authenticated using (venue_id in (select private.venues_where('ledger.read')));

-- A cashier closes the open shift: the cash in the drawer, the chips counted by denomination, the UPI and
-- bank receipts, and the signed markers held, each against the ledger. With no variance, eod.closed;
-- with any, an anomaly: an alert, and the close waits for a reviewer. Once per request id.
create function private.close_cage_shift(p_venue_id uuid, p_cash_paise bigint, p_counts jsonb, p_receipts_paise bigint, p_markers_paise bigint,
                                         p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.cage_shift;
  v_replay public.eod_close;
  v_count uuid;
  v_chips bigint;
  v_expected record;
  v_close record;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier closes the cage' using errcode = '42501';
  end if;
  -- One at a time with opening and counting; a twin request that waited here is the same close, and
  -- with nothing posting in flight, so the ledger's figures are whole.
  perform pg_advisory_xact_lock(hashtextextended('cage_shift:' || p_venue_id, 0));
  perform pg_advisory_xact_lock(hashtextextended('ledger:' || p_venue_id, 0));
  select * into v_replay from public.eod_close c where c.venue_id = p_venue_id and c.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if (v_replay.counted_cash_paise, v_replay.counted_receipts_paise, v_replay.counted_markers_paise)
         is distinct from (p_cash_paise, p_receipts_paise, p_markers_paise)
       or not private.is_same_chip_count(v_replay.count_id, p_counts) then
      raise exception 'That request id closed the shift with other figures' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  if p_cash_paise is null or p_cash_paise < 0 or p_receipts_paise is null or p_receipts_paise < 0 or p_markers_paise is null or p_markers_paise < 0 then
    raise exception 'Cash, receipts and markers are amounts from nothing up' using errcode = '22023';
  end if;
  select * into v_shift from public.cage_shift s where s.venue_id = p_venue_id and s.closed_at is null;
  if v_shift.id is null then
    raise exception 'No shift is open' using errcode = 'RVNSH';
  end if;
  v_count := private.record_chip_count(p_venue_id, v_shift.id, p_counts, p_idempotency_key);
  select coalesce(sum(l.value_paise * l.quantity), 0)::bigint into v_chips from public.chip_inventory_line l where l.count_id = v_count;
  select * into v_expected from private.shift_expected(v_shift.id);
  select * into v_close from private.shift_close(p_cash_paise, v_expected.cash_paise, v_chips, v_expected.chips_paise,
    p_receipts_paise, v_expected.receipts_paise, p_markers_paise, v_expected.markers_paise);
  insert into public.eod_close (venue_id, shift_id, count_id, counted_cash_paise, counted_chips_paise, counted_receipts_paise, counted_markers_paise,
                                expected_cash_paise, expected_chips_paise, expected_receipts_paise, expected_markers_paise, is_anomaly,
                                closed_by_staff_id, idempotency_key)
  values (p_venue_id, v_shift.id, v_count, p_cash_paise, v_chips, p_receipts_paise, p_markers_paise,
          v_expected.cash_paise, v_expected.chips_paise, v_expected.receipts_paise, v_expected.markers_paise, v_close.is_anomaly,
          private.current_staff_id(p_venue_id), p_idempotency_key)
  returning id into v_id;
  update public.cage_shift s set closed_at = now(), closed_by_staff_id = private.current_staff_id(p_venue_id) where s.id = v_shift.id;
  if v_close.is_anomaly then
    perform private.raise_alert(p_venue_id, 'eod.variance', jsonb_build_object('close_id', v_id, 'shift_id', v_shift.id,
      'cash_paise', v_close.cash_paise, 'chips_paise', v_close.chips_paise, 'receipts_paise', v_close.receipts_paise, 'markers_paise', v_close.markers_paise));
  else
    perform private.emit(p_venue_id, 'eod.closed', jsonb_build_object('close_id', v_id, 'shift_id', v_shift.id, 'is_anomaly', false),
                         'eod.closed:' || v_id);
  end if;
  return v_id;
end;
$$;

-- Whether the signed-in staff member may give a close's reason: a manager (eod.review) who neither opened
-- nor closed its shift.
create function private.may_review_eod(p_close_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.has_permission(c.venue_id, 'eod.review')
           and private.current_staff_id(c.venue_id) is not null
           and private.current_staff_id(c.venue_id) not in (c.closed_by_staff_id, s.opened_by_staff_id)
    from public.eod_close c join public.cage_shift s on s.id = c.shift_id
    where c.id = p_close_id), false);
$$;

revoke execute on function private.may_review_eod(uuid) from public, anon, authenticated;

-- A manager who neither opened nor closed the shift reviews an anomaly with its reason; the close then
-- stands, and eod.closed is emitted. RVREV for a close with no variance, or one reviewed already.
create function private.review_eod_close(p_close_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_close public.eod_close;
begin
  select * into v_close from public.eod_close c where c.id = p_close_id for update;
  if v_close.id is null or not private.may_review_eod(v_close.id) then
    raise exception 'Only a manager who neither opened nor closed the shift reviews its variance' using errcode = '42501';
  end if;
  if not v_close.is_anomaly or v_close.reviewed_at is not null then
    raise exception 'This close has no variance waiting for a review' using errcode = 'RVREV';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Give the reason in 3 to 500 characters' using errcode = '22023';
  end if;
  update public.eod_close c
  set reason = btrim(p_reason), reviewed_by_staff_id = private.current_staff_id(v_close.venue_id), reviewed_at = now()
  where c.id = v_close.id;
  perform private.emit(v_close.venue_id, 'eod.closed', jsonb_build_object('close_id', v_close.id, 'shift_id', v_close.shift_id, 'is_anomaly', true),
                       'eod.closed:' || v_close.id);
end;
$$;

-- The venue's latest 14 closes and every anomaly still waiting, newest first, for ledger readers: when the
-- shift opened and closed and by whom, each figure counted, expected and its variance, an anomaly's
-- review, and whether the signed-in staff member may give its reason.
create function private.eod_closes(p_venue_id uuid)
returns table (close_id uuid, opened_at timestamptz, opened_by text, float_paise bigint, closed_at timestamptz, closed_by text, may_review boolean,
               counted_cash_paise bigint, counted_chips_paise bigint, counted_receipts_paise bigint, counted_markers_paise bigint,
               expected_cash_paise bigint, expected_chips_paise bigint, expected_receipts_paise bigint, expected_markers_paise bigint,
               cash_variance_paise bigint, chips_variance_paise bigint, receipts_variance_paise bigint, markers_variance_paise bigint,
               is_anomaly boolean, reason text, reviewed_by text, reviewed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, s.opened_at, opener.full_name, s.float_paise, c.closed_at, closer.full_name,
         c.is_anomaly and c.reviewed_at is null and private.may_review_eod(c.id),
         c.counted_cash_paise, c.counted_chips_paise, c.counted_receipts_paise, c.counted_markers_paise,
         c.expected_cash_paise, c.expected_chips_paise, c.expected_receipts_paise, c.expected_markers_paise,
         v.cash_paise, v.chips_paise, v.receipts_paise, v.markers_paise, c.is_anomaly, c.reason, reviewer.full_name, c.reviewed_at
  from (select c.*, row_number() over (order by c.closed_at desc, c.id) as n from public.eod_close c where c.venue_id = p_venue_id) c
  join public.cage_shift s on s.id = c.shift_id
  join public.staff opener on opener.id = s.opened_by_staff_id
  join public.staff closer on closer.id = c.closed_by_staff_id
  left join public.staff reviewer on reviewer.id = c.reviewed_by_staff_id
  cross join lateral private.shift_close(c.counted_cash_paise, c.expected_cash_paise, c.counted_chips_paise, c.expected_chips_paise,
    c.counted_receipts_paise, c.expected_receipts_paise, c.counted_markers_paise, c.expected_markers_paise) v
  where private.has_permission(p_venue_id, 'ledger.read') and (c.n <= 14 or c.is_anomaly and c.reviewed_at is null)
  order by c.closed_at desc, c.id;
$$;

create function public.close_cage_shift(p_venue_id uuid, p_cash_paise bigint, p_counts jsonb, p_receipts_paise bigint, p_markers_paise bigint,
                                        p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.close_cage_shift(p_venue_id, p_cash_paise, p_counts, p_receipts_paise, p_markers_paise, p_idempotency_key); $$;
create function public.review_eod_close(p_close_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.review_eod_close(p_close_id, p_reason); $$;
create function public.eod_closes(p_venue_id uuid)
returns table (close_id uuid, opened_at timestamptz, opened_by text, float_paise bigint, closed_at timestamptz, closed_by text, may_review boolean,
               counted_cash_paise bigint, counted_chips_paise bigint, counted_receipts_paise bigint, counted_markers_paise bigint,
               expected_cash_paise bigint, expected_chips_paise bigint, expected_receipts_paise bigint, expected_markers_paise bigint,
               cash_variance_paise bigint, chips_variance_paise bigint, receipts_variance_paise bigint, markers_variance_paise bigint,
               is_anomaly boolean, reason text, reviewed_by text, reviewed_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.eod_closes(p_venue_id); $$;

revoke execute on function private.close_cage_shift(uuid, bigint, jsonb, bigint, bigint, uuid), private.review_eod_close(uuid, text),
  private.eod_closes(uuid), public.close_cage_shift(uuid, bigint, jsonb, bigint, bigint, uuid), public.review_eod_close(uuid, text),
  public.eod_closes(uuid) from public, anon;
grant execute on function private.close_cage_shift(uuid, bigint, jsonb, bigint, bigint, uuid), private.review_eod_close(uuid, text),
  private.eod_closes(uuid), public.close_cage_shift(uuid, bigint, jsonb, bigint, bigint, uuid), public.review_eod_close(uuid, text),
  public.eod_closes(uuid) to authenticated;
