-- Table-side food and drink orders (#123; question #531 and #565, the owner's answers of 27 Oct; decision 0260). A
-- seated member orders from the player app (feature fnb.table_side), a dealer orders for a seat from the tablet, and
-- staff who run F&B order from the console. Every order is posted to the seat's visit, paid or comp: app and tablet
-- orders are always paid, and only fnb.manage may comp. Each prints a KOT at Glaza's bar: the order emits fnb.ordered,
-- which the cage agent prints through @rivr/adapters' kitchen printer as the outbox consumer bar_printer, for its own
-- venue only and never the practice venue's. Until the agent prints it, the console lists it to print by hand.
create table public.fnb_order (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  visit_id uuid not null references public.visit (id),
  member_id uuid not null,
  table_id uuid not null,
  seat integer not null check (seat between 1 and 10),
  -- The KOT's number, from 1 each club night at the venue.
  club_day date not null,
  kot_number integer not null check (kot_number > 0),
  -- What was ordered, as the menu named it then: 1 to 20 lines of item, name, kind, quantity (1 to 9) and a note.
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 20),
  is_comp boolean not null default false,
  source text not null check (source in ('app', 'tablet', 'console')),
  -- The dealer on the tablet's down, or the staff member at the console; none for the member's own order.
  placed_by_staff_id uuid,
  placed_by_device_id uuid,
  kot_sent_at timestamptz,
  kot_sent_by text check (kot_sent_by in ('agent', 'staff')),
  kot_sent_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, club_day, kot_number),
  check ((kot_sent_at is null) = (kot_sent_by is null)),
  check (source = 'console' or not is_comp),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (placed_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (placed_by_device_id, venue_id) references public.device (id, venue_id),
  foreign key (kot_sent_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.fnb_order is 'A table-side food and drink order (#123): the seat''s visit, paid or comp, and its KOT at the bar.';

create index fnb_order_night_idx on public.fnb_order (venue_id, club_day);
create index fnb_order_visit_idx on public.fnb_order (visit_id);
create index fnb_order_member_idx on public.fnb_order (member_id, venue_id, created_at);
create index fnb_order_table_idx on public.fnb_order (table_id, venue_id);
create index fnb_order_placed_by_staff_idx on public.fnb_order (placed_by_staff_id, venue_id);
create index fnb_order_placed_by_device_idx on public.fnb_order (placed_by_device_id, venue_id);
create index fnb_order_sent_by_staff_idx on public.fnb_order (kot_sent_by_staff_id, venue_id);

create trigger fnb_order_touch_updated_at before update on public.fnb_order
  for each row execute function private.touch_updated_at();
create trigger fnb_order_audit after insert or update or delete on public.fnb_order
  for each row execute function private.audit_row_change();

alter table public.fnb_order enable row level security;
grant select (id, venue_id, visit_id, member_id, table_id, seat, club_day, kot_number, lines, is_comp, source, placed_by_staff_id,
              placed_by_device_id, kot_sent_at, kot_sent_by, kot_sent_by_staff_id, created_at, updated_at)
  on public.fnb_order to authenticated;
create policy "staff who run F&B see the venue's orders" on public.fnb_order
  for select to authenticated using (venue_id in (select private.venues_where('fnb.manage')));
create policy "members see their own orders" on public.fnb_order
  for select to authenticated using (member_id = (select private.current_member_id())
                                      and private.has_feature((select private.current_member_id()), 'fnb.table_side'));

-- A member's export gives their orders whole.
insert into private.member_export_column (table_name, column_name, kind)
select 'fnb_order', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'visit_id', 'member_id', 'table_id', 'seat', 'club_day', 'kot_number', 'lines', 'is_comp', 'source',
                  'placed_by_staff_id', 'placed_by_device_id', 'kot_sent_at', 'kot_sent_by', 'kot_sent_by_staff_id', 'created_at',
                  'updated_at']) c (column_name);

-- Records an order for the seat in `p_session`: checks each line against the venue's menu (an app order's alcohol only
-- for a member who may be offered it), numbers its KOT for the club night, posts it to the seat's visit, and emits
-- fnb.ordered with the KOT, naming no member. 22023 for a malformed line, RVFNI for an item not on offer.
create function private.record_fnb_order(p_session public.seat_session, p_lines jsonb, p_is_comp boolean, p_source text,
                                         p_staff_id uuid, p_device_id uuid)
returns table (order_id uuid, kot_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_lines jsonb;
  v_day date := private.club_day_now();
  v_number integer;
  v_id uuid;
begin
  perform private.assert_writable(p_session.venue_id, null, p_session.member_id);
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 20
     or exists (select 1 from jsonb_array_elements(p_lines) l
                where jsonb_typeof(l -> 'quantity') is distinct from 'number' or (l ->> 'quantity')::numeric not in (1, 2, 3, 4, 5, 6, 7, 8, 9)
                   or coalesce(l ->> 'item_id', '') !~ '^[0-9a-f-]{36}$' or length(coalesce(l ->> 'note', '')) > 120) then
    raise exception 'An order is 1 to 20 lines, each an item and a quantity of 1 to 9' using errcode = '22023';
  end if;
  select jsonb_agg(jsonb_build_object('item_id', i.id, 'name', i.name, 'kind', i.kind, 'quantity', (l.value ->> 'quantity')::integer,
                                      'note', nullif(trim(coalesce(l.value ->> 'note', '')), '')) order by l.ord)
  into v_lines
  from jsonb_array_elements(p_lines) with ordinality l (value, ord)
  join public.fnb_item i on i.id = (l.value ->> 'item_id')::uuid and i.venue_id = p_session.venue_id and i.is_available;
  if coalesce(jsonb_array_length(v_lines), 0) <> jsonb_array_length(p_lines) then
    raise exception 'That item is not on the menu now' using errcode = 'RVFNI';
  end if;
  if p_source = 'app' and v_lines @> '[{"kind": "alcohol"}]' and not private.may_order_alcohol(p_session.member_id) then
    raise exception 'Alcohol is ordered at 21 or over' using errcode = 'RVAGE';
  end if;
  perform pg_advisory_xact_lock(hashtext('kot:' || p_session.venue_id::text));
  select coalesce(max(o.kot_number), 0) + 1 into v_number from public.fnb_order o where o.venue_id = p_session.venue_id and o.club_day = v_day;
  insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, kot_number, lines, is_comp, source,
                                placed_by_staff_id, placed_by_device_id)
  values (p_session.venue_id, p_session.visit_id, p_session.member_id, p_session.table_id, p_session.seat, v_day, v_number, v_lines,
          coalesce(p_is_comp, false), p_source, p_staff_id, p_device_id)
  returning id into v_id;
  perform private.emit(p_session.venue_id, 'fnb.ordered',
    jsonb_build_object('order_id', v_id, 'kot_number', v_number::text,
                       'table_name', (select g.name from public.game_table g where g.id = p_session.table_id), 'seat', p_session.seat,
                       'items', (select jsonb_agg(jsonb_build_object('name', x ->> 'name', 'quantity', (x ->> 'quantity')::integer, 'note', x -> 'note'))
                                 from jsonb_array_elements(v_lines) x),
                       'ordered_at', now(), 'is_comp', coalesce(p_is_comp, false)),
    'fnb.ordered:' || v_id);
  return query select v_id, v_number;
end;
$$;

-- A seated member orders for their own seat from the player app: their tier must have table-side ordering, and an
-- order a minute at most. Always paid. RVFNS when not seated, RVFST for a second order inside the minute.
create function private.place_fnb_order(p_lines jsonb)
returns table (order_id uuid, kot_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_session public.seat_session;
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'fnb.table_side') then
    raise exception 'Table-side ordering is not part of your tier' using errcode = '42501';
  end if;
  select * into v_session from public.seat_session s where s.member_id = v_member_id and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Order from your seat: you are not seated' using errcode = 'RVFNS';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fnb:' || v_member_id::text, 0));
  if exists (select 1 from public.fnb_order o where o.member_id = v_member_id and o.source = 'app' and o.created_at > now() - interval '1 minute') then
    raise exception 'One order a minute: the bar has your last one' using errcode = 'RVFST';
  end if;
  return query select * from private.record_fnb_order(v_session, p_lines, false, 'app', null, null);
end;
$$;

-- The dealer orders for a seat at the tablet's table, during their down. Always paid. RVDWN with no dealer signed in,
-- RVFNS when nobody sits in the seat.
create function private.tablet_fnb_order(p_seat integer, p_lines jsonb)
returns table (order_id uuid, kot_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
  v_down record;
  v_session public.seat_session;
begin
  select * into v_tablet from private.my_tablet_table();
  select * into v_down from private.current_down();
  if v_down.down_id is null then
    raise exception 'Sign a dealer in before ordering' using errcode = 'RVDWN';
  end if;
  select * into v_session from public.seat_session s where s.table_id = v_tablet.o_table_id and s.seat = p_seat and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Nobody sits in that seat' using errcode = 'RVFNS';
  end if;
  return query select * from private.record_fnb_order(v_session, p_lines, false, 'tablet', v_down.staff_id, v_tablet.o_device_id);
end;
$$;

-- Staff who run F&B order for a seat from the console, paid or comp: a comp is RIVR's cost, at Glaza's price through the
-- monthly import (#109). RVFNS when nobody sits in the seat.
create function private.console_fnb_order(p_venue_id uuid, p_table_id uuid, p_seat integer, p_lines jsonb, p_is_comp boolean)
returns table (order_id uuid, kot_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  if not private.has_permission(p_venue_id, 'fnb.manage') then
    raise exception 'Only staff who run F&B order from the console' using errcode = '42501';
  end if;
  select * into v_session from public.seat_session s
  where s.venue_id = p_venue_id and s.table_id = p_table_id and s.seat = p_seat and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Nobody sits in that seat' using errcode = 'RVFNS';
  end if;
  return query select * from private.record_fnb_order(v_session, p_lines, p_is_comp, 'console', private.current_staff_id(p_venue_id), null);
end;
$$;

-- Tonight's orders at the venue, the latest first, for staff who run F&B: the KOT, table, seat, member, lines, paid or
-- comp, and whether the bar has the KOT.
create function private.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, g.name, o.seat, m.full_name, m.member_number, o.lines, o.is_comp, o.source, o.created_at, o.kot_sent_at, o.kot_sent_by
  from public.fnb_order o
  join public.game_table g on g.id = o.table_id
  join public.member m on m.id = o.member_id
  where o.venue_id = p_venue_id and o.club_day = private.club_day_now() and private.has_permission(p_venue_id, 'fnb.manage')
  order by o.kot_number desc;
$$;

-- The bar has this KOT, given by hand: the cage agent will not print it now. fnb.manage.
create function private.mark_kot_sent(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.fnb_order;
begin
  select * into v_order from public.fnb_order o where o.id = p_order_id for update;
  if v_order.id is null or not private.has_permission(v_order.venue_id, 'fnb.manage') then
    raise exception 'Only staff who run F&B send a KOT' using errcode = '42501';
  end if;
  perform private.assert_writable(v_order.venue_id);
  update public.fnb_order o set kot_sent_at = now(), kot_sent_by = 'staff', kot_sent_by_staff_id = private.current_staff_id(v_order.venue_id)
  where o.id = p_order_id and o.kot_sent_at is null;
end;
$$;

-- The cage agent's KOTs to print, as the outbox consumer bar_printer, for its own venue only and never the practice
-- venue's: like claim_outbox_deliveries, one at a time per KOT. A KOT the bar was given by hand, or older than two
-- hours, is closed without printing.
create function private.claim_agent_kots(p_device_id uuid, p_limit integer)
returns table (delivery_id uuid, event_id uuid, venue_id uuid, event_type text, payload jsonb, attempts integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_venue_id uuid;
begin
  select d.venue_id into v_venue_id from public.device d join public.venue v on v.id = d.venue_id
  where d.id = p_device_id and d.kind = 'agent' and d.revoked_at is null and not v.is_practice;
  if v_venue_id is null then
    return;
  end if;
  insert into public.outbox_delivery (venue_id, event_id, consumer)
  select e.venue_id, e.id, 'bar_printer' from public.outbox_event e
  where e.venue_id = v_venue_id and e.event_type = 'fnb.ordered' and e.occurred_at > now() - interval '1 day'
  on conflict (event_id, consumer) do nothing;
  update public.outbox_delivery d
  set status = 'delivered', delivered_at = now(), locked_until = null,
      last_error = case when o.kot_sent_at is not null then 'given to the bar by hand' else 'too old to print' end
  from public.outbox_event e left join public.fnb_order o on o.id = (e.payload ->> 'order_id')::uuid
  where d.event_id = e.id and d.venue_id = v_venue_id and d.consumer = 'bar_printer'
    and (d.status in ('pending', 'failed') or (d.status = 'processing' and d.locked_until < now()))
    and (o.kot_sent_at is not null or e.occurred_at < now() - interval '2 hours');
  return query
  with ready as (
    select d.id from public.outbox_delivery d
    where d.venue_id = v_venue_id and d.consumer = 'bar_printer'
      and (d.status in ('pending', 'failed') or (d.status = 'processing' and d.locked_until < now()))
      and d.attempts < 10 and d.available_at <= now() and (d.locked_until is null or d.locked_until < now())
    order by d.available_at
    limit greatest(1, least(coalesce(p_limit, 10), 20))
    for update of d skip locked
  )
  update public.outbox_delivery d
  set status = 'processing', attempts = d.attempts + 1, locked_until = now() + interval '1 minute'
  from ready, public.outbox_event e
  where d.id = ready.id and e.id = d.event_id
  returning d.id, e.id, e.venue_id, e.event_type, e.payload, d.attempts;
end;
$$;

-- The agent finishes a KOT it claimed: printed, which tells the order the bar has it, or failed with when to try again.
create function private.finish_agent_kot(p_device_id uuid, p_delivery_id uuid, p_delivered boolean, p_error text, p_retry_after_seconds integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  select (e.payload ->> 'order_id')::uuid into v_order_id
  from public.outbox_delivery d
  join public.outbox_event e on e.id = d.event_id
  join public.device a on a.id = p_device_id and a.kind = 'agent' and a.revoked_at is null and a.venue_id = d.venue_id
  where d.id = p_delivery_id and d.consumer = 'bar_printer' and d.status = 'processing';
  if v_order_id is null then
    raise exception 'No such KOT for this agent' using errcode = '42501';
  end if;
  perform public.finish_outbox_delivery(p_delivery_id, p_delivered, p_error,
    case when p_retry_after_seconds is null then null else make_interval(secs => p_retry_after_seconds) end);
  if p_delivered then
    update public.fnb_order o set kot_sent_at = now(), kot_sent_by = 'agent' where o.id = v_order_id and o.kot_sent_at is null;
  end if;
end;
$$;

create function public.place_fnb_order(p_lines jsonb)
returns table (order_id uuid, kot_number integer) language sql volatile security invoker set search_path = ''
as $$ select * from private.place_fnb_order(p_lines); $$;
create function public.tablet_fnb_order(p_seat integer, p_lines jsonb)
returns table (order_id uuid, kot_number integer) language sql volatile security invoker set search_path = ''
as $$ select * from private.tablet_fnb_order(p_seat, p_lines); $$;
create function public.console_fnb_order(p_venue_id uuid, p_table_id uuid, p_seat integer, p_lines jsonb, p_is_comp boolean)
returns table (order_id uuid, kot_number integer) language sql volatile security invoker set search_path = ''
as $$ select * from private.console_fnb_order(p_venue_id, p_table_id, p_seat, p_lines, p_is_comp); $$;
create function public.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_orders_tonight(p_venue_id); $$;
create function public.mark_kot_sent(p_order_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.mark_kot_sent(p_order_id); $$;
create function public.claim_agent_kots(p_device_id uuid, p_limit integer)
returns table (delivery_id uuid, event_id uuid, venue_id uuid, event_type text, payload jsonb, attempts integer)
language sql volatile security invoker set search_path = ''
as $$ select * from private.claim_agent_kots(p_device_id, p_limit); $$;
create function public.finish_agent_kot(p_device_id uuid, p_delivery_id uuid, p_delivered boolean, p_error text, p_retry_after_seconds integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.finish_agent_kot(p_device_id, p_delivery_id, p_delivered, p_error, p_retry_after_seconds); $$;

revoke execute on function private.record_fnb_order(public.seat_session, jsonb, boolean, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function private.place_fnb_order(jsonb), public.place_fnb_order(jsonb), private.tablet_fnb_order(integer, jsonb),
  public.tablet_fnb_order(integer, jsonb), private.console_fnb_order(uuid, uuid, integer, jsonb, boolean),
  public.console_fnb_order(uuid, uuid, integer, jsonb, boolean), private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid),
  private.mark_kot_sent(uuid), public.mark_kot_sent(uuid)
  from public, anon;
grant execute on function private.place_fnb_order(jsonb), public.place_fnb_order(jsonb), private.tablet_fnb_order(integer, jsonb),
  public.tablet_fnb_order(integer, jsonb), private.console_fnb_order(uuid, uuid, integer, jsonb, boolean),
  public.console_fnb_order(uuid, uuid, integer, jsonb, boolean), private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid),
  private.mark_kot_sent(uuid), public.mark_kot_sent(uuid)
  to authenticated;
revoke execute on function private.claim_agent_kots(uuid, integer), public.claim_agent_kots(uuid, integer),
  private.finish_agent_kot(uuid, uuid, boolean, text, integer), public.finish_agent_kot(uuid, uuid, boolean, text, integer)
  from public, anon, authenticated;
grant execute on function private.claim_agent_kots(uuid, integer), public.claim_agent_kots(uuid, integer),
  private.finish_agent_kot(uuid, uuid, boolean, text, integer), public.finish_agent_kot(uuid, uuid, boolean, text, integer)
  to service_role;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
