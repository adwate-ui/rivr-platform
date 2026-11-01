-- Food service (#640; owner's feedback doc of 29 Oct). The Service role sets up the menu and serves the orders: each one
-- waiting with its table, seat and the time since it was placed, accepted, then delivered, and the delivered ones listed.
-- The floor and the super admin see each table's orders with their status and how long each took to deliver.
-- Service holds fnb.serve, not fnb.manage: the menu, tonight's orders, accepting, delivering and handing a KOT to the bar,
-- but never a comp, nor Glaza's statement and its money, which stay with fnb.manage.

insert into public.role_permission (role, permission)
select 'service', permission from unnest(array['sops.acknowledge', 'incidents.log', 'fnb.serve']) as permission;
insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['fnb.serve']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['fnb.serve']) as permission;

-- Whether the signed-in staff member serves food and drink at the venue: those who run it (fnb.manage) or serve it (fnb.serve).
create function private.may_serve_fnb(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.has_permission(p_venue_id, 'fnb.manage'), false) or coalesce(private.has_permission(p_venue_id, 'fnb.serve'), false);
$$;
revoke execute on function private.may_serve_fnb(uuid) from public, anon;
grant execute on function private.may_serve_fnb(uuid) to authenticated;

drop policy "staff who run F&B see the venue's menu" on public.fnb_item;
create policy "staff who run or serve F&B see the venue's menu" on public.fnb_item
  for select to authenticated using (venue_id in (select private.venues_where('fnb.manage')) or venue_id in (select private.venues_where('fnb.serve')));
drop policy "staff who run F&B see the venue's orders" on public.fnb_order;
create policy "staff who run or serve F&B see the venue's orders" on public.fnb_order
  for select to authenticated using (venue_id in (select private.venues_where('fnb.manage')) or venue_id in (select private.venues_where('fnb.serve')));

-- As in 20261028391600_fnb_items.sql, for staff who serve too.
create or replace function private.save_fnb_item(p_venue_id uuid, p_name text, p_kind public.fnb_item_kind, p_is_available boolean, p_position integer,
                                                 p_item_id uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.may_serve_fnb(p_venue_id) then
    raise exception 'Only staff who run F&B change the menu' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if p_item_id is null then
    insert into public.fnb_item (venue_id, name, kind, is_available, position)
    values (p_venue_id, trim(p_name), p_kind, coalesce(p_is_available, true), coalesce(p_position, 1))
    returning id into v_id;
  else
    update public.fnb_item i set name = trim(p_name), kind = p_kind, is_available = coalesce(p_is_available, i.is_available),
                                 position = coalesce(p_position, i.position)
    where i.id = p_item_id and i.venue_id = p_venue_id
    returning id into v_id;
    if v_id is null then
      raise exception 'No such item at this venue' using errcode = '22023';
    end if;
  end if;
  return v_id;
end;
$$;

-- As in 20261028391700_fnb_orders.sql, for staff who serve too.
create or replace function private.mark_kot_sent(p_order_id uuid)
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
  if v_order.id is null or not private.may_serve_fnb(v_order.venue_id) then
    raise exception 'Only staff who run F&B send a KOT' using errcode = '42501';
  end if;
  perform private.assert_writable(v_order.venue_id);
  update public.fnb_order o set kot_sent_at = now(), kot_sent_by = 'staff', kot_sent_by_staff_id = private.current_staff_id(v_order.venue_id)
  where o.id = p_order_id and o.kot_sent_at is null;
end;
$$;

-- As in 20261029150000_fnb_order_progress.sql, for staff who serve too.
create or replace function private.advance_fnb_order(p_order_id uuid, p_step text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.fnb_order;
  v_staff_id uuid;
begin
  select * into v_order from public.fnb_order o where o.id = p_order_id for update;
  if v_order.id is null or not private.may_serve_fnb(v_order.venue_id) then
    raise exception 'Only staff who run F&B accept and deliver orders' using errcode = '42501';
  end if;
  if (p_step = 'accept' and v_order.accepted_at is not null)
     or (p_step = 'deliver' and (v_order.accepted_at is null or v_order.delivered_at is not null))
     or p_step not in ('accept', 'deliver') then
    raise exception 'An order is accepted once, then delivered once' using errcode = '22023';
  end if;
  perform private.assert_writable(v_order.venue_id);
  v_staff_id := private.current_staff_id(v_order.venue_id);
  if p_step = 'accept' then
    update public.fnb_order set accepted_at = now(), accepted_by_staff_id = v_staff_id where id = v_order.id;
  else
    update public.fnb_order set delivered_at = now(), delivered_by_staff_id = v_staff_id where id = v_order.id;
  end if;
end;
$$;

-- As in 20261028391700_fnb_orders.sql, for staff who serve too, with when each order was accepted and delivered, and its age
-- in whole seconds: from placed to now while it is not delivered, then to its delivery.
drop function public.fnb_orders_tonight(uuid);
drop function private.fnb_orders_tonight(uuid);
create function private.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, g.name, o.seat, m.full_name, m.member_number, o.lines, o.is_comp, o.source, o.created_at, o.kot_sent_at, o.kot_sent_by,
         o.accepted_at, o.delivered_at, floor(extract(epoch from coalesce(o.delivered_at, now()) - o.created_at))::integer
  from public.fnb_order o
  join public.game_table g on g.id = o.table_id
  join public.member m on m.id = o.member_id
  where o.venue_id = p_venue_id and o.club_day = private.club_day_now() and private.may_serve_fnb(p_venue_id)
  order by o.kot_number desc;
$$;
create function public.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_orders_tonight(p_venue_id); $$;

revoke execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) from public, anon;
grant execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) to authenticated;
