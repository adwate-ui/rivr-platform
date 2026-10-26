-- Alerting (#100; additions "Alerting"; decision 0191). Alerts are rows for the owner dashboard (#101),
-- each emitting alert.raised; this adds what reaches the owner and what raises them:
--   - the alert-whatsapp consumer sends each alert's kind, in words, to the WhatsApp number in venue
--     configuration, reading it here with the service role at send time;
--   - every five minutes, a venue with alert.thresholds' failed deliveries (5) or more failing for good
--     within its window (60 minutes) raises outbox.failures, once a window;
--   - no personal data in an alert: the failed-delivery alert's vendor error has numbers and email
--     addresses taken out, and a free-text reason (the kill switch's) stays with its own record, not the
--     alert; the sign-in code limit's alert now goes through raise_alert, so it reaches WhatsApp too;
--   - only an alert raised within the day is sent, so alerts waiting while WhatsApp was not yet set up
--     do not all arrive at once when it is; a messaging stop holds members' messages, not these (#468).

insert into public.setting_key (key, description, scope, value_schema) values
  ('alert.thresholds',
   'Alerting (decision 0191): this many outbox deliveries failing for good within the window alerts the owner. 5 within 60 minutes unless set.',
   'venue',
   '{"type":"object","properties":{"failed_deliveries":{"type":"integer","minimum":1,"maximum":1000},"window_minutes":{"type":"integer","minimum":5,"maximum":1440}},"required":["failed_deliveries","window_minutes"],"additionalProperties":false}');

-- The venue's alert number for an alert raised there within the day, never the practice venue's: for the
-- alert consumer, with the service role only. An older alert finds no number and is not sent.
create function private.alert_recipient(p_venue_id uuid, p_alert_id uuid)
returns table (alert_whatsapp text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.alert_whatsapp
  from public.alert a
  join public.venue v on v.id = a.venue_id and not v.is_practice
  join public.venue_config c on c.venue_id = a.venue_id
  where a.id = p_alert_id and a.venue_id = p_venue_id and a.raised_at > now() - interval '1 day';
$$;

create function public.alert_recipient(p_venue_id uuid, p_alert_id uuid)
returns table (alert_whatsapp text)
language sql security invoker set search_path = ''
as $$ select * from private.alert_recipient(p_venue_id, p_alert_id); $$;

revoke execute on function private.alert_recipient(uuid, uuid), public.alert_recipient(uuid, uuid) from public, anon, authenticated;
grant execute on function private.alert_recipient(uuid, uuid), public.alert_recipient(uuid, uuid) to service_role;

-- As before (20261018091900_outbox_dispatch.sql), but a free-text reason stays with its own record: a
-- kill switch's reason may name a member, and an alert holds no personal data.
create or replace function private.raise_alert(p_venue_id uuid, p_kind text, p_detail jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_id uuid;
begin
  insert into public.alert (venue_id, kind, detail) values (p_venue_id, p_kind, coalesce(p_detail, '{}'::jsonb) - 'reason')
  returning id into v_alert_id;
  perform private.emit(p_venue_id, 'alert.raised', jsonb_build_object('alert_id', v_alert_id, 'kind', p_kind),
                       'alert.raised:' || v_alert_id);
  return v_alert_id;
end;
$$;

-- As before (20261018093100_sms_limit_alert.sql), but through raise_alert, so it emits alert.raised and
-- reaches the owner's WhatsApp as every other alert does.
create or replace function private.raise_sms_limit_alert()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select v.id from public.venue v where not v.is_practice order by v.created_at limit 1);
begin
  perform pg_advisory_xact_lock(hashtext('sms-limit-alert'));
  if v_venue_id is null or exists (
    select 1 from public.alert a
    where a.venue_id = v_venue_id and a.kind = 'auth.sms_rate_limit' and a.raised_at > now() - interval '15 minutes'
  ) then
    return;
  end if;
  perform private.raise_alert(v_venue_id, 'auth.sms_rate_limit',
    jsonb_build_object('note', 'Sign-in codes are being refused: the project''s hourly code limit is used up.'));
end;
$$;

-- A vendor's error with anything that could name a person taken out: runs of digits (a number, an id)
-- and email addresses.
create function private.without_personal_data(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(regexp_replace(coalesce(p_text, ''), '[^\s@]+@[^\s@]+', '[email]', 'g'), '\+?\d[\d\s-]{5,}\d', '[number]', 'g');
$$;

-- As before (20261018091900_outbox_dispatch.sql), with the vendor's error kept free of personal data.
create or replace function private.alert_failed_delivery(p_delivery_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.raise_alert(d.venue_id, 'outbox.delivery_failed', jsonb_build_object(
    'delivery_id', d.id, 'consumer', d.consumer, 'event_type', e.event_type, 'attempts', d.attempts,
    'error', left(private.without_personal_data(d.last_error), 500)))
  from public.outbox_delivery d join public.outbox_event e on e.id = d.event_id
  where d.id = p_delivery_id and e.event_type <> 'alert.raised'
    and not exists (select 1 from public.alert a
                    where a.venue_id = d.venue_id and a.kind = 'outbox.delivery_failed'
                      and a.detail ->> 'consumer' = d.consumer and a.raised_at > now() - interval '1 hour');
$$;

-- Each venue whose deliveries failing for good within its window reach its threshold raises
-- outbox.failures, once a window. The alert consumer's own failures are left out: they would only raise
-- another alert to be delivered the same way. Returns how many venues it alerted.
create function private.check_outbox_failures()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue record;
  v_alerted integer := 0;
begin
  for v_venue in
    select v.id, coalesce((t.value ->> 'failed_deliveries')::integer, 5) as threshold, coalesce((t.value ->> 'window_minutes')::integer, 60) as window_minutes
    from public.venue v
    left join lateral (select private.setting_at(v.id, 'alert.thresholds', '', now()) as value) t on true
    where not v.is_practice
  loop
    if (select count(*) from public.outbox_delivery d join public.outbox_event e on e.id = d.event_id
        where d.venue_id = v_venue.id and d.status = 'failed' and d.attempts >= 10 and e.event_type <> 'alert.raised'
          and d.updated_at > now() - make_interval(mins => v_venue.window_minutes)) >= v_venue.threshold
       and not exists (select 1 from public.alert a where a.venue_id = v_venue.id and a.kind = 'outbox.failures'
                         and a.raised_at > now() - make_interval(mins => v_venue.window_minutes)) then
      perform private.raise_alert(v_venue.id, 'outbox.failures', jsonb_build_object(
        'failed', (select count(*) from public.outbox_delivery d join public.outbox_event e on e.id = d.event_id
                   where d.venue_id = v_venue.id and d.status = 'failed' and d.attempts >= 10 and e.event_type <> 'alert.raised'
                     and d.updated_at > now() - make_interval(mins => v_venue.window_minutes)),
        'window_minutes', v_venue.window_minutes));
      v_alerted := v_alerted + 1;
    end if;
  end loop;
  return v_alerted;
end;
$$;

revoke execute on function private.without_personal_data(text), private.check_outbox_failures() from public, anon, authenticated;

select cron.schedule('outbox-failures', '*/5 * * * *', 'select private.check_outbox_failures()');

-- pg_cron runs the alert consumer every minute with the scheduler's secret (decision 0038).
select private.schedule_outbox_consumer('alert-whatsapp');
