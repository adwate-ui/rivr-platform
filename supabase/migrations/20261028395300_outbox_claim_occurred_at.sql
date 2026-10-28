-- A consumer can tell how old an event is (#593). The claim also returns the event's occurred_at, so the push consumer
-- finishes unsent a push older than its kind's useful life, instead of sending it late after a backfill (when the VAPID
-- key is first set, or a messaging stop is lifted). Otherwise as in 20261018091900_outbox_dispatch.sql. A new result
-- column changes the function's type, so it is dropped and made again.
drop function public.claim_outbox_deliveries(text, text[], boolean, integer);

create function public.claim_outbox_deliveries(
  p_consumer text,
  p_event_types text[],
  p_is_messaging boolean default true,
  p_limit integer default 20
)
returns table (delivery_id uuid, event_id uuid, venue_id uuid, event_type text, payload jsonb, attempts integer,
               occurred_at timestamptz)
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
  returning d.id, e.id, e.venue_id, e.event_type, e.payload, d.attempts, e.occurred_at;
end;
$$;

grant execute on function public.claim_outbox_deliveries(text, text[], boolean, integer) to service_role;
