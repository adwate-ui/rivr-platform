-- Food and drink's orders name the member each goes to (owner, 19 Nov: every member's name in the console opens their
-- account): `member_id` at the end of fnb_orders_page, none for an erased member. It is read from the order itself, so the list's source in
-- private.list_spec, which every console list shares, stays as it is. Both functions are their live definitions with
-- that column added; the grants are as they were.

drop function public.fnb_orders_page(uuid, jsonb);
drop function private.fnb_orders_page(uuid, jsonb);

create function private.fnb_orders_page(p_venue_id uuid, p_view jsonb)
returns table (total bigint, order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
               seat_state text, state text, member_id uuid)
language sql stable security definer set search_path = ''
as $$
  with page as materialized (select private.list_json('fnb_orders', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.order_id, r.kot_number, r.table_name, r.seat, r.member_name, r.member_number, r.lines, r.is_comp, r.source,
         r.created_at, r.kot_sent_at, r.kot_sent_by, r.accepted_at, r.delivered_at, r.age_seconds, r.cancelled_at, r.cancel_reason, r.on_way_at,
         r.seat_state, r.state,
         (select o.member_id from public.fnb_order o join public.member m on m.id = o.member_id
          where o.id = r.order_id and o.venue_id = p_venue_id and m.erased_at is null)
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
    is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
    delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
    seat_state text, state text)
  order by r.list_place;
$$;

create function public.fnb_orders_page(p_venue_id uuid, p_view jsonb default '{}'::jsonb)
returns table (total bigint, order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz,
               seat_state text, state text, member_id uuid)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_orders_page(p_venue_id, p_view); $$;

revoke execute on function private.fnb_orders_page(uuid, jsonb), public.fnb_orders_page(uuid, jsonb) from public, anon;
grant execute on function private.fnb_orders_page(uuid, jsonb), public.fnb_orders_page(uuid, jsonb) to authenticated;
