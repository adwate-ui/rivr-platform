-- An order on its way (brief 3.4 E and 7.3): between prepared and delivered, the bar marks the order on its way as a
-- runner leaves with it, and the member's tracker reads Sent, Preparing, On its way, Delivered (@rivr/domain orderStage:
-- placed, accepted, on its way, delivered), or that staff voided it and why (decision 0302). Delivering an order not
-- marked on its way stays allowed; a void order goes no further.

alter table public.fnb_order
  add column on_way_at timestamptz,
  add column on_way_by_staff_id uuid,
  add constraint fnb_order_on_way_staff_fkey foreign key (on_way_by_staff_id, venue_id) references public.staff (id, venue_id),
  add constraint fnb_order_on_way_check check (on_way_at is null or accepted_at is not null);
comment on column public.fnb_order.on_way_at is 'When a runner left the bar with the order (decision 0320).';
create index fnb_order_on_way_by_idx on public.fnb_order (on_way_by_staff_id, venue_id);
insert into private.member_export_column (table_name, column_name, kind)
values ('fnb_order', 'on_way_at', 'owed'), ('fnb_order', 'on_way_by_staff_id', 'owed');

-- As 20261103010100_fnb_orders_void_and_serve.sql made it, with the step between: accepted, then on its way, then
-- delivered; a void order takes none of them.
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
     or (p_step = 'on_way' and (v_order.accepted_at is null or v_order.on_way_at is not null or v_order.delivered_at is not null))
     or (p_step = 'deliver' and (v_order.accepted_at is null or v_order.delivered_at is not null))
     or p_step not in ('accept', 'on_way', 'deliver') or v_order.cancelled_at is not null then
    raise exception 'An order is accepted once, sent on its way once, then delivered once, unless it is void' using errcode = '22023';
  end if;
  perform private.assert_writable(v_order.venue_id);
  v_staff_id := private.current_staff_id(v_order.venue_id);
  if p_step = 'accept' then
    update public.fnb_order set accepted_at = now(), accepted_by_staff_id = v_staff_id where id = v_order.id;
  elsif p_step = 'on_way' then
    update public.fnb_order set on_way_at = now(), on_way_by_staff_id = v_staff_id where id = v_order.id;
  else
    update public.fnb_order set delivered_at = now(), delivered_by_staff_id = v_staff_id where id = v_order.id;
  end if;
end;
$$;

create function public.send_fnb_order_on_way(p_order_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.advance_fnb_order(p_order_id, 'on_way'); $$;
revoke execute on function public.send_fnb_order_on_way(uuid) from public, anon;
grant execute on function public.send_fnb_order_on_way(uuid) to authenticated;

-- As 20261103010100_fnb_orders_void_and_serve.sql made it, with when the order left the bar.
drop function public.my_fnb_orders();
drop function private.my_fnb_orders();
create function private.my_fnb_orders()
returns table (order_id uuid, kot_number integer, lines jsonb, created_at timestamptz, accepted_at timestamptz, delivered_at timestamptz,
               cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, o.lines, o.created_at, o.accepted_at, o.delivered_at, o.cancelled_at, o.cancel_reason, o.on_way_at
  from public.fnb_order o
  where o.member_id = private.current_member_id() and o.club_day = private.club_day_now()
    and private.has_feature(o.member_id, 'fnb.table_side')
  order by o.created_at desc;
$$;
create function public.my_fnb_orders()
returns table (order_id uuid, kot_number integer, lines jsonb, created_at timestamptz, accepted_at timestamptz, delivered_at timestamptz,
               cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_fnb_orders(); $$;
revoke execute on function private.my_fnb_orders(), public.my_fnb_orders() from public, anon;
grant execute on function private.my_fnb_orders(), public.my_fnb_orders() to authenticated;

-- As 20261103010100_fnb_orders_void_and_serve.sql made it, with when the order left the bar, for the bar's own list.
drop function public.fnb_orders_tonight(uuid);
drop function private.fnb_orders_tonight(uuid);
create function private.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, g.name, o.seat, m.full_name, m.member_number, o.lines, o.is_comp, o.source, o.created_at, o.kot_sent_at, o.kot_sent_by,
         o.accepted_at, o.delivered_at, floor(extract(epoch from coalesce(o.delivered_at, o.cancelled_at, now()) - o.created_at))::integer,
         o.cancelled_at, o.cancel_reason, o.on_way_at
  from public.fnb_order o
  join public.game_table g on g.id = o.table_id
  join public.member m on m.id = o.member_id
  where o.venue_id = p_venue_id and o.club_day = private.club_day_now() and private.may_serve_fnb(p_venue_id)
  order by o.kot_number desc;
$$;
create function public.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text, on_way_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_orders_tonight(p_venue_id); $$;
revoke execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) from public, anon;
grant execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) to authenticated;

-- As 20261103010100_fnb_orders_void_and_serve.sql made it, against fnb_orders_tonight as made again above: an order on its
-- way is not delivered yet, so it still counts; a void one does not. The live floor also counts a seat whose member asked
-- for more call time (20261103200200), so the rail and its chime tell the floor as they do for the Leaving list.
create or replace function private.staff_queue_counts(p_venue_id uuid)
returns table (queue text, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select q.queue, q.waiting::integer
  from (values
    ('waitlist', (select count(*) from private.waitlist_requests(p_venue_id))),
    ('topUps', (select count(*) from private.top_ups_tonight(p_venue_id) t where t.status in ('requested', 'in_progress'))),
    ('fnb', (select count(*) from private.fnb_orders_tonight(p_venue_id) o where o.delivered_at is null and o.cancelled_at is null)),
    ('liveFloor', (select count(*) from private.floor_seats(p_venue_id) s where s.leaving_at is not null or s.time_request_id is not null)),
    ('kycReview', (select count(*) from private.kyc_review_queue(p_venue_id) k where k.status = 'needs_review')),
    ('rewards', (select count(*) from private.venue_redemptions(p_venue_id) r where r.handed_over_at is null)),
    ('feedback', (select count(*) from private.venue_feedback(p_venue_id) f where f.is_ticket and f.resolved_at is null)),
    -- Waiting for an approver: a marketer who asked sees the list, but only a super admin decides.
    ('promotions', (select count(*) from private.promotions_awaiting_approval(p_venue_id)
                    where private.has_permission(p_venue_id, 'promotions.approve'))),
    -- Calls not yet made: a call logged without an offer stays open, handled.
    ('hostQueue', (select count(*) from private.host_queue(p_venue_id) h where h.status = 'open' and h.handled_at is null)),
    ('tournamentInterest', (select count(*) from private.tournament_interest_list(p_venue_id) i where i.registered_at is null))
  ) as q (queue, waiting)
  where q.waiting > 0;
$$;

-- The practice venue's seed keeps the new columns (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
