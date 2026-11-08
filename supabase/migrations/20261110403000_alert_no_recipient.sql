-- An owner alert for a venue with no alert number went nowhere and was marked delivered (audit F-212). It is now recorded
-- as no_recipient: finished, not a failure, and never sent.

alter type public.outbox_status add value if not exists 'no_recipient';

drop function public.finish_outbox_delivery(uuid, boolean, text, interval, integer);

CREATE FUNCTION public.finish_outbox_delivery(p_delivery_id uuid, p_delivered boolean, p_error text DEFAULT NULL::text, p_retry_after interval DEFAULT '00:05:00'::interval, p_attempts integer DEFAULT NULL::integer, p_no_recipient boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_attempts integer;
begin
  update public.outbox_delivery d
  set status = case when p_no_recipient then 'no_recipient'::public.outbox_status when p_delivered then 'delivered'::public.outbox_status else 'failed'::public.outbox_status end,
      delivered_at = case when p_delivered and not p_no_recipient then now() end,
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
$function$;

revoke execute on function public.finish_outbox_delivery(uuid, boolean, text, interval, integer, boolean) from public, anon, authenticated, service_role;
grant execute on function public.finish_outbox_delivery(uuid, boolean, text, interval, integer, boolean) to service_role;
