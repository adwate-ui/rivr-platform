-- The cage agent's KOTs finish only the claim they hold (#691): a finish from an agent whose lease ran out, while another
-- claimed the KOT again, changes nothing; the newer claim's finish goes through. An agent installed before this, which
-- names no attempt, finishes as before.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.device (id, venue_id, kind, name) values
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-000000000001', 'agent', 'Cage agent'),
  ('00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-000000000001', 'agent', 'Bar agent');
select private.emit('00000000-0000-4000-8000-000000000001', 'fnb.ordered',
  jsonb_build_object('order_id', '00000000-0000-4000-8000-0000000f0691', 'kot_number', '91'), 'test-kot-attempt');
select private.emit('00000000-0000-4000-8000-000000000001', 'fnb.ordered',
  jsonb_build_object('order_id', '00000000-0000-4000-8000-0000000f0692', 'kot_number', '92'), 'test-kot-attempt-2');

-- The cage agent claims both KOTs, each as its first attempt.
set local role service_role;
create temporary table first_claim on commit drop as
select c.payload ->> 'kot_number' as kot, c.delivery_id, c.attempts from public.claim_agent_kots('00000000-0000-4000-8000-00000000a001', 10) c
where c.payload ->> 'kot_number' in ('91', '92');
reset role;
select results_eq($$ select kot, attempts from first_claim order by kot $$, $$ values ('91'::text, 1), ('92', 1) $$,
  'the cage agent claims KOTs 91 and 92 as their first attempt');
grant select on first_claim to service_role;
create function pg_temp.kot(p_kot text) returns uuid language sql as $$ select delivery_id from first_claim where kot = p_kot; $$;
grant execute on function pg_temp.kot(text) to service_role;
create function pg_temp.state(p_kot text) returns table (status text, attempts integer, last_error text) language sql as $$
  select d.status::text, d.attempts, d.last_error from public.outbox_delivery d where d.id = pg_temp.kot(p_kot);
$$;

-- The cage agent holds KOT 91 past its lease, and the bar agent claims it again.
update public.outbox_delivery set locked_until = now() - interval '1 second' where id = pg_temp.kot('91');
set local role service_role;
select is((select c.attempts from public.claim_agent_kots('00000000-0000-4000-8000-00000000a003', 10) c where c.delivery_id = pg_temp.kot('91')), 2,
  'the bar agent claims it again, as its second attempt');
select public.finish_agent_kot('00000000-0000-4000-8000-00000000a001', pg_temp.kot('91'), false, 'unavailable', 60, 1);
reset role;
select results_eq($$ select * from pg_temp.state('91') $$, $$ values ('processing'::text, 2, null::text) $$,
  'the cage agent''s late failure changes nothing: the bar agent is still printing it');

set local role service_role;
select public.finish_agent_kot('00000000-0000-4000-8000-00000000a003', pg_temp.kot('91'), true, null, 0, 2);
reset role;
select results_eq($$ select * from pg_temp.state('91') $$, $$ values ('delivered'::text, 2, null::text) $$,
  'the bar agent''s finish goes through');

-- An agent installed before #691 names no attempt.
set local role service_role;
select public.finish_agent_kot('00000000-0000-4000-8000-00000000a001', pg_temp.kot('92'), true, null, 0);
reset role;
select is((select status from pg_temp.state('92')), 'delivered', 'a finish without its attempt goes through as before');

select ok(has_function_privilege('service_role', 'public.finish_agent_kot(uuid, uuid, boolean, text, integer, integer)', 'execute'),
  'the cage-agent function, with the service role, finishes KOTs');
select ok(not has_function_privilege('authenticated', 'public.finish_agent_kot(uuid, uuid, boolean, text, integer, integer)', 'execute'),
  'and no signed-in person does');
select ok(not has_function_privilege('anon', 'private.finish_agent_kot(uuid, uuid, boolean, text, integer, integer)', 'execute'),
  'nor anyone signed out');
select hasnt_function('public', 'finish_agent_kot', array['uuid', 'uuid', 'boolean', 'text', 'integer'],
  'the finish without an attempt is gone, so a call without one resolves to the new finish');

select * from finish();
rollback;
