-- Food and drink orders close (decision 0302; the workflow audit of 2 Nov: "nothing can be voided by staff", "Floor and
-- Service staff can't order for a member"). Staff who serve void an order not yet delivered, with a reason the member sees;
-- a void order is neither accepted, delivered nor counted. Staff who serve may order for a member, as the dealer's tablet
-- does, when they read who sits there (the floor; Service reads no members, #640); a comp stays for staff who run F&B.
-- Orders carry no money in RIVR (the bar takes payment), so a void moves nothing; the bar's printer never prints one.

alter table public.fnb_order
  add column cancelled_at timestamptz,
  add column cancelled_by_staff_id uuid,
  add column cancel_reason text check (cancel_reason is null or length(trim(cancel_reason)) between 3 and 300),
  add constraint fnb_order_cancelled_with_reason check ((cancelled_at is null) = (cancel_reason is null)),
  add constraint fnb_order_not_cancelled_and_delivered check (cancelled_at is null or delivered_at is null),
  add constraint fnb_order_cancelled_by_staff foreign key (cancelled_by_staff_id, venue_id) references public.staff (id, venue_id);

-- A member's export (#498) lists the new columns: the void is theirs to see, with its reason.
insert into private.member_export_column (table_name, column_name, kind) values
  ('fnb_order', 'cancelled_at', 'owed'), ('fnb_order', 'cancelled_by_staff_id', 'owed'), ('fnb_order', 'cancel_reason', 'owed');

-- Staff who serve void an order not yet delivered, with a reason. Refusals: 42501 not staff who serve at its venue; 22023
-- no reason of 3 to 300 characters, or the order delivered or void already; RVFRZ the venue frozen.
create function private.cancel_fnb_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.fnb_order;
begin
  select * into v_order from public.fnb_order o where o.id = p_order_id for update;
  if v_order.id is null or not private.may_serve_fnb(v_order.venue_id) then
    raise exception 'Only staff who serve F&B void an order' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 300 then
    raise exception 'A void needs a reason of 3 to 300 characters' using errcode = '22023';
  end if;
  if v_order.delivered_at is not null or v_order.cancelled_at is not null then
    raise exception 'A delivered or void order is not voided' using errcode = '22023';
  end if;
  perform private.assert_writable(v_order.venue_id);
  update public.fnb_order
  set cancelled_at = now(), cancelled_by_staff_id = private.current_staff_id(v_order.venue_id), cancel_reason = trim(p_reason)
  where id = v_order.id;
  perform private.audit(v_order.venue_id, 'fnb_order.cancel', 'fnb_order', v_order.id::text, null, null, trim(p_reason));
end;
$$;

create function public.cancel_fnb_order(p_order_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.cancel_fnb_order(p_order_id, p_reason); $$;

revoke execute on function private.cancel_fnb_order(uuid, text), public.cancel_fnb_order(uuid, text) from public, anon;
grant execute on function private.cancel_fnb_order(uuid, text), public.cancel_fnb_order(uuid, text) to authenticated;

-- As 20261101090100_food_service.sql made it, refusing a void order.
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
     or p_step not in ('accept', 'deliver') or v_order.cancelled_at is not null then
    raise exception 'An order is accepted once, then delivered once, unless it is void' using errcode = '22023';
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

-- As 20261101140000_request_ids.sql made it, for staff who serve and read members too: a comp stays for staff who run F&B.
create or replace function private.console_fnb_order(p_venue_id uuid, p_table_id uuid, p_seat integer, p_lines jsonb, p_is_comp boolean,
                                                     p_idempotency_key uuid default null)
returns table (order_id uuid, kot_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_order_id uuid;
  v_kot integer;
begin
  if not (private.has_permission(p_venue_id, 'fnb.manage')
          or (coalesce(p_is_comp, false) = false and private.has_permission(p_venue_id, 'fnb.serve')
              and private.has_permission(p_venue_id, 'members.read'))) then
    raise exception 'Only staff who serve F&B order from the console, and only staff who run it give a comp' using errcode = '42501';
  end if;
  if p_idempotency_key is not null then
    if exists (select 1 from public.fnb_order o where o.venue_id = p_venue_id and o.idempotency_key = p_idempotency_key
               and (o.table_id is distinct from p_table_id or o.seat is distinct from p_seat or o.is_comp is distinct from p_is_comp)) then
      raise exception 'That request id was for another order' using errcode = '22023';
    end if;
    return query select o.id, o.kot_number from public.fnb_order o where o.venue_id = p_venue_id and o.idempotency_key = p_idempotency_key;
    if found then
      return;
    end if;
  end if;
  select * into v_session from public.seat_session s
  where s.venue_id = p_venue_id and s.table_id = p_table_id and s.seat = p_seat and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Nobody sits in that seat' using errcode = 'RVFNS';
  end if;
  select r.order_id, r.kot_number into v_order_id, v_kot
  from private.record_fnb_order(v_session, p_lines, p_is_comp, 'console', private.current_staff_id(p_venue_id), null) r;
  update public.fnb_order set idempotency_key = p_idempotency_key where id = v_order_id and p_idempotency_key is not null;
  return query select v_order_id, v_kot;
end;
$$;

-- As 20261101090100_food_service.sql made it, with when an order was voided and why, and its age stopping there.
drop function public.fnb_orders_tonight(uuid);
drop function private.fnb_orders_tonight(uuid);
create function private.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, g.name, o.seat, m.full_name, m.member_number, o.lines, o.is_comp, o.source, o.created_at, o.kot_sent_at, o.kot_sent_by,
         o.accepted_at, o.delivered_at, floor(extract(epoch from coalesce(o.delivered_at, o.cancelled_at, now()) - o.created_at))::integer,
         o.cancelled_at, o.cancel_reason
  from public.fnb_order o
  join public.game_table g on g.id = o.table_id
  join public.member m on m.id = o.member_id
  where o.venue_id = p_venue_id and o.club_day = private.club_day_now() and private.may_serve_fnb(p_venue_id)
  order by o.kot_number desc;
$$;
create function public.fnb_orders_tonight(p_venue_id uuid)
returns table (order_id uuid, kot_number integer, table_name text, seat integer, member_name text, member_number bigint, lines jsonb,
               is_comp boolean, source text, created_at timestamptz, kot_sent_at timestamptz, kot_sent_by text, accepted_at timestamptz,
               delivered_at timestamptz, age_seconds integer, cancelled_at timestamptz, cancel_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_orders_tonight(p_venue_id); $$;

revoke execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) from public, anon;
grant execute on function private.fnb_orders_tonight(uuid), public.fnb_orders_tonight(uuid) to authenticated;

-- As 20261029150000_fnb_order_progress.sql made it, with a void and its reason, which the member sees.
drop function public.my_fnb_orders();
drop function private.my_fnb_orders();
create function private.my_fnb_orders()
returns table (order_id uuid, kot_number integer, lines jsonb, created_at timestamptz, accepted_at timestamptz, delivered_at timestamptz,
               cancelled_at timestamptz, cancel_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.kot_number, o.lines, o.created_at, o.accepted_at, o.delivered_at, o.cancelled_at, o.cancel_reason
  from public.fnb_order o
  where o.member_id = private.current_member_id() and o.club_day = private.club_day_now()
    and private.has_feature(o.member_id, 'fnb.table_side')
  order by o.created_at desc;
$$;
create function public.my_fnb_orders()
returns table (order_id uuid, kot_number integer, lines jsonb, created_at timestamptz, accepted_at timestamptz, delivered_at timestamptz,
               cancelled_at timestamptz, cancel_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_fnb_orders(); $$;

revoke execute on function private.my_fnb_orders(), public.my_fnb_orders() from public, anon;
grant execute on function private.my_fnb_orders(), public.my_fnb_orders() to authenticated;

-- As 20261103000000_staff_queue_counts.sql made it, leaving a void order out of the food and drink count.
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
    ('liveFloor', (select count(*) from private.floor_seats(p_venue_id) s where s.leaving_at is not null)),
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

-- As 20261028391700_fnb_orders.sql made it, with a void order's KOT finished unprinted, as one handed over by hand is.
create or replace function private.claim_agent_kots(p_device_id uuid, p_limit integer)
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
      last_error = case when o.cancelled_at is not null then 'void'
                        when o.kot_sent_at is not null then 'given to the bar by hand' else 'too old to print' end
  from public.outbox_event e left join public.fnb_order o on o.id = (e.payload ->> 'order_id')::uuid
  where d.event_id = e.id and d.venue_id = v_venue_id and d.consumer = 'bar_printer'
    and (d.status in ('pending', 'failed') or (d.status = 'processing' and d.locked_until < now()))
    and (o.kot_sent_at is not null or o.cancelled_at is not null or e.occurred_at < now() - interval '2 hours');
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

-- As 20261028392600_cab_requests.sql made it, stripping a void's or a cancelled redemption's reason from an erased member's
-- audit rows too: staff wrote it about the member.
create or replace function private.strip_erased_fields(p_state jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_state) = 'object'
    then p_state - array['full_name', 'phone', 'note', 'resolution', 'reason', 'release_reason', 'lift_reason', 'proposal_reason',
                         'decline_reason', 'reject_reason', 'buyer_name', 'signature_svg', 'vendor_reference', 'digilocker_session_id',
                         'address', 'cancel_reason']
    else p_state end;
$$;

-- As 20261101090100_food_service.sql made it, refusing a void order: its KOT goes to no bar.
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
  if v_order.cancelled_at is not null then
    raise exception 'A void order''s KOT is not sent' using errcode = '22023';
  end if;
  perform private.assert_writable(v_order.venue_id);
  update public.fnb_order o set kot_sent_at = now(), kot_sent_by = 'staff', kot_sent_by_staff_id = private.current_staff_id(v_order.venue_id)
  where o.id = p_order_id and o.kot_sent_at is null;
end;
$$;

-- As 20261028391700_fnb_orders.sql made it, never stamping a void order as at the bar.
create or replace function private.finish_agent_kot(p_device_id uuid, p_delivery_id uuid, p_delivered boolean, p_error text, p_retry_after_seconds integer)
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
    update public.fnb_order o set kot_sent_at = now(), kot_sent_by = 'agent'
    where o.id = v_order_id and o.kot_sent_at is null and o.cancelled_at is null;
  end if;
end;
$$;

-- fnb_order gained columns: the practice venue's seed is taken again (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
