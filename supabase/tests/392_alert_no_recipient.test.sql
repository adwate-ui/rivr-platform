-- An owner alert with nobody to send it to is recorded as such (audit F-212): finished, not a failure, not delivered.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.emit('00000000-0000-4000-8000-000000000001', 'alert.raised', '{}', 'test-392');
create temp table claimed as select * from public.claim_outbox_deliveries('alert_whatsapp', array['alert.raised']) limit 1;
select is((select count(*)::integer from claimed), 1, 'the consumer claims the alert');

select lives_ok($$ select public.finish_outbox_delivery((select d.id from public.outbox_delivery d where d.consumer = 'alert_whatsapp' and d.status = 'processing' limit 1), true, null, null, null, true) $$,
  'it finishes the delivery as having no recipient');
select results_eq($$ select status::text, delivered_at is null, last_error is null from public.outbox_delivery where consumer = 'alert_whatsapp' and status = 'no_recipient' $$,
  $$ values ('no_recipient'::text, true, true) $$, 'recorded as no recipient, not delivered, with no error');

select * from finish();
rollback;
