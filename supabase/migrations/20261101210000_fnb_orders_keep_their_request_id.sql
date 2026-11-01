-- A food and drink order from the app or the dealer's tablet keeps its request id (F3-18, F4-10 of the audit of 28 Oct),
-- as the console's does since 20261101140000_request_ids.sql: the same id again, as after a reply lost on a weak signal,
-- returns the order it placed instead of sending a second KOT to the bar, and an id used for another order is refused
-- (22023). Copied from 20261028391700_fnb_orders.sql, their only definitions, with the request id added.

drop function public.place_fnb_order(jsonb);
drop function private.place_fnb_order(jsonb);
drop function public.tablet_fnb_order(integer, jsonb);
drop function private.tablet_fnb_order(integer, jsonb);

-- A seated member orders for their own seat from the player app: their tier must have table-side ordering, and an
-- order a minute at most. Always paid. RVFNS when not seated, RVFST for a second order inside the minute.
create function private.place_fnb_order(p_lines jsonb, p_idempotency_key uuid default null)
returns table (order_id uuid, kot_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_session public.seat_session;
  v_order_id uuid;
  v_kot integer;
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'fnb.table_side') then
    raise exception 'Table-side ordering is not part of your tier' using errcode = '42501';
  end if;
  select * into v_session from public.seat_session s where s.member_id = v_member_id and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Order from your seat: you are not seated' using errcode = 'RVFNS';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fnb:' || v_member_id::text, 0));
  if p_idempotency_key is not null then
    if exists (select 1 from public.fnb_order o where o.venue_id = v_session.venue_id and o.idempotency_key = p_idempotency_key
               and (o.member_id is distinct from v_member_id or o.source <> 'app')) then
      raise exception 'That request id was for another order' using errcode = '22023';
    end if;
    return query select o.id, o.kot_number from public.fnb_order o where o.venue_id = v_session.venue_id and o.idempotency_key = p_idempotency_key;
    if found then
      return;
    end if;
  end if;
  if exists (select 1 from public.fnb_order o where o.member_id = v_member_id and o.source = 'app' and o.created_at > now() - interval '1 minute') then
    raise exception 'One order a minute: the bar has your last one' using errcode = 'RVFST';
  end if;
  select r.order_id, r.kot_number into v_order_id, v_kot from private.record_fnb_order(v_session, p_lines, false, 'app', null, null) r;
  update public.fnb_order set idempotency_key = p_idempotency_key where id = v_order_id and p_idempotency_key is not null;
  return query select v_order_id, v_kot;
end;
$$;

-- The dealer orders for a seat at the tablet's table, during their down. Always paid. RVDWN with no dealer signed in,
-- RVFNS when nobody sits in the seat.
create function private.tablet_fnb_order(p_seat integer, p_lines jsonb, p_idempotency_key uuid default null)
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
  v_order_id uuid;
  v_kot integer;
begin
  select * into v_tablet from private.my_tablet_table();
  select * into v_down from private.current_down();
  if v_down.down_id is null then
    raise exception 'Sign a dealer in before ordering' using errcode = 'RVDWN';
  end if;
  if p_idempotency_key is not null then
    -- Two retries of one order at once: the second waits, then finds the first's order.
    perform pg_advisory_xact_lock(hashtextextended('fnb-request:' || p_idempotency_key::text, 0));
    if exists (select 1 from public.fnb_order o where o.venue_id = v_tablet.o_venue_id and o.idempotency_key = p_idempotency_key
               and (o.table_id is distinct from v_tablet.o_table_id or o.seat is distinct from p_seat or o.source <> 'tablet')) then
      raise exception 'That request id was for another order' using errcode = '22023';
    end if;
    return query select o.id, o.kot_number from public.fnb_order o where o.venue_id = v_tablet.o_venue_id and o.idempotency_key = p_idempotency_key;
    if found then
      return;
    end if;
  end if;
  select * into v_session from public.seat_session s where s.table_id = v_tablet.o_table_id and s.seat = p_seat and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Nobody sits in that seat' using errcode = 'RVFNS';
  end if;
  select r.order_id, r.kot_number into v_order_id, v_kot
  from private.record_fnb_order(v_session, p_lines, false, 'tablet', v_down.staff_id, v_tablet.o_device_id) r;
  update public.fnb_order set idempotency_key = p_idempotency_key where id = v_order_id and p_idempotency_key is not null;
  return query select v_order_id, v_kot;
end;
$$;

create function public.place_fnb_order(p_lines jsonb, p_idempotency_key uuid default null)
returns table (order_id uuid, kot_number integer) language sql volatile security invoker set search_path = ''
as $$ select * from private.place_fnb_order(p_lines, p_idempotency_key); $$;
create function public.tablet_fnb_order(p_seat integer, p_lines jsonb, p_idempotency_key uuid default null)
returns table (order_id uuid, kot_number integer) language sql volatile security invoker set search_path = ''
as $$ select * from private.tablet_fnb_order(p_seat, p_lines, p_idempotency_key); $$;

revoke execute on function private.place_fnb_order(jsonb, uuid), public.place_fnb_order(jsonb, uuid),
  private.tablet_fnb_order(integer, jsonb, uuid), public.tablet_fnb_order(integer, jsonb, uuid) from public, anon;
grant execute on function private.place_fnb_order(jsonb, uuid), public.place_fnb_order(jsonb, uuid),
  private.tablet_fnb_order(integer, jsonb, uuid), public.tablet_fnb_order(integer, jsonb, uuid) to authenticated;
