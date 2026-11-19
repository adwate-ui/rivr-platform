/**
 * A new local database gets its migrations and seed with pg_cron's jobs held (#1071). The CLI's own start and reset
 * apply each migration while the jobs earlier ones scheduled already run every minute, and a job can deadlock a later
 * migration: at a minute's turn seated-time (private.sweep_seated_time) held seat_session and waited for game_table,
 * which 20261116200000's drop of points_earning had locked on its way to seat_session through their foreign keys. No
 * migration can hold the jobs (its own unschedule is seen only once it commits, and applied ones are never edited), so
 * scripts/supabase.mjs has the CLI make the database empty and applies everything here with cron.launch_active_jobs off.
 */
import { spawnSync } from 'node:child_process';
import { worktreeName } from '@rivr/config/worktree';

/** Runs each statement on its own (ALTER SYSTEM refuses a transaction) as the stack's superuser; returns the output. */
function asSuperuser(...statements) {
  const psql = ['psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tAq', ...statements.flatMap((sql) => ['-c', sql])];
  const result = spawnSync('docker', ['exec', `supabase_db_${worktreeName()}`, ...psql], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`psql: ${result.stderr || result.error?.message}`);
  return result.stdout.trim();
}

/** Whether the local database has no migrations yet: `start` has just made it. */
export function hasNoMigrations() {
  return asSuperuser("select to_regclass('supabase_migrations.schema_migrations') is null") === 't';
}

/**
 * Holds pg_cron's jobs, runs `apply` (the migrations and seed; it returns an exit status), then lets the jobs run again
 * whatever happened. Fails when a job ran meanwhile, so every new database proves the hold took.
 */
export function withJobsHeld(apply) {
  asSuperuser('alter system set cron.launch_active_jobs = off', 'select pg_reload_conf()');
  try {
    const status = apply();
    const runs = status === 0 ? Number(asSuperuser('select count(*) from cron.job_run_details')) : 0;
    if (runs > 0) process.stderr.write(`pg_cron ran ${runs} jobs while the migrations applied, though they were held (#1071).\n`);
    return runs > 0 ? 1 : status;
  } finally {
    asSuperuser('alter system reset cron.launch_active_jobs', 'select pg_reload_conf()');
  }
}
