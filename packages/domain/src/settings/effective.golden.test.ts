import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import settingsJson from '@rivr/testing/golden/settings.json';
import { describe, expect, it } from 'vitest';
import { parseRupees } from '../money/parse-rupees.ts';
import { ruleAt } from './effective.ts';

const golden = readGolden(settingsJson);

/** A fixture time such as "2026-10-20 10:00 IST" as ISO 8601 in India time. */
function isoOf(text: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?) IST$/.exec(text);
  if (!match?.[1] || !match[2]) throw new Error(`Golden time "${text}" is not "YYYY-MM-DD HH:MM IST"`);
  return `${match[1]}T${match[2].length === 5 ? `${match[2]}:00` : match[2]}+05:30`;
}

/** A fixture amount such as "₹7,000", as a string of paise for a readable comparison. */
function paiseOf(text: string): string {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value.toString();
}

/** "since opening = ₹6,000 | 2026-10-20 10:00 IST = ₹7,000" as rules with a start and a cap. */
function historyOf(text: string) {
  return text.split(' | ').map((entry) => {
    const [from = '', cap = ''] = entry.split(' = ');
    return { effectiveFrom: from === 'since opening' ? null : isoOf(from), cap: paiseOf(cap) };
  });
}

describe('Effective-dated rule golden fixtures (packages/testing/golden/settings.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['lookup'])).not.toThrow();
  });

  it.each(casesFor(golden, 'lookup'))('%s', (_description, goldenCase) => {
    const found = ruleAt(historyOf(goldenInput(goldenCase, 'history')), new Date(isoOf(goldenInput(goldenCase, 'at'))));
    const cap = goldenExpected(goldenCase, 'cap');
    const next = goldenExpected(goldenCase, 'next');
    expect(found.inForce?.cap ?? null).toBe(cap === 'none' ? null : paiseOf(cap));
    expect(found.scheduled[0]?.effectiveFrom ?? null).toBe(next === 'none' ? null : isoOf(next));
  });
});
