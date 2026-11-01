-- A consumer finishes only the claim it holds (audit A5-13, 1 Nov). finish_outbox_delivery checked only that a delivery
-- was processing, so a consumer that held its batch past the five-minute lock, while the next run claimed the same rows
-- again, finished the newer claim's delivery: a late failure made it due again while it was being sent, and it went out
-- twice. It now takes the attempt the consumer claimed, and finishes the delivery only while that is still its attempt.
-- The cage agent's KOTs (finish_agent_kot) call it without one, and finish as before.
-- As 20261018091900_outbox_dispatch.sql, with p_attempts last, so that positional call still resolves.

drop function public.finish_outbox_delivery(uuid, boolean, text, interval);

create function public.finish_outbox_delivery(
  p_delivery_id uuid,
  p_delivered boolean,
  p_error text default null,
  p_retry_after interval default interval '5 minutes',
  p_attempts integer default null
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
      available_at = case when p_delivered or p_retry_after is null then d.available_at else now() + p_retry_after end,
      attempts = case when not p_delivered and p_retry_after is null then greatest(d.attempts, 10) else d.attempts end,
      locked_until = null
  where d.id = p_delivery_id and d.status = 'processing' and (p_attempts is null or d.attempts = p_attempts)
  returning d.attempts into v_attempts;
  if not p_delivered and v_attempts >= 10 then
    perform private.alert_failed_delivery(p_delivery_id);
  end if;
end;
$$;

grant execute on function public.finish_outbox_delivery(uuid, boolean, text, interval, integer) to service_role;
