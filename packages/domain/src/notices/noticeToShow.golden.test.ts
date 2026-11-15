import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import noticeJson from '@rivr/testing/golden/noticeToShow.json';
import { describe, expect, it } from 'vitest';
import { homeTopSlot, noticeToShow } from './index.ts';

const golden = readGolden(noticeJson);

/** The file's notices, in the order they are listed: each its id and when it started. */
function listed(text: string): { id: string; startsAt: Date }[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('The notices are a list');
  return parsed.map((one: unknown) => {
    if (typeof one !== 'object' || one === null || !('id' in one) || !('startsAt' in one)) throw new Error('A notice has an id and a start');
    return { id: String(one.id), startsAt: new Date(String(one.startsAt)) };
  });
}

describe('The notice that shows, golden fixtures (packages/testing/golden/noticeToShow.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['show'])).not.toThrow();
  });

  it.each(casesFor(golden, 'show'))('%s', (_description, goldenCase) => {
    const notices = listed(goldenInput(goldenCase, 'notices'));
    expect(noticeToShow(notices)?.id ?? '').toBe(goldenExpected(goldenCase, 'id'));
    // Home's top slot shows that same notice once the ID check is done and no seat is called or taken.
    const slot = homeTopSlot({ seat: 'none', isIdCheckDone: true, notices });
    expect(slot?.kind === 'notice' ? slot.notice.id : '').toBe(goldenExpected(goldenCase, 'id'));
  });
});
