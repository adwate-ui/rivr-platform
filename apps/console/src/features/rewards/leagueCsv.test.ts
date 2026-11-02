import { describe, expect, it } from 'vitest';
import { parseLeagueCsv } from './leagueCsv.ts';

describe('parseLeagueCsv', () => {
  it('reads member numbers and points, skipping a first line of headings and blank lines', () => {
    const csv = parseLeagueCsv('Member number,Points\r\n1042,30\r\n\r\n7, 250\n');
    expect(csv.problems).toEqual([]);
    expect(csv.rows).toEqual([{ memberNumber: 1042, points: 30n, line: 2 }, { memberNumber: 7, points: 250n, line: 4 }]);
  });

  it('reads a spreadsheet\'s quotes, semicolons and tabs, and a leading byte-order mark', () => {
    expect(parseLeagueCsv('\uFEFF"1042";"30"\n7\t40').rows.map((row) => row.memberNumber)).toEqual([1042, 7]);
  });

  it('names each line that is not a member number and 1 to 10,00,000 points', () => {
    const csv = parseLeagueCsv('1042,30\nKabir,10\n7,0\n8,1000001\n9,12.5\n10,20,extra');
    expect(csv.rows).toHaveLength(1);
    expect(csv.problems).toEqual([2, 3, 4, 5, 6].map((line) => ({ kind: 'badLine', line })));
  });

  it('names a member listed twice, keeping the first', () => {
    const csv = parseLeagueCsv('1042,30\n1042,5');
    expect(csv.rows).toEqual([{ memberNumber: 1042, points: 30n, line: 1 }]);
    expect(csv.problems).toEqual([{ kind: 'twice', line: 2, number: 1042 }]);
  });

  it('says when a file is empty, or holds more than 500 members', () => {
    expect(parseLeagueCsv('Member number,Points\n').problems).toEqual([{ kind: 'empty' }]);
    const many = Array.from({ length: 501 }, (_, index) => `${String(index + 1)},10`).join('\n');
    expect(parseLeagueCsv(many).problems).toEqual([{ kind: 'tooMany' }]);
  });
});
