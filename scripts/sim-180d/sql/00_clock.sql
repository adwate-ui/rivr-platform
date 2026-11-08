-- SIMULATION ONLY. Installed into the copy in ~/.rivr-sim180 as migration 20000101000000, never into
-- supabase/migrations. Every time call in the copied migrations and seed is rewritten to these functions
-- (src/rewrite.ts), so the database reads a virtual clock that the harness moves forward.
create schema if not exists sim_clock;

create table sim_clock.state (
  only_row boolean primary key default true check (only_row),
  current_ts timestamptz not null
);

-- Seed time: 15 Nov 2026, 12:00 IST. Night 1 of the run is the club night of 15 Nov.
insert into sim_clock.state (current_ts) values ('2026-11-15 06:30:00+00');

create function sim_clock.now() returns timestamptz language sql stable as
  $$ select current_ts from sim_clock.state $$;
create function sim_clock.clock_timestamp() returns timestamptz language sql volatile as
  $$ select current_ts from sim_clock.state $$;
create function sim_clock.set(p_ts timestamptz) returns timestamptz language sql volatile as
  $$ update sim_clock.state set current_ts = p_ts returning current_ts $$;
create function sim_clock.advance(p_delta interval) returns timestamptz language sql volatile as
  $$ update sim_clock.state set current_ts = current_ts + p_delta returning current_ts $$;

grant usage on schema sim_clock to public;
grant select on sim_clock.state to public;
grant execute on function sim_clock.now(), sim_clock.clock_timestamp() to public;
revoke execute on function sim_clock.set(timestamptz), sim_clock.advance(interval) from public;
