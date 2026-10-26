-- Alerting (#100; decision 0191). The club's alert number is read for the alert consumer only; the practice
-- venue's never. Five deliveries failing for good within an hour raise outbox.failures once an hour, the
-- alert consumer's own failures aside. A vendor's error keeps no number or email address in an alert.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.venue_config set alert_whatsapp = '+919000000901' where venue_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
delete from public.alert;

-- The alert number.
create temporary table raised as
select private.raise_alert('00000000-0000-4000-8000-000000000001', 'eod.variance', '{"close_id": "x", "reason": "Kabir Sethi short ₹500"}') as club,
       private.raise_alert('00000000-0000-4000-8000-000000000002', 'eod.variance', '{}') as practice;
insert into public.alert (id, venue_id, kind, raised_at) values ('00000000-0000-4000-8000-0000000a1230', '00000000-0000-4000-8000-000000000001', 'eod.variance', now() - interval '2 days');
select results_eq($$ select alert_whatsapp from private.alert_recipient('00000000-0000-4000-8000-000000000001', (select club from raised)) $$,
  $$ values ('+919000000901'::text) $$, 'the alert consumer reads the club''s alert number for its alert');
select is_empty($$ select 1 from private.alert_recipient('00000000-0000-4000-8000-000000000002', (select practice from raised)) $$, 'never the practice venue''s');
select is_empty($$ select 1 from private.alert_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000a1230') $$,
  'nor for an alert raised days ago, which is then not sent');
select ok(not has_function_privilege('authenticated', 'public.alert_recipient(uuid, uuid)', 'execute'), 'and no signed-in person can read it');
select ok(has_function_privilege('service_role', 'public.alert_recipient(uuid, uuid)', 'execute'), 'only the service role');
select is((select detail from public.alert where id = (select club from raised)), '{"close_id": "x"}'::jsonb, 'a free-text reason stays out of an alert');
select ok(exists (select 1 from public.outbox_event where event_type = 'alert.raised' and payload ->> 'alert_id' = (select club from raised)::text),
  'and the alert is raised for the owner''s WhatsApp');
select private.raise_sms_limit_alert();
select ok(exists (select 1 from public.outbox_event e join public.alert a on a.id::text = e.payload ->> 'alert_id'
                  where e.event_type = 'alert.raised' and a.kind = 'auth.sms_rate_limit'), 'the sign-in code limit''s alert reaches WhatsApp too');
delete from public.alert;

-- No personal data.
select is(private.without_personal_data('Recipient +91 90000 00211 rejected for kabir@example.com, ref 12345678'),
  'Recipient [number] rejected for [email] ref [number]', 'a vendor''s error keeps no number or email address');

-- Deliveries failing for good: four, then a fifth.
create function pg_temp.fail(p_venue uuid, p_consumer text, p_type text, p_n integer) returns void language sql as $$
  insert into public.outbox_delivery (venue_id, event_id, consumer, status, attempts, last_error)
  select p_venue, private.emit(p_venue, p_type, '{}'::jsonb, 'alert-test:' || p_consumer || ':' || p_n), p_consumer, 'failed', 10,
         'Recipient +919000000211 not on WhatsApp';
$$;
select pg_temp.fail('00000000-0000-4000-8000-000000000001', 'whatsapp', 'receipt.ready', n) from generate_series(1, 4) n;
select pg_temp.fail('00000000-0000-4000-8000-000000000001', 'alert_whatsapp', 'alert.raised', n) from generate_series(5, 9) n;
select pg_temp.fail('00000000-0000-4000-8000-000000000002', 'whatsapp', 'receipt.ready', n) from generate_series(10, 20) n;
select is(private.check_outbox_failures(), 0, 'four failures, the alert consumer''s own and the practice venue''s raise nothing');
select pg_temp.fail('00000000-0000-4000-8000-000000000001', 'whatsapp', 'receipt.ready', 21);
select is(private.check_outbox_failures(), 1, 'a fifth within the hour alerts the owner');
select results_eq($$ select detail from public.alert where kind = 'outbox.failures' $$, $$ values ('{"failed": 5, "window_minutes": 60}'::jsonb) $$,
  'with how many and the window, and no personal data');
select pg_temp.fail('00000000-0000-4000-8000-000000000001', 'whatsapp', 'receipt.ready', 22);
select is(private.check_outbox_failures(), 0, 'once a window');

-- The venue's own threshold.
delete from public.alert;
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'alert.thresholds', '', '{"failed_deliveries": 10, "window_minutes": 30}', now() - interval '1 minute', 'Test');
select is(private.check_outbox_failures(), 0, 'six is under the club''s own ten');

-- The failed delivery's own alert keeps the vendor's error without the number.
select private.alert_failed_delivery((select id from public.outbox_delivery where consumer = 'whatsapp' and venue_id = '00000000-0000-4000-8000-000000000001' limit 1));
select is((select detail ->> 'error' from public.alert where kind = 'outbox.delivery_failed'), 'Recipient [number] not on WhatsApp',
  'a failed delivery''s alert names the error, not the member''s number');

-- Scheduled.
select ok(exists (select 1 from cron.job where jobname = 'outbox-failures' and schedule = '*/5 * * * *'), 'the check runs every five minutes');
select ok(exists (select 1 from cron.job where jobname = 'outbox-alert-whatsapp'), 'and the alert consumer every minute');

select * from finish();
rollback;
