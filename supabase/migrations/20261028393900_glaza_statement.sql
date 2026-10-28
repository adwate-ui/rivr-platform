-- The Glaza statement (#109; scope-v1 module 13; question #580; decision 0265). Staff who run F&B import a club month of
-- Glaza's lines from its CSV: each item sold or comped, with its IST time, table, seat when Glaza has it, kind (food,
-- soft drink or alcohol), quantity, unit cost and unit price. Each line is matched to a visit by table and time: the
-- club's table of that name, and the one player seated there at that time (at that seat, when given), where they sat
-- then by their seat moves; a line with no such table, nobody seated, or more than one player and no seat stays
-- unmatched. The month's statement reads its
-- latest import, so a corrected file stands in for the first; both are kept. What RIVR comped is owed to Glaza at
-- cost; the margin on alcohol sold is split 50:50, RIVR's half rounded toward nothing to the paisa; NewCo's payable
-- to Glaza is the comps less RIVR's half (private.glaza_statement_of and private.glaza_payable, the twins of
-- @rivr/domain glazaStatement and glazaPayable on packages/testing/golden/glaza.json).

-- @rivr/domain glazaPayable: RIVR's half of the alcohol margin, rounded toward nothing, and the comps less that half.
create function private.glaza_payable(p_comps_paise bigint, p_alcohol_margin_paise bigint, out rivr_share_paise bigint, out payable_paise bigint)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_comps_paise < 0 then
    raise exception 'Comps at cost are never negative' using errcode = '22023';
  end if;
  -- Integer division rounds toward nothing.
  rivr_share_paise := p_alcohol_margin_paise / 2;
  payable_paise := p_comps_paise - rivr_share_paise;
end;
$$;

-- @rivr/domain glazaStatement: a month of Glaza's lines (kind, quantity, unit_cost_paise, unit_price_paise, is_comp) as its
-- statement. A comped line is owed at cost, by kind; an alcohol line sold is in the alcohol sales at its price and their
-- cost at its cost; food and soft drinks sold are Glaza's alone. Then glaza_payable on the comps and the margin.
create function private.glaza_statement_of(p_lines jsonb)
returns table (food_comps_paise bigint, soft_drink_comps_paise bigint, alcohol_comps_paise bigint, comps_paise bigint, alcohol_sales_paise bigint,
               alcohol_cost_paise bigint, alcohol_margin_paise bigint, rivr_share_paise bigint, payable_paise bigint)
language sql
immutable
set search_path = ''
as $$
  with lines as (
    select x.kind, x.quantity::bigint as quantity, x.unit_cost_paise, x.unit_price_paise, x.is_comp
    from jsonb_to_recordset(p_lines) as x (kind text, quantity integer, unit_cost_paise bigint, unit_price_paise bigint, is_comp boolean)
  ),
  totals as (
    select coalesce(sum(quantity * unit_cost_paise) filter (where is_comp and kind = 'food'), 0)::bigint as food,
           coalesce(sum(quantity * unit_cost_paise) filter (where is_comp and kind = 'soft_drink'), 0)::bigint as soft_drink,
           coalesce(sum(quantity * unit_cost_paise) filter (where is_comp and kind = 'alcohol'), 0)::bigint as alcohol,
           coalesce(sum(quantity * unit_price_paise) filter (where not is_comp and kind = 'alcohol'), 0)::bigint as sales,
           coalesce(sum(quantity * unit_cost_paise) filter (where not is_comp and kind = 'alcohol'), 0)::bigint as cost
    from lines
  )
  select t.food, t.soft_drink, t.alcohol, t.food + t.soft_drink + t.alcohol, t.sales, t.cost, t.sales - t.cost, p.rivr_share_paise, p.payable_paise
  from totals t cross join lateral private.glaza_payable(t.food + t.soft_drink + t.alcohol, t.sales - t.cost) p;
$$;

create table public.glaza_import (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- The club month (06:00 IST on its 1st to the next month's), as its 1st.
  month date not null check (extract(day from month) = 1),
  imported_by_staff_id uuid not null,
  -- The clock, not the transaction's start: of two imports in one transaction the later is the month's.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  foreign key (imported_by_staff_id, venue_id) references public.staff (id, venue_id)
);
comment on table public.glaza_import is 'One import of Glaza''s CSV for a club month (#109); the latest is the month''s statement.';
create index glaza_import_month_idx on public.glaza_import (venue_id, month, created_at desc);
create index glaza_import_staff_idx on public.glaza_import (imported_by_staff_id, venue_id);
create trigger glaza_import_touch_updated_at before update on public.glaza_import
  for each row execute function private.touch_updated_at();
create trigger glaza_import_audit after insert or update or delete on public.glaza_import
  for each row execute function private.audit_row_change();

create table public.glaza_import_line (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  import_id uuid not null,
  line_number integer not null check (line_number >= 1),
  sold_at timestamptz not null,
  table_name text not null check (length(table_name) between 1 and 80),
  seat integer check (seat between 1 and 10),
  item text not null check (length(item) between 1 and 120),
  kind text not null check (kind in ('food', 'soft_drink', 'alcohol')),
  quantity integer not null check (quantity between 1 and 1000),
  unit_cost_paise bigint not null check (unit_cost_paise between 0 and 10000000),
  unit_price_paise bigint not null check (unit_price_paise between 0 and 10000000),
  is_comp boolean not null,
  -- The club's table of that name, and the visit of the one player seated there then; null when unmatched.
  table_id uuid,
  visit_id uuid references public.visit (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, line_number),
  foreign key (import_id, venue_id) references public.glaza_import (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id)
);
comment on table public.glaza_import_line is 'A line of Glaza''s CSV (#109), matched to a visit by table and time when it can be.';
create index glaza_import_line_table_idx on public.glaza_import_line (table_id, venue_id);
create index glaza_import_line_visit_idx on public.glaza_import_line (visit_id);
create trigger glaza_import_line_touch_updated_at before update on public.glaza_import_line
  for each row execute function private.touch_updated_at();

alter table public.glaza_import enable row level security;
alter table public.glaza_import_line enable row level security;
grant select on public.glaza_import, public.glaza_import_line to authenticated;
create policy "staff who run F&B see Glaza's imports" on public.glaza_import
  for select to authenticated using (venue_id in (select private.venues_where('fnb.manage')));
create policy "staff who run F&B see Glaza's lines" on public.glaza_import_line
  for select to authenticated using (venue_id in (select private.venues_where('fnb.manage')));

-- Imports a club month of Glaza's lines, matching each to a visit. Refusals: 42501 not staff who run F&B; 22023 no lines,
-- more than 5,000, a line out of bounds, or one sold outside the club month; RVFRZ the venue frozen.
create function private.import_glaza_lines(p_venue_id uuid, p_month date, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'fnb.manage'), false) then
    raise exception 'Staff who run F&B import Glaza''s lines' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 5000 then
    raise exception 'From 1 to 5,000 lines' using errcode = '22023';
  end if;
  insert into public.glaza_import (venue_id, month, imported_by_staff_id)
  values (p_venue_id, p_month, private.current_staff_id(p_venue_id))
  returning id into v_import_id;
  insert into public.glaza_import_line (venue_id, import_id, line_number, sold_at, table_name, seat, item, kind, quantity, unit_cost_paise,
                                        unit_price_paise, is_comp, table_id, visit_id)
  select p_venue_id, v_import_id, e.n, l.sold_at, l.table_name, l.seat, l.item, l.kind, l.quantity, l.unit_cost_paise, l.unit_price_paise,
         l.is_comp, g.id, s.visit_id
  from jsonb_array_elements(p_lines) with ordinality as e (line, n)
  cross join lateral (
    select (e.line ->> 'sold_at')::timestamptz as sold_at, btrim(e.line ->> 'table_name') as table_name, (e.line ->> 'seat')::integer as seat,
           btrim(e.line ->> 'item') as item, e.line ->> 'kind' as kind, (e.line ->> 'quantity')::integer as quantity,
           (e.line ->> 'unit_cost_paise')::bigint as unit_cost_paise, (e.line ->> 'unit_price_paise')::bigint as unit_price_paise,
           (e.line ->> 'is_comp')::boolean as is_comp
  ) l
  left join public.game_table g on g.venue_id = p_venue_id and lower(g.name) = lower(l.table_name)
  left join lateral (
    select (array_agg(x.visit_id))[1] as visit_id
    from public.seat_session x
    -- Where the player sat then: the seat they left by their first move after it, or the one they are in.
    cross join lateral (
      select coalesce(m.from_table_id, x.table_id) as table_id, coalesce(m.from_seat, x.seat) as seat
      from (select 1) one
      left join lateral (select y.from_table_id, y.from_seat from public.seat_move y where y.session_id = x.id and y.created_at > l.sold_at
                         order by y.created_at limit 1) m on true
    ) then_at
    where x.venue_id = p_venue_id and x.started_at <= l.sold_at and (x.ended_at is null or x.ended_at > l.sold_at)
      and then_at.table_id = g.id and (l.seat is null or then_at.seat = l.seat)
    having count(*) = 1
  ) s on true;
  if exists (select 1 from public.glaza_import_line x where x.import_id = v_import_id and private.league_month(x.sold_at) <> p_month) then
    raise exception 'Every line is sold in the club month' using errcode = '22023';
  end if;
  return v_import_id;
exception
  when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow
    or numeric_value_out_of_range then
    raise exception 'Each line needs a time, a table, an item, its kind, a quantity, a unit cost and price, and whether it was a comp'
      using errcode = '22023';
end;
$$;

-- The club month's statement from its latest import: comps at Glaza's cost by kind, alcohol sold with its cost and
-- margin, RIVR's half of the margin and NewCo's payable to Glaza, and how many lines were matched to a visit. No row
-- for a month with no import. Refusal: 42501 not staff who run F&B.
create function private.glaza_statement(p_venue_id uuid, p_month date)
returns table (import_id uuid, imported_at timestamptz, lines integer, matched integer, food_comps_paise bigint, soft_drink_comps_paise bigint,
               alcohol_comps_paise bigint, comps_paise bigint, alcohol_sales_paise bigint, alcohol_cost_paise bigint, alcohol_margin_paise bigint,
               rivr_share_paise bigint, payable_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'fnb.manage'), false) then
    raise exception 'Staff who run F&B read Glaza''s statement' using errcode = '42501';
  end if;
  return query
  with latest as (
    select i.id, i.created_at from public.glaza_import i
    where i.venue_id = p_venue_id and i.month = p_month
    order by i.created_at desc, i.id limit 1
  ),
  lines as (
    select count(*)::integer as lines, count(l.visit_id)::integer as matched,
           coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'quantity', l.quantity, 'unit_cost_paise', l.unit_cost_paise,
                                                 'unit_price_paise', l.unit_price_paise, 'is_comp', l.is_comp)), '[]'::jsonb) as items
    from latest join public.glaza_import_line l on l.import_id = latest.id
  )
  select latest.id, latest.created_at, t.lines, t.matched, s.food_comps_paise, s.soft_drink_comps_paise, s.alcohol_comps_paise, s.comps_paise,
         s.alcohol_sales_paise, s.alcohol_cost_paise, s.alcohol_margin_paise, s.rivr_share_paise, s.payable_paise
  from latest cross join lines t cross join lateral private.glaza_statement_of(t.items) s;
end;
$$;

create function public.import_glaza_lines(p_venue_id uuid, p_month date, p_lines jsonb)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.import_glaza_lines(p_venue_id, p_month, p_lines); $$;
create function public.glaza_statement(p_venue_id uuid, p_month date)
returns table (import_id uuid, imported_at timestamptz, lines integer, matched integer, food_comps_paise bigint, soft_drink_comps_paise bigint,
               alcohol_comps_paise bigint, comps_paise bigint, alcohol_sales_paise bigint, alcohol_cost_paise bigint, alcohol_margin_paise bigint,
               rivr_share_paise bigint, payable_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.glaza_statement(p_venue_id, p_month); $$;

revoke execute on function private.glaza_payable(bigint, bigint), private.glaza_statement_of(jsonb) from public, anon, authenticated;
revoke execute on function private.import_glaza_lines(uuid, date, jsonb), private.glaza_statement(uuid, date),
  public.import_glaza_lines(uuid, date, jsonb), public.glaza_statement(uuid, date) from public, anon;
grant execute on function private.import_glaza_lines(uuid, date, jsonb), private.glaza_statement(uuid, date),
  public.import_glaza_lines(uuid, date, jsonb), public.glaza_statement(uuid, date) to authenticated;
