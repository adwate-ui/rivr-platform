import type { BonusFileMember } from '@rivr/db/bonusFile';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { clockOf, nightOf, readVisitFile, visitKeysOf, visitPreviewOf } from './visitFile.ts';

const HEADING = ['Member', 'Date', 'Check-in', 'Check-out', 'Table', 'Reason'];
const RITIKA: BonusFileMember = {
  key: '1042', memberId: 'm1', memberNumber: 1042, fullName: 'Ritika Das', inForce: fromPaise(0n), owed: fromPaise(0n), isOwn: false, isFrozen: false,
};
const TABLE_5 = { id: 't5', name: 'Table 5' };

describe('a visit file (the owner, 25 Nov)', () => {
  it('reads the club night as written, or as an Excel date cell', () => {
    expect(nightOf('2026-11-20')).toBe('2026-11-20');
    expect(nightOf('20/11/2026')).toBe('2026-11-20');
    expect(nightOf('5-1-2027')).toBe('2027-01-05');
    expect(nightOf('46346')).toBe('2026-11-20');
    expect(nightOf('Friday')).toBeNull();
  });

  it('reads a time as written, with am or pm, or as an Excel time cell', () => {
    expect(clockOf('20:00')).toBe('20:00');
    expect(clockOf('8:05 PM')).toBe('20:05');
    expect(clockOf('12:30 am')).toBe('00:30');
    expect(clockOf('23:30:00')).toBe('23:30');
    expect(clockOf('0.8333333333')).toBe('20:00');
    expect(clockOf('13:00 pm')).toBeNull();
    expect(clockOf('24:00')).toBeNull();
    expect(clockOf('8pm')).toBeNull();
  });

  it('reads each line by the columns named on the first, a check-out after midnight on the next morning, and says what is wrong', () => {
    const read = readVisitFile([
      HEADING,
      ['1042', '2026-11-20', '20:00', '02:30', 'Table 5', 'From the register'],
      ['', '', '', '', '', ''],
      ['1042', '2026-11-20', '23:00', '22:00', 'Table 5', 'From the register'],
      ['abc', '2026-11-20', '20:00', '23:00', 'Table 5', 'From the register'],
      ['1042', '2026-11-20', '20:00', '23:00', '', 'From the register'],
      ['1042', '2026-11-20', '20:00', '23:00', 'Table 5', 'no'],
    ]);
    expect(read.fileProblem).toBeNull();
    expect(read.lines[0]).toEqual({
      line: 2, ok: true, key: '1042', openedAt: new Date('2026-11-20T14:30:00Z'), closedAt: new Date('2026-11-20T21:00:00Z'), table: 'Table 5', reason: 'From the register',
    });
    expect(read.lines.slice(1).map((line) => (line.ok ? 'ok' : `${line.line}:${line.problem}`))).toEqual(['4:night', '5:member', '6:table', '7:reason']);
    expect(visitKeysOf(read)).toEqual(['1042']);
  });

  it('names a file with no columns, no lines or too many', () => {
    expect(readVisitFile([['Name', 'When']]).fileProblem).toBe('columns');
    expect(readVisitFile([]).fileProblem).toBe('empty');
    expect(readVisitFile([HEADING]).fileProblem).toBe('empty');
    const row = ['1042', '2026-11-20', '20:00', '23:00', 'Table 5', 'From the register'];
    expect(readVisitFile([HEADING, ...Array.from({ length: 501 }, () => row)]).fileProblem).toBe('tooMany');
  });

  it('saves only once every line has its member and its table, named in any case', () => {
    const read = readVisitFile([HEADING, ['1042', '2026-11-20', '20:00', '23:00', 'table 5', 'From the register']]);
    const preview = visitPreviewOf(read, [RITIKA], [TABLE_5]);
    expect(preview.toSave).toEqual([{ line: 2, memberId: 'm1', tableId: 't5', openedAt: new Date('2026-11-20T14:30:00Z'), closedAt: new Date('2026-11-20T17:30:00Z'), reason: 'From the register' }]);
    expect(visitPreviewOf(read, [], [TABLE_5]).lines[0]).toEqual({ line: 2, ok: false, problem: 'unknown' });
    expect(visitPreviewOf(read, [{ ...RITIKA, isOwn: true }], [TABLE_5]).lines[0]).toEqual({ line: 2, ok: false, problem: 'own' });
    expect(visitPreviewOf(read, [RITIKA], []).toSave).toBeNull();
  });
});
