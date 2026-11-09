-- A ticket knows the guest is leaving (audit F-085): the bar's list says whether the guest it goes to is still in that seat,
-- has asked to go, or has gone, so the runner can deliver at the door or void it.
-- As 20261107400000_kot_print_failed.sql made it, with seat_state last. staff_queue_counts reads the function by column
-- name, so it needs no change.

drop function public.fnb_orders_tonight(uuid);
drop function private.fnb_orders_tonight(uuid);

create function private.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
               kot_print_failed boolean, seat_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, g.name, o.seat, m.full_name, m.member_number, o.lines, o.is_comp, o.source, o.created_at, o.kot_sent_at, o.kot_sent_by,
         o.accepted_at, o.delivered_at, floor(extract(epoch from coalesce(o.delivered_at, o.cancelled_at, now()) - o.created_at))::integer,
         o.cancelled_at, o.cancel_reason, o.on_way_at,
         o.kot_sent_at is null and o.cancelled_at is null and o.accepted_at is null and o.delivered_at is null and exists (
           -- The order's fnb.ordered event, by its idempotency key (unique per venue), and the bar printer's delivery of it.
           select 1 from public.outbox_event e
           join public.outbox_delivery d on d.event_id = e.id and d.venue_id = e.venue_id and d.consumer = 'bar_printer'
           where e.venue_id = o.venue_id and e.event_type = 'fnb.ordered' and e.idempotency_key = 'fnb.ordered:' || o.id
             and (d.status = 'failed' or d.status = 'delivered')),
         -- Whether the guest it goes to is still at the club's tables: their open session, asked to leave or not. Wherever it
         -- is now, as a move to another seat or table updates that session and the order does not follow it.
         coalesce((select case when s.leaving_at is null then 'seated' else 'leaving' end
                   from public.seat_session s
                   where s.venue_id = o.venue_id and s.member_id = o.member_id and s.ended_at is null), 'left')
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
               kot_print_failed boolean, seat_state text)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_orders_tonight(p_venue_id); $$;

revoke execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) from public, anon;
grant execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) to authenticated;
