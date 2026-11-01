-- A consumer that stops claiming is noticed (audit A5-12): an event of a type a consumer has claimed at the venue before,
-- which that consumer has not claimed 10 to 30 minutes on, raises outbox.silent naming it, once an alert window. An
-- event just made or long gone, a type no consumer takes, alert.raised, another venue's consumer and the practice venue
-- raise nothing. Test event types, so the seed's events stay out.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.alert;
delete from public.outbox_delivery;

-- feedback has claimed test.silent events before; nothing has claimed test.unclaimed.
insert into public.outbox_event (venue_id, event_type, idempotency_key, occurred_at) values
  ('00000000-0000-4000-8000-000000000001', 'test.silent', 'silent-claimed', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000001', 'test.silent', 'silent-just-made', now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000001', 'test.silent', 'silent-long-gone', now() - interval '40 minutes'),
  ('00000000-0000-4000-8000-000000000001', 'test.unclaimed', 'unclaimed', now() - interval '20 minutes'),
  ('00000000-0000-4000-8000-000000000001', 'test.elsewhere', 'elsewhere', now() - interval '20 minutes'),
  ('00000000-0000-4000-8000-000000000002', 'test.silent', 'silent-practice', now() - interval '20 minutes'),
  ('00000000-0000-4000-8000-000000000002', 'test.elsewhere', 'elsewhere-claimed', now() - interval '2 days');
insert into public.outbox_delivery (venue_id, event_id, consumer, status, attempts, delivered_at)
select venue_id, id, 'feedback', 'delivered', 1, now() - interval '2 days' from public.outbox_event where idempotency_key = 'silent-claimed';
-- bar_printer has claimed test.elsewhere at the other venue only, as a cage agent prints for its own venue.
insert into public.outbox_delivery (venue_id, event_id, consumer, status, attempts, delivered_at)
select venue_id, id, 'bar_printer', 'delivered', 1, now() - interval '2 days' from public.outbox_event where idempotency_key = 'elsewhere-claimed';
-- The alert consumer's own events are left out.
insert into public.outbox_delivery (venue_id, event_id, consumer, status, attempts, delivered_at)
select '00000000-0000-4000-8000-000000000001', private.emit('00000000-0000-4000-8000-000000000001', 'alert.raised', '{}', 'silent-alert-claimed'),
       'alert_whatsapp', 'delivered', 1, now() - interval '2 days';
insert into public.outbox_event (venue_id, event_type, idempotency_key, occurred_at)
values ('00000000-0000-4000-8000-000000000001', 'alert.raised', 'silent-alert', now() - interval '20 minutes');
select is(private.check_silent_consumers(), 0,
  'an event just made or long gone, a type no consumer takes, alert.raised, another venue''s consumer and the practice venue raise nothing');

-- One that feedback has not claimed twenty minutes on.
insert into public.outbox_event (venue_id, event_type, idempotency_key, occurred_at)
values ('00000000-0000-4000-8000-000000000001', 'test.silent', 'silent-late', now() - interval '20 minutes');
select is(private.check_silent_consumers(), 1, 'an event its consumer has not claimed twenty minutes on raises an alert');
select results_eq($$ select venue_id, detail from public.alert where kind = 'outbox.silent' $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::uuid, '{"consumers": ["feedback"]}'::jsonb) $$,
  'for the club, naming the consumer, with no personal data');
select ok(exists (select 1 from public.outbox_event where event_type = 'alert.raised'
                  and payload ->> 'kind' = 'outbox.silent'), 'and it is raised for the owner''s WhatsApp');
select is(private.check_silent_consumers(), 0, 'once a window');

-- Once feedback claims it, there is nothing to say.
delete from public.alert;
insert into public.outbox_delivery (venue_id, event_id, consumer)
select venue_id, id, 'feedback' from public.outbox_event where idempotency_key = 'silent-late';
select is(private.check_silent_consumers(), 0, 'a consumer claiming again raises nothing');

select ok(exists (select 1 from cron.job where jobname = 'outbox-silent' and schedule = '*/5 * * * *'), 'it runs every five minutes');
select ok(not has_function_privilege('authenticated', 'private.check_silent_consumers()', 'execute'), 'no signed-in person runs it');

select * from finish();
rollback;
