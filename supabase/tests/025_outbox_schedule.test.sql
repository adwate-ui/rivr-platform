-- The outbox consumers' schedule (#215): a consumer's Edge Function is called every minute with the
-- service role, through pg_net, with the address and key from Vault.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Scheduling.
select isnt(private.schedule_outbox_consumer('alert-whatsapp'), null, 'a consumer is scheduled by its Edge Function''s name');
select results_eq($$ select schedule, command from cron.job where jobname = 'outbox-alert-whatsapp' $$,
  $$ values ('* * * * *'::text, 'select private.run_outbox_consumer(''alert-whatsapp'')'::text) $$,
  'every minute, running that consumer');
select private.schedule_outbox_consumer('alert-whatsapp', '*/5 * * * *');
select results_eq($$ select schedule from cron.job where jobname = 'outbox-alert-whatsapp' $$, $$ values ('*/5 * * * *'::text) $$,
  'scheduling it again replaces its schedule');
select throws_ok($$ select private.schedule_outbox_consumer('x''); drop table public.venue; --') $$, '22023', null,
  'a name that is not an Edge Function''s is refused, so nothing is spliced into the job');

-- Running: nothing until the Vault secrets are there.
select is(private.run_outbox_consumer('alert-whatsapp'), null, 'with no address or key in Vault, a run does nothing');
select vault.create_secret('https://example.supabase.co/', 'project_url');
select vault.create_secret('service-role-key-for-tests', 'service_role_key');
select isnt(private.run_outbox_consumer('alert-whatsapp'), null, 'with both, a run calls the consumer');
select results_eq(
  $$ select method::text, url, headers ->> 'authorization' from net.http_request_queue order by id desc limit 1 $$,
  $$ values ('POST'::text, 'https://example.supabase.co/functions/v1/alert-whatsapp'::text, 'Bearer service-role-key-for-tests'::text) $$,
  'as a POST to its Edge Function, with the service role');

-- Nobody signed in may run or schedule one.
set local role authenticated;
select throws_ok($$ select private.run_outbox_consumer('alert-whatsapp') $$, '42501', null, 'a signed-in person cannot run a consumer');
select throws_ok($$ select private.schedule_outbox_consumer('alert-whatsapp') $$, '42501', null, 'nor schedule one');
reset role;

select * from finish();
rollback;
