-- Console v3's Food and drink flags a KOT the bar printer did not get: "The bar printer did not get this KOT. Print it or
-- read it to the bar." The flag is the bar_printer consumer's own state in the outbox, never a clock: its last attempt
-- failed (it is retried, so the flag goes while a new attempt prints), or it was closed unprinted, too old to print. A KOT
-- handed to the bar by hand, or a void order, needs nothing, so it is never flagged. The practice venue's agent claims no
-- KOT (claim_agent_kots), so its orders have no bar_printer delivery and are never flagged.
-- As 20261103200300_order_on_its_way.sql made it, with kot_print_failed last. staff_queue_counts reads the function by
-- column name, so it needs no change.

drop function public.fnb_orders_tonight(uuid);
drop function private.fnb_orders_tonight(uuid);

create function private.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
               kot_print_failed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, g.name, o.seat, m.full_name, m.member_number, o.lines, o.is_comp, o.source, o.created_at, o.kot_sent_at, o.kot_sent_by,
         o.accepted_at, o.delivered_at, floor(extract(epoch from coalesce(o.delivered_at, o.cancelled_at, now()) - o.created_at))::integer,
         o.cancelled_at, o.cancel_reason, o.on_way_at,
         o.kot_sent_at is null and o.cancelled_at is null and exists (
           -- The order's fnb.ordered event, by its idempotency key (unique per venue), and the bar printer's delivery of it.
           select 1 from public.outbox_event e
           join public.outbox_delivery d on d.event_id = e.id and d.consumer = 'bar_printer'
           where e.venue_id = o.venue_id and e.idempotency_key = 'fnb.ordered:' || o.id
             and (d.status = 'failed' or d.status = 'delivered'))
  from public.fnb_order o
  join public.game_table g on g.id = o.table_id
  join public.member m on m.id = o.member_id
  where o.venue_id = p_venue_id and o.club_day = private.club_day_now() and private.may_serve_fnb(p_venue_id)
  order by o.kot_number desc;
$$;

create function public.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
               kot_print_failed boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_orders_tonight(p_venue_id); $$;

revoke execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) from public, anon;
grant execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) to authenticated;
