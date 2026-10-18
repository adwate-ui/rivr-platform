-- The event outbox (docs/engineering/stack.md, architecture rule 7). A business event writes one
-- outbox_event row in the same transaction as the change; consumers (WhatsApp, social publishing,
-- winner cards, Meta Conversions API, feedback, review requests, Tally) run as Edge Functions that
-- claim deliveries here. Nothing calls an external service inline.
-- The practice venue is excluded from every consumer in one place: claim_outbox_deliveries().

create table public.outbox_event (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  event_type text not null check (event_type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  payload jsonb not null default '{}',
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, idempotency_key)
);

create index outbox_event_type_idx on public.outbox_event (event_type, occurred_at);

create type public.outbox_status as enum ('pending', 'processing', 'delivered', 'failed');

-- One consumer's progress on one event.
create table public.outbox_delivery (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  event_id uuid not null references public.outbox_event (id) on delete cascade,
  consumer text not null check (consumer ~ '^[a-z_]+$'),
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, consumer)
);

create index outbox_delivery_ready_idx on public.outbox_delivery (consumer, status, available_at);
create index outbox_delivery_venue_id_idx on public.outbox_delivery (venue_id);
create trigger outbox_delivery_touch_updated_at before update on public.outbox_delivery
  for each row execute function private.touch_updated_at();
create trigger outbox_event_immutable before update on public.outbox_event
  for each row execute function private.refuse_change();

-- Records a business event. Call it inside the write function, in the same transaction.
-- With an idempotency key, emitting the same event twice records it once.
create function private.emit(
  p_venue_id uuid,
  p_event_type text,
  p_payload jsonb default '{}',
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  insert into public.outbox_event (venue_id, event_type, payload, idempotency_key)
  values (p_venue_id, p_event_type, p_payload, p_idempotency_key)
  on conflict (venue_id, idempotency_key) do nothing
  returning id into event_id;
  if event_id is null then
    select e.id into event_id from public.outbox_event e
    where e.venue_id = p_venue_id and e.idempotency_key = p_idempotency_key;
  end if;
  return event_id;
end;
$$;

grant execute on function private.emit(uuid, text, jsonb, text) to service_role;

-- A consumer's next batch, locked for five minutes. Practice-venue events are never offered to any
-- consumer, and messaging consumers hold while a messaging stop is engaged. Service role only.
-- p_is_messaging defaults to true so a consumer that forgets it holds rather than sends; only
-- consumers that send nothing to people (Tally, Meta Conversions API) pass false.
-- A delivery whose consumer died mid-batch is offered again once its lock expires.
create function public.claim_outbox_deliveries(
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
begin
  insert into public.outbox_delivery (venue_id, event_id, consumer)
  select e.venue_id, e.id, p_consumer
  from public.outbox_event e
  join public.venue v on v.id = e.venue_id and not v.is_practice
  -- A consumer added later does not replay months-old events (and the scan stays small).
  where e.event_type = any (p_event_types) and e.occurred_at > now() - interval '30 days'
  on conflict (event_id, consumer) do nothing;

  -- A consumer that died on the last allowed attempt left its delivery processing. Mark it failed
  -- so the alert on failed deliveries (lane A) sees it instead of it waiting for good.
  update public.outbox_delivery d
  set status = 'failed', locked_until = null,
      last_error = coalesce(d.last_error, 'the consumer stopped during its last attempt')
  where d.consumer = p_consumer and d.status = 'processing' and d.attempts >= 10 and d.locked_until < now();

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

-- Marks a claimed delivery done, or failed and due again after p_retry_after.
create function public.finish_outbox_delivery(
  p_delivery_id uuid,
  p_delivered boolean,
  p_error text default null,
  p_retry_after interval default interval '5 minutes'
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outbox_delivery d
  set status = case when p_delivered then 'delivered'::public.outbox_status else 'failed'::public.outbox_status end,
      delivered_at = case when p_delivered then now() end,
      last_error = case when p_delivered then null else p_error end,
      available_at = case when p_delivered then d.available_at else now() + p_retry_after end,
      locked_until = null
  where d.id = p_delivery_id and d.status = 'processing';
$$;

grant execute on function public.claim_outbox_deliveries(text, text[], boolean, integer),
  public.finish_outbox_delivery(uuid, boolean, text, interval) to service_role;

alter table public.outbox_event enable row level security;
alter table public.outbox_delivery enable row level security;
grant select on public.outbox_event, public.outbox_delivery to authenticated;

-- The owner dashboard alerts on failed deliveries (lane A); reports staff can see the queue.
create policy "reports staff see the venue's events" on public.outbox_event
  for select to authenticated
  using (venue_id in (select private.venues_where('reports.read')));

create policy "reports staff see the venue's deliveries" on public.outbox_delivery
  for select to authenticated
  using (venue_id in (select private.venues_where('reports.read')));
