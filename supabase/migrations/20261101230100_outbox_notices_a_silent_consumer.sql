-- A consumer that stops claiming is noticed (audit A5-12, 1 Nov). Delivery rows are made only when a consumer claims, so
-- a consumer that went down, or a scheduler whose Vault secrets were taken away (run_outbox_consumer then quietly returns
-- null), made no rows, and check_outbox_failures saw nothing. Every five minutes, for each venue but the practice one: an
-- event of a type a consumer has claimed at that venue in the last 90 days, which happened 10 to 30 minutes ago and which
-- that consumer has not claimed, raises outbox.silent naming the consumers, once an alert window (alert.thresholds, 60
-- minutes unless set). Consumers run every minute, so ten minutes is ample. A type no consumer takes, such as eod.closed,
-- never raises it; nor does the alert consumer's own alert.raised, as check_outbox_failures leaves it out. A consumer
-- that has never claimed at a venue, as on a project whose Vault never had the secrets, is not known, so it raises
-- nothing: the release runbook's Vault step is what covers that.

create function private.check_silent_consumers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function private.check_silent_consumers() from public, anon, authenticated;

select cron.schedule('outbox-silent', '*/5 * * * *', 'select private.check_silent_consumers()');
