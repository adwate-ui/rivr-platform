/** Gathers a run's facts from the database in one query, then writes report.json and report.md. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { factsSchema, renderReport } from '../src/report/report.ts';
import { sql } from './stack/psql.ts';

const NIGHTS = `select n.n, n.date::text as date, n.expected,
    (select count(*) from sim.log l where l.day = n.n and l.ok and l.action in ('floor.seat_from_waitlist', 'floor.seat_member')) as seated,
    (select count(*) from sim.log l where l.day = n.n and l.ok and l.action in ('member.order', 'staff.order_for_seat')) as orders,
    (select count(*) from sim.message m where m.day = n.n) as messages,
    (select count(*) from sim.log l where l.day = n.n and not l.ok and not l.expected_failure) as refused
  from sim.night n where n.n <= sim.day()`;
const INVARIANTS = `select code, max(title) as title, count(*) filter (where status = 'pass') as pass,
    count(*) filter (where status = 'fail') as fail, count(*) filter (where status = 'error') as error,
    min(day) filter (where status = 'fail') as first_fail, (array_agg(sample order by day) filter (where status <> 'pass'))[1] as sample
  from sim.invariant_result group by code`;
const REFUSALS = `select action, sqlstate as state, left(message, 120) as message, count(*) as count, bool_and(expected_failure) as expected
  from sim.log where not ok group by 1, 2, 3`;
const MESSAGES = 'select channel, kind, count(*) as count from sim.message group by 1, 2';
const JOBS = 'select jobname as name, runs, failures, last_error from sim.job_stat';

const agg = (query: string, order: string): string => `coalesce((select json_agg(x order by ${order}) from (${query}) x), '[]')`;

export function writeReport(dir: string, seconds: number): string {
  const json = sql(`select json_build_object(
    'run', json_build_object('id', (select v from sim.config where k = 'run'), 'main', (select v from sim.config where k = 'main'),
      'harness', (select v from sim.config where k = 'harness'), 'nights', sim.day(), 'seconds', ${String(Math.round(seconds))}),
    'nights', ${agg(NIGHTS, 'x.n')}, 'invariants', ${agg(INVARIANTS, 'x.code')}, 'refusals', ${agg(REFUSALS, 'x.count desc')},
    'messages', ${agg(MESSAGES, 'x.count desc')}, 'jobs', ${agg(JOBS, 'x.name')})`);
  const facts = factsSchema.parse(JSON.parse(json));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'report.json'), `${JSON.stringify(facts, null, 2)}\n`);
  const file = join(dir, 'report.md');
  writeFileSync(file, renderReport(facts));
  return file;
}
