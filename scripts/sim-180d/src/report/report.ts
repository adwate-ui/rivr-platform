/** A run's report: what ran, the checks by code, refusals by code, messages by kind, the jobs, and night by night. */
import { z } from 'zod';
import { CODES } from '../invariants/codes.ts';

const count = z.coerce.number().int();

export const factsSchema = z.object({
  run: z.object({ id: z.string(), main: z.string(), harness: z.string(), nights: count, seconds: count }),
  nights: z.array(z.object({ n: count, date: z.string(), expected: count, seated: count, orders: count, messages: count, refused: count })),
  invariants: z.array(z.object({ code: z.string(), title: z.string(), pass: count, fail: count, error: count, first_fail: count.nullable(), sample: z.unknown() })),
  refusals: z.array(z.object({ action: z.string(), state: z.string(), message: z.string(), count, expected: z.boolean() })),
  messages: z.array(z.object({ channel: z.string(), kind: z.string(), count })),
  jobs: z.array(z.object({ name: z.string(), runs: count, failures: count, last_error: z.string().nullable() })),
});
export type RunFacts = z.infer<typeof factsSchema>;

const cell = (value: unknown): string => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const row = (cells: readonly unknown[]): string => `| ${cells.map(cell).join(' | ')} |`;

function table(head: readonly string[], rows: readonly (readonly unknown[])[]): string[] {
  if (rows.length === 0) return ['None.'];
  return [row(head), row(head.map(() => '---')), ...rows.map(row)];
}

function invariantStatus(check: RunFacts['invariants'][number]): string {
  if (check.error > 0) return 'error';
  return check.fail > 0 ? `FAIL from night ${String(check.first_fail)}` : 'pass';
}

function invariantsSection(facts: RunFacts): string[] {
  const rows = facts.invariants.map((check) => [
    check.code, CODES[check.code]?.area ?? '?', check.title, invariantStatus(check), check.pass, check.fail, check.error,
    check.fail + check.error > 0 ? JSON.stringify(check.sample).slice(0, 160) : '',
  ]);
  return ['## Invariants', '', ...table(['Code', 'Area', 'Check', 'Status', 'Pass', 'Fail', 'Error', 'First sample'], rows)];
}

function nightsSection(facts: RunFacts): string[] {
  const rows = facts.nights.map((night) => [night.n, night.date, night.expected, night.seated, night.orders, night.messages, night.refused]);
  return ['## Night by night', '', ...table(['Night', 'Date', 'Expected', 'Seated', 'Orders', 'Messages', 'Refused'], rows)];
}

export function renderReport(facts: RunFacts): string {
  const { run } = facts;
  const failing = facts.invariants.filter((check) => check.fail + check.error > 0).length;
  return [
    `# 180-day simulation: run ${run.id}`,
    '',
    `Main ${run.main}, harness ${run.harness}. ${String(run.nights)} nights in ${String(Math.round(run.seconds / 60))} minutes. ` +
      `${String(facts.invariants.length)} checks, ${String(failing)} failing or erroring.`,
    '',
    ...invariantsSection(facts),
    '',
    '## Refusals by code',
    '',
    ...table(['Action', 'Code', 'Message', 'Count', 'Expected'], facts.refusals.map((r) => [r.action, r.state, r.message, r.count, r.expected ? 'yes' : ''])),
    '',
    '## Messages by kind',
    '',
    ...table(['Channel', 'Kind', 'Count'], facts.messages.map((m) => [m.channel, m.kind, m.count])),
    '',
    '## Scheduled jobs',
    '',
    ...table(['Job', 'Runs', 'Failures', 'Last error'], facts.jobs.map((j) => [j.name, j.runs, j.failures, j.last_error ?? ''])),
    '',
    ...nightsSection(facts),
    '',
  ].join('\n');
}
