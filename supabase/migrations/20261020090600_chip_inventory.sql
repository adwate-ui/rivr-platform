-- The cage's shifts and chip counts (#24; scope-v1 module 5, additions "Chips"; decision 0066). A cashier
-- opens a shift with the float counted into the drawer and the chips in the cage counted by the venue's
-- denominations, and counts again whenever they like; #45 closes it. Chips in play is the ledger's
-- venue.chips_outstanding: every chip issued less every chip returned.

create table public.cage_shift (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- The cash counted into the drawer when the shift opened, in whole rupees.
  float_paise bigint not null check (float_paise >= 0 and float_paise % 100 = 0),
  opened_at timestamptz not null default now(),
  opened_by_staff_id uuid not null,
  closed_at timestamptz,
  closed_by_staff_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, idempotency_key),
  unique (id, venue_id),
  foreign key (opened_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (closed_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((closed_at is null) = (closed_by_staff_id is null))
);

comment on table public.cage_shift is 'A cage shift: the float it opened with, who opened it, and its close (#24, #45).';

-- One shift open at a time per venue.
create unique index cage_shift_open_idx on public.cage_shift (venue_id) where closed_at is null;
create index cage_shift_opener_idx on public.cage_shift (opened_by_staff_id, venue_id);
create index cage_shift_closer_idx on public.cage_shift (closed_by_staff_id, venue_id);
create trigger cage_shift_touch_updated_at before update on public.cage_shift
  for each row execute function private.touch_updated_at();
create trigger cage_shift_audit after insert or update on public.cage_shift
  for each row execute function private.audit_row_change();

create table public.chip_inventory_count (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  shift_id uuid not null,
  -- The clock, not the transaction's start, so two counts in one transaction keep their order.
  counted_at timestamptz not null default clock_timestamp(),
  counted_by_staff_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, idempotency_key),
  unique (id, venue_id),
  foreign key (shift_id, venue_id) references public.cage_shift (id, venue_id),
  foreign key (counted_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.chip_inventory_count is 'A count of the chips in the cage, in a shift (#24); its lines say how many of each chip.';

create index chip_inventory_count_shift_idx on public.chip_inventory_count (shift_id, venue_id, counted_at);
create index chip_inventory_count_counter_idx on public.chip_inventory_count (counted_by_staff_id, venue_id);
create trigger chip_inventory_count_audit after insert on public.chip_inventory_count
  for each row execute function private.audit_row_change();

create table public.chip_inventory_line (
  count_id uuid not null,
  venue_id uuid not null references public.venue (id),
  value_paise bigint not null,
  quantity integer not null check (quantity between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (count_id, value_paise),
  foreign key (count_id, venue_id) references public.chip_inventory_count (id, venue_id),
  foreign key (venue_id, value_paise) references public.chip_denomination (venue_id, value_paise)
);

comment on table public.chip_inventory_line is 'How many of one chip a count found in the cage (#24).';

create index chip_inventory_line_count_idx on public.chip_inventory_line (count_id, venue_id);
create index chip_inventory_line_chip_idx on public.chip_inventory_line (venue_id, value_paise);
create trigger chip_inventory_line_audit after insert on public.chip_inventory_line
  for each row execute function private.audit_row_change();

alter table public.cage_shift enable row level security;
alter table public.chip_inventory_count enable row level security;
alter table public.chip_inventory_line enable row level security;
grant select on public.cage_shift, public.chip_inventory_count, public.chip_inventory_line to authenticated;
create policy "ledger readers see the venue's shifts" on public.cage_shift
  for select to authenticated using (venue_id in (select private.venues_where('ledger.read')));
create policy "ledger readers see the venue's chip counts" on public.chip_inventory_count
  for select to authenticated using (venue_id in (select private.venues_where('ledger.read')));
create policy "ledger readers see the venue's chip count lines" on public.chip_inventory_line
  for select to authenticated using (venue_id in (select private.venues_where('ledger.read')));

-- Records a count in a shift: every chip the venue uses, once each, as a whole number from 0. Once per request id.
create function private.record_chip_count(p_venue_id uuid, p_shift_id uuid, p_counts jsonb, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_given integer;
  v_known integer;
  v_distinct integer;
  v_id uuid;
begin
  if jsonb_typeof(p_counts) is distinct from 'array' or exists (
    select 1 from jsonb_array_elements(p_counts) e
    where jsonb_typeof(e) <> 'object' or coalesce(e ->> 'value_paise', '') !~ '^[0-9]{1,12}$' or coalesce(e ->> 'quantity', '') !~ '^[0-9]{1,6}$'
  ) then
    raise exception 'Count each chip as a whole number' using errcode = '22023';
  end if;
  select count(*), count(d.id), count(distinct d.id) into v_given, v_known, v_distinct
  from jsonb_array_elements(p_counts) e
  left join public.chip_denomination d on d.venue_id = p_venue_id and d.is_active and d.value_paise = (e ->> 'value_paise')::bigint;
  if v_known <> v_given or v_distinct <> v_given
     or v_given <> (select count(*) from public.chip_denomination d where d.venue_id = p_venue_id and d.is_active) then
    raise exception 'Count every chip the venue uses, once each' using errcode = '22023';
  end if;
  insert into public.chip_inventory_count (venue_id, shift_id, counted_by_staff_id, idempotency_key)
  values (p_venue_id, p_shift_id, private.current_staff_id(p_venue_id), p_idempotency_key)
  returning id into v_id;
  insert into public.chip_inventory_line (count_id, venue_id, value_paise, quantity)
  select v_id, p_venue_id, (e ->> 'value_paise')::bigint, (e ->> 'quantity')::integer
  from jsonb_array_elements(p_counts) e;
  return v_id;
end;
$$;

-- Whether a count holds exactly the counts given: a replayed request id must be the same count.
create function private.is_same_chip_count(p_count_id uuid, p_counts jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    (select l.value_paise::text, l.quantity::text from public.chip_inventory_line l where l.count_id = p_count_id)
    except
    (select e ->> 'value_paise', e ->> 'quantity' from jsonb_array_elements(p_counts) e)
  ) and (select count(*) from public.chip_inventory_line l where l.count_id = p_count_id) = jsonb_array_length(p_counts);
$$;

-- A cashier opens the cage's shift with the float and a count of its chips. One open at a time (RVSHO).
-- A count moves no money, so a freeze does not stop it.
create function private.open_cage_shift(p_venue_id uuid, p_float_paise bigint, p_counts jsonb, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay public.cage_shift;
  v_id uuid;
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
  perform private.record_chip_count(p_venue_id, v_id, p_counts, p_idempotency_key);
  return v_id;
end;
$$;

-- A cashier counts the chips in the cage again during the open shift (RVNSH without one).
create function private.count_chips(p_venue_id uuid, p_counts jsonb, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier counts the cage''s chips' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cage_shift:' || p_venue_id, 0));
  select c.id into v_id from public.chip_inventory_count c where c.venue_id = p_venue_id and c.idempotency_key = p_idempotency_key;
  if v_id is not null then
    if not private.is_same_chip_count(v_id, p_counts) then
      raise exception 'That request id was used for another count' using errcode = '22023';
    end if;
    return v_id;
  end if;
  select s.id into v_shift from public.cage_shift s where s.venue_id = p_venue_id and s.closed_at is null;
  if v_shift is null then
    raise exception 'No shift is open: open one with the float' using errcode = 'RVNSH';
  end if;
  return private.record_chip_count(p_venue_id, v_shift, p_counts, p_idempotency_key);
end;
$$;

-- The Treasury (#24, as the prototype): what the venue holds for players and in play, from the ledger,
-- and the open shift's float. Ledger readers only.
create function private.treasury(p_venue_id uuid)
returns table (wallets_paise bigint, withdrawals_pending_paise bigint, bonus_paise bigint, markers_paise bigint, jackpots_paise bigint,
               chips_in_play_paise bigint, shift_id uuid, float_paise bigint, opened_at timestamptz, opened_by text)
language sql
stable
security definer
set search_path = ''
as $$
  with balance as (
    select a.code, sum(e.amount) as paise
    from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
    where a.venue_id = p_venue_id and a.unit = 'paise'
    group by a.code
  )
  -- Liabilities are credits, so they are the negative of their entries; markers are owed to the venue.
  select coalesce((select -b.paise from balance b where b.code = 'member.cash'), 0)::bigint,
         coalesce((select -b.paise from balance b where b.code = 'venue.withdrawals_pending'), 0)::bigint,
         coalesce((select -b.paise from balance b where b.code = 'member.bonus'), 0)::bigint,
         coalesce((select b.paise from balance b where b.code = 'member.receivable'), 0)::bigint,
         coalesce((select -sum(b.paise) from balance b where b.code like 'venue.jackpot.%'), 0)::bigint,
         coalesce((select -b.paise from balance b where b.code = 'venue.chips_outstanding'), 0)::bigint,
         s.id, s.float_paise, s.opened_at, st.full_name
  from (select 1) one
  left join public.cage_shift s on s.venue_id = p_venue_id and s.closed_at is null
  left join public.staff st on st.id = s.opened_by_staff_id
  where private.has_permission(p_venue_id, 'ledger.read');
$$;

-- The venue's chips with the open shift's latest count of each (null before one), and what the cage holds.
create function private.chip_inventory(p_venue_id uuid)
returns table (value_paise bigint, name text, quantity integer, line_paise bigint, in_cage_paise bigint, counted_at timestamptz, counted_by text)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select c.id, c.counted_at, st.full_name
    from public.chip_inventory_count c
    join public.cage_shift s on s.id = c.shift_id and s.closed_at is null
    join public.staff st on st.id = c.counted_by_staff_id
    where c.venue_id = p_venue_id
    order by c.counted_at desc, c.id desc
    limit 1
  )
  select d.value_paise, d.name, l.quantity, d.value_paise * l.quantity,
         sum(d.value_paise * l.quantity) over ()::bigint, latest.counted_at, latest.full_name
  from public.chip_denomination d
  left join latest on true
  left join public.chip_inventory_line l on l.count_id = latest.id and l.value_paise = d.value_paise
  where d.venue_id = p_venue_id and d.is_active and private.has_permission(p_venue_id, 'ledger.read')
  order by d.value_paise;
$$;

create function public.open_cage_shift(p_venue_id uuid, p_float_paise bigint, p_counts jsonb, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.open_cage_shift(p_venue_id, p_float_paise, p_counts, p_idempotency_key); $$;
create function public.count_chips(p_venue_id uuid, p_counts jsonb, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.count_chips(p_venue_id, p_counts, p_idempotency_key); $$;
create function public.treasury(p_venue_id uuid)
returns table (wallets_paise bigint, withdrawals_pending_paise bigint, bonus_paise bigint, markers_paise bigint, jackpots_paise bigint,
               chips_in_play_paise bigint, shift_id uuid, float_paise bigint, opened_at timestamptz, opened_by text)
language sql stable security invoker set search_path = ''
as $$ select * from private.treasury(p_venue_id); $$;
create function public.chip_inventory(p_venue_id uuid)
returns table (value_paise bigint, name text, quantity integer, line_paise bigint, in_cage_paise bigint, counted_at timestamptz, counted_by text)
language sql stable security invoker set search_path = ''
as $$ select * from private.chip_inventory(p_venue_id); $$;

revoke execute on function private.record_chip_count(uuid, uuid, jsonb, uuid), private.is_same_chip_count(uuid, jsonb) from public, anon, authenticated;
revoke execute on function private.open_cage_shift(uuid, bigint, jsonb, uuid), private.count_chips(uuid, jsonb, uuid),
  private.treasury(uuid), private.chip_inventory(uuid),
  public.open_cage_shift(uuid, bigint, jsonb, uuid), public.count_chips(uuid, jsonb, uuid),
  public.treasury(uuid), public.chip_inventory(uuid) from public, anon;
grant execute on function private.open_cage_shift(uuid, bigint, jsonb, uuid), private.count_chips(uuid, jsonb, uuid),
  private.treasury(uuid), private.chip_inventory(uuid),
  public.open_cage_shift(uuid, bigint, jsonb, uuid), public.count_chips(uuid, jsonb, uuid),
  public.treasury(uuid), public.chip_inventory(uuid) to authenticated;
