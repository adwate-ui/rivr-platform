-- Runs the outbox consumers on a schedule (#215, decision 0038). Each consumer is an Edge Function
-- that only the scheduler may run (supabase/functions/_shared/outbox.ts). pg_cron calls
-- private.run_outbox_consumer every minute, which posts to the function with pg_net, carrying the
-- project's address and the scheduler's own secret from Vault, read at each run. Never the
-- service-role key: pg_net's request queue is readable by every database role, and the scheduler's
-- secret only lets its holder run a consumer early, which claiming makes harmless.
-- Until the owner adds both secrets (runbook "Outbox consumers"), and on a local stack, a run does
-- nothing. A consumer's own migration schedules it: select private.schedule_outbox_consumer('<name>').

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- One run of a consumer: a POST to /functions/v1/<function> with the scheduler's secret. Returns
-- pg_net's request id, or null while the Vault secrets are missing.
create function private.run_outbox_consumer(p_function text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_url text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url');
  v_secret text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'outbox_scheduler_secret');
begin
  -- An Edge Function's name, so the secret only ever goes to a consumer's address.
  if coalesce(p_function, '') !~ '^[a-z][a-z0-9-]{0,62}$' then
    raise exception 'A consumer is named by its Edge Function, such as alert-whatsapp' using errcode = '22023';
  end if;
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object('x-outbox-secret', v_secret, 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

-- Schedules a consumer's Edge Function, every minute unless said otherwise; scheduling it again
-- replaces its schedule. Returns the pg_cron job id.
create function private.schedule_outbox_consumer(p_function text, p_schedule text default '* * * * *')
returns bigint
language plpgsql
set search_path = ''
as $$
begin
  -- An Edge Function's name, never anything spliced into the job's SQL.
  if coalesce(p_function, '') !~ '^[a-z][a-z0-9-]{0,62}$' then
    raise exception 'A consumer is named by its Edge Function, such as alert-whatsapp' using errcode = '22023';
  end if;
  return cron.schedule('outbox-' || p_function, p_schedule,
                       format('select private.run_outbox_consumer(%L)', p_function));
end;
$$;

-- Only migrations and the scheduler (as postgres) call these.
revoke execute on function private.run_outbox_consumer(text), private.schedule_outbox_consumer(text, text) from public;

-- pg_cron keeps a row per run, about 1,440 a day per consumer: a week is enough to look back on.
select cron.schedule('cron-history-cleanup', '17 3 * * *',
                     $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
