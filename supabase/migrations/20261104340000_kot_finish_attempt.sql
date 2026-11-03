-- The cage agent's KOTs finish only the claim they hold (#691), as every Edge Function consumer's deliveries do since
-- 20261101230000_outbox_finishes_its_own_claim.sql: finish_agent_kot takes the attempt the agent claimed and hands it to
-- finish_outbox_delivery, so a finish from a claim whose lease ran out, while another agent claimed the KOT again,
-- changes nothing. An agent installed before this sends no attempt, and its finish goes through as before.
-- As 20261103010100_fnb_orders_void_and_serve.sql, with p_attempts last.

drop function public.finish_agent_kot(uuid, uuid, boolean, text, integer);
drop function private.finish_agent_kot(uuid, uuid, boolean, text, integer);

create function private.finish_agent_kot(p_device_id uuid, p_delivery_id uuid, p_delivered boolean, p_error text,
                                         p_retry_after_seconds integer, p_attempts integer default null)
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
    case when p_retry_after_seconds is null then null else make_interval(secs => p_retry_after_seconds) end, p_attempts);
  if p_delivered then
    update public.fnb_order o set kot_sent_at = now(), kot_sent_by = 'agent'
    where o.id = v_order_id and o.kot_sent_at is null and o.cancelled_at is null;
  end if;
end;
$$;

create function public.finish_agent_kot(p_device_id uuid, p_delivery_id uuid, p_delivered boolean, p_error text,
                                        p_retry_after_seconds integer, p_attempts integer default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.finish_agent_kot(p_device_id, p_delivery_id, p_delivered, p_error, p_retry_after_seconds, p_attempts); $$;

revoke execute on function private.finish_agent_kot(uuid, uuid, boolean, text, integer, integer),
  public.finish_agent_kot(uuid, uuid, boolean, text, integer, integer)
  from public, anon, authenticated;
grant execute on function private.finish_agent_kot(uuid, uuid, boolean, text, integer, integer),
  public.finish_agent_kot(uuid, uuid, boolean, text, integer, integer)
  to service_role;
