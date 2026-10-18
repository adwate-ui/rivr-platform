-- The outbox dispatcher's database side (#12; tech plan, "One event outbox"). Consumers retry a
-- failed delivery with backoff, ten attempts in all; a delivery that fails its tenth raises an alert.
-- private.raise_alert and the alert table are lane A's (lane A contract); this is their first cut,
-- which lane A's alerting task extends with the owner dashboard and the alert WhatsApp number.

create table public.alert (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  kind text not null check (kind ~ '^[a-z_]+(\.[a-z_]+)*$'),
  -- What happened, for the owner dashboard. Never personal data.
  detail jsonb not null default '{}',
  raised_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((acknowledged_at is null) = (acknowledged_by_staff_id is null))
);

comment on table public.alert is 'Alerts for the owner dashboard and the alert WhatsApp number (lane A).';

create index alert_venue_id_raised_at_idx on public.alert (venue_id, raised_at desc);
create index alert_acknowledged_by_staff_id_idx on public.alert (acknowledged_by_staff_id);
create trigger alert_touch_updated_at before update on public.alert
  for each row execute function private.touch_updated_at();
create trigger alert_audit after insert or update or delete on public.alert
  for each row execute function private.audit_row_change();

alter table public.alert enable row level security;
grant select on public.alert to authenticated;

create policy "dashboard staff see the venue's alerts" on public.alert
  for select to authenticated
  using (venue_id in (select private.venues_where('dashboards.read')));

-- Raises an alert: a row for the owner dashboard, and alert.raised for the WhatsApp consumer.
create function private.raise_alert(p_venue_id uuid, p_kind text, p_detail jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_id uuid;
begin
  insert into public.alert (venue_id, kind, detail) values (p_venue_id, p_kind, coalesce(p_detail, '{}'))
  returning id into v_alert_id;
  perform private.emit(p_venue_id, 'alert.raised', jsonb_build_object('alert_id', v_alert_id, 'kind', p_kind),
                       'alert.raised:' || v_alert_id);
  return v_alert_id;
end;
$$;

grant execute on function private.raise_alert(uuid, text, jsonb) to service_role;

-- A delivery that will not be tried again: alert the owner, unless it was itself an alert's
-- delivery, which would only raise another alert to be delivered the same way.
create function private.alert_failed_delivery(p_delivery_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.raise_alert(d.venue_id, 'outbox.delivery_failed', jsonb_build_object(
    'delivery_id', d.id, 'consumer', d.consumer, 'event_type', e.event_type, 'attempts', d.attempts,
    'error', left(coalesce(d.last_error, ''), 500)))
  from public.outbox_delivery d join public.outbox_event e on e.id = d.event_id
  where d.id = p_delivery_id and e.event_type <> 'alert.raised';
$$;

-- Marks a claimed delivery done, or failed and due again after p_retry_after. A failure on the tenth
-- and last attempt alerts the owner.
create or replace function public.finish_outbox_delivery(
  p_delivery_id uuid,
  p_delivered boolean,
  p_error text default null,
  p_retry_after interval default interval '5 minutes'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  update public.outbox_delivery d
  set status = case when p_delivered then 'delivered'::public.outbox_status else 'failed'::public.outbox_status end,
      delivered_at = case when p_delivered then now() end,
      last_error = case when p_delivered then null else p_error end,
      available_at = case when p_delivered then d.available_at else now() + p_retry_after end,
      locked_until = null
  where d.id = p_delivery_id and d.status = 'processing'
  returning d.attempts into v_attempts;
  if not p_delivered and v_attempts >= 10 then
    perform private.alert_failed_delivery(p_delivery_id);
  end if;
end;
$$;

-- As before (20261018090800_outbox.sql), and a consumer that died on its last attempt now alerts the
-- owner too, as a failure finished on the last attempt does.
create or replace function public.claim_outbox_deliveries(
  p_consumer text,
  p_event_types text[],
  p_is_messaging boolean default true,
  p_limit integer default 20
)
returns table (delivery_id uuid, event_id uuid, venue_id uuid, event_type text, payload jsonb, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
-- The result columns share names with table columns; inside SQL, mean the columns.
#variable_conflict use_column
declare
  v_dead_id uuid;
begin
  insert into public.outbox_delivery (venue_id, event_id, consumer)
  select e.venue_id, e.id, p_consumer
  from public.outbox_event e
  join public.venue v on v.id = e.venue_id and not v.is_practice
  -- A consumer added later does not replay months-old events (and the scan stays small).
  where e.event_type = any (p_event_types) and e.occurred_at > now() - interval '30 days'
  on conflict (event_id, consumer) do nothing;

  -- A consumer that died on the last allowed attempt left its delivery processing: mark it failed
  -- and alert the owner, instead of it waiting for good.
  for v_dead_id in
    update public.outbox_delivery d
    set status = 'failed', locked_until = null,
        last_error = coalesce(d.last_error, 'the consumer stopped during its last attempt')
    where d.consumer = p_consumer and d.status = 'processing' and d.attempts >= 10 and d.locked_until < now()
    returning d.id
  loop
    perform private.alert_failed_delivery(v_dead_id);
  end loop;

  return query
  with ready as (
    select d.id from public.outbox_delivery d
    join public.venue v on v.id = d.venue_id and not v.is_practice
    where d.consumer = p_consumer
      and (d.status in ('pending', 'failed') or (d.status = 'processing' and d.locked_until < now()))
      and d.attempts < 10
      and d.available_at <= now() and (d.locked_until is null or d.locked_until < now())
      and not (p_is_messaging and private.is_messaging_stopped(d.venue_id))
    order by d.available_at
    limit p_limit
    for update of d skip locked
  )
  update public.outbox_delivery d
  set status = 'processing', attempts = d.attempts + 1, locked_until = now() + interval '5 minutes'
  from ready, public.outbox_event e
  where d.id = ready.id and e.id = d.event_id
  returning d.id, e.id, e.venue_id, e.event_type, e.payload, d.attempts;
end;
$$;
