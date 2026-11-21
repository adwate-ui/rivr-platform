import type { BonusFileMember } from '@rivr/db/bonusFile';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { keysOf, memberKeyOf, previewOf, readBonusFile } from './bonusFile.ts';

const HEADING = ['Member', 'Type', 'Chips', 'Reason'];

function member(key: string, fields: Partial<BonusFileMember> = {}): BonusFileMember {
  return {
    key, memberId: `m-${key}`, memberNumber: 1042, fullName: 'Ritika Das', inForce: fromPaise(100_000n), owed: fromPaise(0n), isOwn: false, isFrozen: false, ...fields,
  };
}

describe('memberKeyOf', () => {
  it('reads a mobile as +91 and ten digits, however it is written, and a member number as itself', () => {
    expect(['98765 43210', '+91 98765-43210', '919876543210', '(987) 654 3210'].map(memberKeyOf)).toEqual(Array(4).fill('+919876543210'));
    expect(['1042', '0042', ' 7 '].map(memberKeyOf)).toEqual(['1042', '42', '7']);
  });

  it('reads nothing else', () => {
    expect(['', '0', '5876543210', '123456789', 'Ritika', '+1 9876543210', '1042.5'].map(memberKeyOf)).toEqual(Array(7).fill(null));
  });
});

describe('readBonusFile', () => {
  it('finds the columns by their headings in any order and case, and reads each line, passing over empty ones', () => {
    const read = readBonusFile([['reason', 'CHIPS', 'Kind', 'Mobile', 'Price'], ['Diwali gift', '2,000', 'Add', '9876543210', '9'], [''], ['At the bar', '₹500', 'redeem', '1042']]);
    expect(read).toEqual({ fileProblem: null, lines: [
      { line: 2, ok: true, key: '+919876543210', kind: 'add', chips: 2000, reason: 'Diwali gift' },
      { line: 4, ok: true, key: '1042', kind: 'use', chips: 500, reason: 'At the bar' },
    ] });
  });

  it('says what is wrong with a line: the member, the type, the chips, then the reason', () => {
    const read = readBonusFile([HEADING, ['Ritika', 'add', '50', 'Gift'], ['1042', 'gift', '50', 'Gift'], ['1042', 'use', '75', 'Gift'], ['1042', 'use', '1,00,050', 'Gift'],
      ['1042', 'use', '50', 'ok'], ['1042', 'use', '50', 'x'.repeat(201)]]);
    expect(read.lines.map((line) => (line.ok ? 'ok' : line.problem))).toEqual(['member', 'type', 'chips', 'chips', 'reason', 'reason']);
  });

  it('says what is wrong with the whole file: no columns, no lines, or too many', () => {
    expect(readBonusFile([])).toEqual({ lines: [], fileProblem: 'empty' });
    expect(readBonusFile([[''], ['']])).toEqual({ lines: [], fileProblem: 'empty' });
    expect(readBonusFile([['Member', 'Chips'], ['1042', '50']])).toEqual({ lines: [], fileProblem: 'columns' });
    expect(readBonusFile([HEADING, ['', '', '', '']])).toEqual({ lines: [], fileProblem: 'empty' });
    expect(readBonusFile([HEADING, ...Array.from({ length: 501 }, () => ['1042', 'add', '50', 'Gift'])])).toEqual({ lines: [], fileProblem: 'tooMany' });
    expect(readBonusFile([HEADING, ...Array.from({ length: 500 }, () => ['1042', 'add', '50', 'Gift'])]).lines).toHaveLength(500);
  });

  it('names each member once for the preview to read', () => {
    expect(keysOf(readBonusFile([HEADING, ['1042', 'add', '50', 'Gift'], ['1042', 'use', '50', 'Gift'], ['bad', 'use', '50', 'Gift'], ['9876543210', 'use', '50', 'Gift']])))
      .toEqual(['1042', '+919876543210']);
  });
});

describe('previewOf', () => {
  it('gives each line its member, and the lines to save with the totals once every line is right', () => {
    const read = readBonusFile([HEADING, ['1042', 'add', '500', 'Diwali gift'], ['1042', 'use', '1,500', 'At the bar']]);
    const preview = previewOf(read, [member('1042')]);
    expect(preview.lines.map((line) => line.ok)).toEqual([true, true]);
    expect(preview.toSave).toEqual({
      lines: [{ line: 2, memberId: 'm-1042', kind: 'add', chips: 500, reason: 'Diwali gift' }, { line: 3, memberId: 'm-1042', kind: 'use', chips: 1500, reason: 'At the bar' }],
      added: 50_000n, used: 150_000n,
    });
  });

  it('marks a line for no member, one\'s own record, frozen, Bonus owed, or more than they hold by then; and saves nothing', () => {
    const read = readBonusFile([HEADING, ['7', 'add', '50', 'Gift'], ['8', 'add', '50', 'Gift'], ['6', 'add', '50', 'Gift'], ['9', 'use', '50', 'At the bar'],
      ['1042', 'use', '1,050', 'At the bar'], ['1042', 'use', '1,000', 'At the bar'], ['oops', 'use', '50', 'At the bar']]);
    const preview = previewOf(read, [member('8', { isOwn: true }), member('6', { memberId: 'm6', isFrozen: true }), member('9', { memberId: 'm9', owed: fromPaise(5_000n) }),
      member('1042')]);
    expect(preview.lines.map((line) => (line.ok ? 'ok' : line.problem))).toEqual(['unknown', 'own', 'frozen', 'owed', 'short', 'ok', 'member']);
    expect(preview.toSave).toBeNull();
  });
});
