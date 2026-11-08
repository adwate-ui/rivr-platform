-- A consumer finishes only the claim it holds (audit A5-13): a finish from an older claim of the same delivery, after
-- its lock ran out and the next run claimed it again, changes nothing; the newer claim's finish goes through.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{"visit_id": "v1"}', 'test-own-claim');
create temporary table delivery as
select c.delivery_id as id, c.attempts from public.claim_outbox_deliveries('feedback', array['visit.closed']) c
join public.outbox_event e on e.id = c.event_id and e.idempotency_key = 'test-own-claim';
select is((select attempts from delivery), 1, 'the first run claims the delivery as its first attempt');

-- The first run holds it past its lock, and the next run claims it again.
update public.outbox_delivery set locked_until = now() - interval '1 second' where id = (select id from delivery);
select is((select c.attempts from public.claim_outbox_deliveries('feedback', array['visit.closed']) c where c.delivery_id = (select id from delivery)), 2,
  'the next run claims it again, as its second attempt');

select public.finish_outbox_delivery((select id from delivery), false, 'vendor down', interval '2 minutes', 1);
select results_eq($$ select status::text, attempts, last_error from public.outbox_delivery where id = (select id from delivery) $$,
  $$ values ('processing', 2, null::text) $$, 'the first run''s late failure changes nothing: the second claim is still sending');

select public.finish_outbox_delivery((select id from delivery), true, null, interval '5 minutes', 2);
select is((select status::text from public.outbox_delivery where id = (select id from delivery)), 'delivered', 'the second claim''s finish goes through');

-- A finish without its attempt, as a cage agent installed before #691 makes (finish_agent_kot), goes through as before.
select private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{"visit_id": "v2"}', 'test-own-claim-2');
select public.claim_outbox_deliveries('tally', array['visit.closed'], false);
select public.finish_outbox_delivery((select d.id from public.outbox_delivery d join public.outbox_event e on e.id = d.event_id
                                      where d.consumer = 'tally' and e.idempotency_key = 'test-own-claim-2'), true);
select is((select d.status::text from public.outbox_delivery d join public.outbox_event e on e.id = d.event_id
           where d.consumer = 'tally' and e.idempotency_key = 'test-own-claim-2'), 'delivered', 'a finish without its attempt goes through as before');

select ok(has_function_privilege('service_role', 'public.finish_outbox_delivery(uuid, boolean, text, interval, integer, boolean)', 'execute'),
  'the consumers, with the service role, finish deliveries');
select ok(not has_function_privilege('authenticated', 'public.finish_outbox_delivery(uuid, boolean, text, interval, integer, boolean)', 'execute'),
  'and no signed-in person does');
select ok(not has_function_privilege('anon', 'public.finish_outbox_delivery(uuid, boolean, text, interval, integer, boolean)', 'execute'),
  'nor anyone signed out');

select * from finish();
rollback;
