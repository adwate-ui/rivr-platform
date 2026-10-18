-- The outbox dispatcher (#12): a failed delivery backs off and is tried again, ten attempts in all;
-- the tenth failure raises an alert (never for an alert's own delivery); dashboard staff see alerts.
-- 101 Vikram (super admin), 108 Karan (host), 201 Arjun (member).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- An owner (dashboards.read) of the practice venue only.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000eb', 'authenticated', 'authenticated',
        '919000000997', now(), now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000eb', 'Practice owner', 'Owner', 'owner_view', '+919000000997');

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

-- A vendor's rejection fails a delivery for good at once; the owner already has this hour's alert
-- about the consumer, so there is no second one.
select private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{"visit_id": "v4"}', 'test-visit-4');
select public.claim_outbox_deliveries('feedback', array['visit.closed']);
select public.finish_outbox_delivery(
  (select id from public.outbox_delivery where consumer = 'feedback' and status = 'processing'), false, 'rejected: template not approved', null);
select is((select count(*)::int from public.outbox_delivery where consumer = 'feedback' and attempts >= 10), 2,
  'a rejected delivery is not tried again');
select is((select count(*)::int from public.alert where detail ->> 'consumer' = 'feedback'), 1,
  'and a consumer failing again within the hour raises no second alert');

-- A consumer that dies on its last attempt alerts too.
select private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{"visit_id": "v2"}', 'test-visit-2');
select public.claim_outbox_deliveries('tally', array['visit.closed'], false);
update public.outbox_delivery set attempts = 10, locked_until = now() - interval '1 second' where consumer = 'tally';
select is_empty($$ select * from public.claim_outbox_deliveries('tally', array['visit.closed'], false) $$, 'a delivery that died last time is not claimed');
select is((select count(*)::int from public.alert where detail ->> 'consumer' = 'tally'), 1, 'and alerts the owner, once for the consumer');

-- A delivered one is done.
select private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{"visit_id": "v3"}', 'test-visit-3');
select public.finish_outbox_delivery(d.delivery_id, true) from public.claim_outbox_deliveries('review', array['visit.closed']) d;
select is((select count(*)::int from public.outbox_delivery where consumer = 'review' and status = 'delivered'), 4, 'delivered deliveries are done');

-- An alert at the practice venue, for the cross-venue checks below.
select private.raise_alert('00000000-0000-4000-8000-000000000002', 'test.practice', '{}');

-- Who sees alerts.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select ok((select count(*) from public.alert) >= 1, 'dashboard staff see the venue''s alerts');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000108", "role": "authenticated"}';
select is((select count(*)::int from public.alert), 0, 'a host, without dashboards, sees none');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000eb", "role": "authenticated"}';
select results_eq($$ select kind from public.alert $$, $$ values ('test.practice') $$,
  'an owner of the practice venue sees only its alerts');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*)::int from public.alert), 0, 'a member sees none');
select throws_ok($$ select private.raise_alert('00000000-0000-4000-8000-000000000001', 'test', '{}') $$, '42501', null,
  'nor raises one');
reset role;

select * from finish();
rollback;
