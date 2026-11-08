-- 180-day simulation: infrastructure. SIMULATION ONLY: applied to the copy's database in ~/.rivr-sim180.
-- Ported from the 90-day run of 28 Oct (sim-90d/01_infra.sql and 06_extended.sql), without its money truth.
-- Every stakeholder action goes through sim.try: it acts as a real person, with the role and JWT claims a
-- code sign-in gives, fires the deferred checks inside the action and logs the outcome. sim.goto moves the
-- virtual clock and fires the pg_cron commands that fall due.
drop schema if exists sim cascade;
create schema sim;
grant usage on schema sim to public;

-- The real scheduler stays off; sim.goto runs the job commands on the virtual clock instead.
select count(*) as cron_paused from (select cron.alter_job(jobid, active := false) from cron.job) x;

create table sim.config (k text primary key, v text not null);
insert into sim.config values ('day', '0'), ('venue', '00000000-0000-4000-8000-000000000001'),
  ('practice', '00000000-0000-4000-8000-000000000002');

create table sim.log (
  id bigserial primary key, day int, at timestamptz, actor uuid, action text, ok boolean,
  sqlstate text, message text, result jsonb, expected_failure boolean not null default false);
create index on sim.log (day, ok);
create index on sim.log (action);
create table sim.job_stat (jobname text primary key, runs int not null default 0, failures int not null default 0, last_error text);
create table sim.event (id bigserial primary key, day int, at timestamptz, kind text, detail jsonb);
-- Every message the outbox consumers sent through the recording fakes (bin/messages.ts writes these).
create table sim.message (
  id bigserial primary key, day int, at timestamptz, channel text not null, consumer text not null,
  recipient text, member_id uuid, kind text, body text, payload jsonb);
create index on sim.message (day, kind);
grant all on all tables in schema sim to public;
grant all on all sequences in schema sim to public;

create function sim.venue() returns uuid language sql stable as $$ select v::uuid from sim.config where k = 'venue' $$;
create function sim.practice() returns uuid language sql stable as $$ select v::uuid from sim.config where k = 'practice' $$;
create function sim.day() returns int language sql stable as $$ select v::int from sim.config where k = 'day' $$;
create function sim.person(n int) returns uuid language sql immutable as
  $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function sim.uid(p text) returns uuid language sql immutable as $$ select md5(p)::uuid $$;
-- IST wall time on club night d. Night 1 is 15 Nov 2026; times before 06:00 fall on the next calendar day.
create function sim.ist(d int, t time) returns timestamptz language sql immutable as $$
  select ((date '2026-11-14' + d + case when t < time '06:00' then 1 else 0 end) + t) at time zone 'Asia/Kolkata' $$;
create function sim.night_date(d int) returns date language sql immutable as $$ select date '2026-11-14' + d $$;
create function sim.event(p_kind text, p_detail jsonb) returns void language sql as
  $$ insert into sim.event (day, at, kind, detail) values (sim.day(), sim_clock.now(), p_kind, p_detail) $$;

-- The claims of a code sign-in, as Auth issues them and private.require_code_sign_in accepts them.
create function sim.claims(p_user uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'sub', p_user, 'role', 'authenticated', 'aal', 'aal1', 'session_id', sim.uid('session:' || p_user),
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', extract(epoch from sim_clock.now())::bigint)))
$$;

-- One action with these claims. Returns {"ok":true,"r":<first row>} or {"ok":false,"state":…,"msg":…}.
create function sim.try_claims(p_claims jsonb, p_action text, p_sql text, p_expect_failure boolean default false)
returns jsonb language plpgsql as $$
declare
  v_res jsonb;
  v_state text;
  v_msg text;
begin
  begin
    perform set_config('role', coalesce(p_claims ->> 'role', 'authenticated'), true);
    perform set_config('request.jwt.claims', p_claims::text, true);
    execute 'with x as (' || p_sql || ') select to_jsonb(x) from x limit 1' into v_res;
    -- Deferred constraint triggers fire at commit; fire them here so a failure is this action's.
    set constraints all immediate;
    set constraints all deferred;
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
    insert into sim.log (day, at, actor, action, ok, result)
    values (sim.day(), sim_clock.now(), (p_claims ->> 'sub')::uuid, p_action, true, v_res);
    return jsonb_build_object('ok', true, 'r', v_res);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    insert into sim.log (day, at, actor, action, ok, sqlstate, message, expected_failure)
    values (sim.day(), sim_clock.now(), (p_claims ->> 'sub')::uuid, p_action, false, v_state, left(v_msg, 300), p_expect_failure);
    return jsonb_build_object('ok', false, 'state', v_state, 'msg', v_msg);
  end;
end $$;

-- One action as one signed-in person.
create function sim.try(p_actor uuid, p_action text, p_sql text, p_expect_failure boolean default false)
returns jsonb language sql as $$ select sim.try_claims(sim.claims(p_actor), p_action, p_sql, p_expect_failure) $$;
-- One action as the service role (what an Edge Function does).
create function sim.try_service(p_action text, p_sql text) returns jsonb language sql as
  $$ select sim.try_claims('{"role": "service_role"}'::jsonb, p_action, p_sql) $$;
create function sim.ok(p jsonb) returns boolean language sql immutable as $$ select coalesce((p ->> 'ok')::boolean, false) $$;
-- The first column of the returned row, as text.
create function sim.val(p jsonb) returns text language sql immutable as $$
  select case when jsonb_typeof(p -> 'r') = 'object' then (select value from jsonb_each_text(p -> 'r') limit 1) else p ->> 'r' end $$;

create function sim.run_job(p_job text, p_command text) returns void language plpgsql as $$
declare
  v_msg text;
begin
  begin
    execute p_command;
    insert into sim.job_stat (jobname, runs) values (p_job, 1)
    on conflict (jobname) do update set runs = sim.job_stat.runs + 1;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into sim.job_stat (jobname, runs, failures, last_error) values (p_job, 1, 1, left(v_msg, 200))
    on conflict (jobname) do update set runs = sim.job_stat.runs + 1, failures = sim.job_stat.failures + 1, last_error = left(v_msg, 200);
  end;
end $$;

-- The jobs sim.goto fires. Outbox consumers are left out: they POST to an Edge Function through pg_net, which
-- does nothing on a local stack (no Vault secrets), so the harness runs the real consumers in Node instead.
create view sim.due_job as
  select j.jobid, j.jobname, j.schedule, j.command from cron.job j where j.command not like '%run_outbox_consumer%';

-- Move the clock forward. Daily jobs fire at their own UTC times, in order; the minute-grained sweeps
-- (every 1, 5 or 10 minutes) process everything due, so they run once at the new time.
create function sim.goto(p_ts timestamptz) returns void language plpgsql as $$
declare
  v_from timestamptz := sim_clock.now();
  f record;
begin
  if p_ts <= v_from then
    return;
  end if;
  for f in
    select j.jobid, j.jobname, j.command,
           (d::date + make_time(split_part(j.schedule, ' ', 2)::int, split_part(j.schedule, ' ', 1)::int, 0)) at time zone 'UTC' as fire_at
    from sim.due_job j,
         generate_series((v_from at time zone 'UTC')::date, (p_ts at time zone 'UTC')::date, interval '1 day') d
    where j.schedule ~ '^[0-9]+ [0-9]+ \* \* \*$'
    order by 4, 1
  loop
    if f.fire_at > v_from and f.fire_at <= p_ts then
      perform sim_clock.set(f.fire_at);
      perform sim.run_job(f.jobname, f.command);
    end if;
  end loop;
  perform sim_clock.set(p_ts);
  for f in select j.jobname, j.command from sim.due_job j where j.schedule !~ '^[0-9]+ [0-9]+ \* \* \*$' order by j.jobid loop
    perform sim.run_job(f.jobname, f.command);
  end loop;
end $$;
