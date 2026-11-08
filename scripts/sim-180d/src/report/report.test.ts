import { describe, expect, it } from 'vitest';
import { factsSchema, renderReport, type RunFacts } from './report.ts';

const facts: RunFacts = factsSchema.parse({
  run: { id: 'r1', main: 'aaaa1111', harness: 'bbbb2222', nights: 2, seconds: 600 },
  nights: [{ n: 1, date: '2026-11-15', expected: 40, seated: 37, orders: 16, messages: 120, refused: 9 }],
  invariants: [
    { code: 'L01', title: 'Double entry', pass: 2, fail: 0, error: 0, first_fail: null, sample: [] },
    { code: 'N01', title: 'Bonus | chips', pass: 1, fail: 1, error: 0, first_fail: 2, sample: [{ member_id: 'm' }] },
    { code: 'X03', title: 'Calls', pass: 0, fail: 0, error: 2, first_fail: null, sample: { error: 'boom' } },
  ],
  refusals: [{ action: 'door.scan', state: 'RVCTS', message: 'Call time not complete', count: '3', expected: false }],
  messages: [],
  jobs: [{ name: 'points-nightly', runs: 2, failures: 0, last_error: null }],
});

describe('renderReport', () => {
  const text = renderReport(facts);

  it('summarises the run', () => {
    expect(text).toContain('# 180-day simulation: run r1');
    expect(text).toContain('Main aaaa1111, harness bbbb2222. 2 nights in 10 minutes. 3 checks, 2 failing or erroring.');
  });

  it('gives each check its status and area, and a sample for a failing one', () => {
    expect(text).toContain('| L01 | ledger | Double entry | pass | 2 | 0 | 0 |  |');
    expect(text).toContain('| N01 | features | Bonus \\| chips | FAIL from night 2 | 1 | 1 | 0 | [{"member_id":"m"}] |');
    expect(text).toContain('| X03 | harness | Calls | error |');
  });

  it('lists refusals, jobs and nights, and says None for an empty section', () => {
    expect(text).toContain('| door.scan | RVCTS | Call time not complete | 3 |  |');
    expect(text).toContain('| points-nightly | 2 | 0 |  |');
    expect(text).toContain('| 1 | 2026-11-15 | 40 | 37 | 16 | 120 | 9 |');
    expect(text).toContain('## Messages by kind\n\nNone.');
  });
});
