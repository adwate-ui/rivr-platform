-- An order's way to the seat (owner, 29 Oct, #635): placed, then accepted by the service staff, who prepare it (in
-- progress), then delivered. The member follows tonight's orders on the Menu tab. The service staff's screen that
-- accepts and delivers is #640; staff who run F&B (fnb.manage) accept and deliver here.

alter table public.fnb_order
  add column accepted_at timestamptz,
  add column accepted_by_staff_id uuid,
  add column delivered_at timestamptz,
  add column delivered_by_staff_id uuid,
  add constraint fnb_order_accepted_by_fkey foreign key (accepted_by_staff_id, venue_id) references public.staff (id, venue_id),
  add constraint fnb_order_delivered_by_fkey foreign key (delivered_by_staff_id, venue_id) references public.staff (id, venue_id),
  add constraint fnb_order_progress_check check (
    (accepted_at is null) = (accepted_by_staff_id is null) and (delivered_at is null) = (delivered_by_staff_id is null)
    and (delivered_at is null or accepted_at is not null)
  );

comment on column public.fnb_order.accepted_at is 'When the service staff accepted the order and began it (#635); null while placed.';
comment on column public.fnb_order.delivered_at is 'When the order reached the seat (#635); null until then.';

grant select (accepted_at, accepted_by_staff_id, delivered_at, delivered_by_staff_id) on public.fnb_order to authenticated;

-- A member's export (#498) lists every column: an order's progress is theirs.
insert into private.member_export_column (table_name, column_name, kind) values
  ('fnb_order', 'accepted_at', 'owed'), ('fnb_order', 'accepted_by_staff_id', 'owed'),
  ('fnb_order', 'delivered_at', 'owed'), ('fnb_order', 'delivered_by_staff_id', 'owed');

-- The signed-in member's orders tonight, newest first: the KOT, what, when, and where each is.
create function private.my_fnb_orders()
returns table (order_id uuid, kot_number integer, lines jsonb, created_at timestamptz, accepted_at timestamptz, delivered_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, o.lines, o.created_at, o.accepted_at, o.delivered_at
  from public.fnb_order o
  where o.member_id = private.current_member_id() and o.club_day = private.club_day_now()
    and private.has_feature(o.member_id, 'fnb.table_side')
  order by o.created_at desc;
$$;

-- Staff who run F&B accept a placed order, then deliver it. Refusals: 42501 not fnb.manage at the order's venue;
-- 22023 accepted already, or delivered before it was accepted, or delivered already; RVFRZ the venue frozen.
create function private.advance_fnb_order(p_order_id uuid, p_step text)
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
  if v_order.id is null or not private.has_permission(v_order.venue_id, 'fnb.manage') then
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

create function public.my_fnb_orders()
returns table (order_id uuid, kot_number integer, lines jsonb, created_at timestamptz, accepted_at timestamptz, delivered_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_fnb_orders(); $$;
create function public.accept_fnb_order(p_order_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.advance_fnb_order(p_order_id, 'accept'); $$;
create function public.deliver_fnb_order(p_order_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.advance_fnb_order(p_order_id, 'deliver'); $$;

revoke execute on function private.my_fnb_orders(), private.advance_fnb_order(uuid, text), public.my_fnb_orders(),
  public.accept_fnb_order(uuid), public.deliver_fnb_order(uuid) from public, anon;
grant execute on function private.my_fnb_orders(), private.advance_fnb_order(uuid, text), public.my_fnb_orders(),
  public.accept_fnb_order(uuid), public.deliver_fnb_order(uuid) to authenticated;
