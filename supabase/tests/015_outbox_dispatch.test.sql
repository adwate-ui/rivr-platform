-- The outbox dispatcher (#12): a failed delivery backs off and is tried again, ten attempts in all;
-- the tenth failure raises an alert (never for an alert's own delivery); dashboard staff see alerts.
-- 101 Vikram (super admin), 108 Karan (host), 201 Arjun (member).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{"visit_id": "v1"}', 'test-visit-1');
select is((select count(*)::int from public.claim_outbox_deliveries('feedback', array['visit.closed'])), 1, 'a consumer claims its delivery');
select lives_ok(
  $$ select public.finish_outbox_delivery((select id from public.outbox_delivery where consumer = 'feedback'), false, 'vendor down', interval '2 minutes') $$,
  'and finishes it as failed');
select results_eq($$ select status::text, attempts, last_error from public.outbox_delivery where consumer = 'feedback' $$,
  $$ values ('failed', 1, 'vendor down') $$, 'failed, after one attempt');
select ok((select available_at > now() + interval '1 minute' from public.outbox_delivery where consumer = 'feedback'),
  'due again only after the backoff');
select is_empty($$ select * from public.claim_outbox_deliveries('feedback', array['visit.closed']) $$, 'so it is not claimed before then');
select is((select count(*)::int from public.alert), 0, 'one failure raises no alert');

-- The tenth attempt fails: the owner is alerted.
update public.outbox_delivery set attempts = 9, available_at = now() - interval '1 second' where consumer = 'feedback';
select is((select attempts from public.claim_outbox_deliveries('feedback', array['visit.closed'])), 10, 'the tenth attempt is claimed');
select public.finish_outbox_delivery((select id from public.outbox_delivery where consumer = 'feedback'), false, 'vendor down');
select results_eq($$ select kind, detail ->> 'consumer', detail ->> 'event_type', detail ->> 'error' from public.alert $$,
  $$ values ('outbox.delivery_failed', 'feedback', 'visit.closed', 'vendor down') $$, 'its failure raises an alert');
select is((select count(*)::int from public.outbox_event where event_type = 'alert.raised'), 1, 'and alert.raised for WhatsApp');
select is_empty($$ select * from public.claim_outbox_deliveries('feedback', array['visit.closed']) $$, 'it is not tried an eleventh time');

-- An alert's own delivery that fails for good raises no further alert.
select is((select count(*)::int from public.claim_outbox_deliveries('alert_whatsapp', array['alert.raised'])), 1, 'the alert is claimed');
update public.outbox_delivery set attempts = 10 where consumer = 'alert_whatsapp';
select public.finish_outbox_delivery((select id from public.outbox_delivery where consumer = 'alert_whatsapp'), false, 'number unreachable');
select is((select count(*)::int from public.alert), 1, 'an alert that cannot be delivered raises no alert about itself');

-- A consumer that dies on its last attempt alerts too.
select private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{"visit_id": "v2"}', 'test-visit-2');
select public.claim_outbox_deliveries('tally', array['visit.closed'], false);
update public.outbox_delivery set attempts = 10, locked_until = now() - interval '1 second' where consumer = 'tally';
select is_empty($$ select * from public.claim_outbox_deliveries('tally', array['visit.closed'], false) $$, 'a delivery that died last time is not claimed');
select is((select count(*)::int from public.alert where detail ->> 'consumer' = 'tally'), 2, 'and both of its events alert the owner');

-- A delivered one is done.
select private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{"visit_id": "v3"}', 'test-visit-3');
select public.finish_outbox_delivery(d.delivery_id, true) from public.claim_outbox_deliveries('review', array['visit.closed']) d;
select is((select count(*)::int from public.outbox_delivery where consumer = 'review' and status = 'delivered'), 3, 'delivered deliveries are done');

-- Who sees alerts.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select ok((select count(*) from public.alert) >= 1, 'dashboard staff see the venue''s alerts');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*)::int from public.alert), 0, 'a member sees none');
select throws_ok($$ select private.raise_alert('00000000-0000-4000-8000-000000000001', 'test', '{}') $$, '42501', null,
  'nor raises one');
reset role;

select * from finish();
rollback;
