-- The outbox's silent-consumer check names a consumer that took an event type at the venue in the last 90 days and has
-- not taken a newer one. The bar printer took every fnb.ordered event until the cage agent went
-- (20261120500100_cage_agent_removed.sql), so for 90 days after it the check would name bar_printer on each new order
-- (#1019). It is left out; otherwise the check is as the database had it.
CREATE OR REPLACE FUNCTION private.check_silent_consumers()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue record;
  v_consumers text[];
  v_alerted integer := 0;
begin
  for v_venue in
    select v.id, coalesce((private.setting_at(v.id, 'alert.thresholds', '', now()) ->> 'window_minutes')::integer, 60) as window_minutes
    from public.venue v
    where not v.is_practice
  loop
    with taken as (
      select distinct d.consumer, e.event_type
      from public.outbox_delivery d
      join public.outbox_event e on e.id = d.event_id
      where d.venue_id = v_venue.id and d.created_at > now() - interval '90 days' and e.event_type <> 'alert.raised'
        and d.consumer <> 'bar_printer'
    )
    select array_agg(distinct t.consumer order by t.consumer) into v_consumers
    from taken t
    join public.outbox_event e on e.event_type = t.event_type and e.venue_id = v_venue.id
      and e.occurred_at between now() - interval '30 minutes' and now() - interval '10 minutes'
    where not exists (select 1 from public.outbox_delivery d where d.event_id = e.id and d.consumer = t.consumer);
    if v_consumers is not null
       and not exists (select 1 from public.alert a where a.venue_id = v_venue.id and a.kind = 'outbox.silent'
                         and a.raised_at > now() - make_interval(mins => v_venue.window_minutes)) then
      perform private.raise_alert(v_venue.id, 'outbox.silent', jsonb_build_object('consumers', to_jsonb(v_consumers)));
      v_alerted := v_alerted + 1;
    end if;
  end loop;
  return v_alerted;
end;
$function$;
