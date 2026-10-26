import { describe, expect, it } from 'vitest';
import { formatMinutesSeconds, formatStages, parseMinutesSeconds, parseStages } from './stages.ts';

describe('the golden files’ blind-structure notation', () => {
  it('reads levels with and without an ante, and breaks', () => {
    expect(parseStages('100/200 ante 200 for 20; break 10; 150/300 for 15')).toEqual([
      { kind: 'level', smallBlind: 100, bigBlind: 200, ante: 200, minutes: 20 },
      { kind: 'break', minutes: 10 },
      { kind: 'level', smallBlind: 150, bigBlind: 300, ante: 0, minutes: 15 },
    ]);
  });

  it('writes a structure back as it was read', () => {
    const notation = '100/200 ante 200 for 20; break 10; 150/300 for 15';
    expect(formatStages(parseStages(notation))).toBe(notation);
  });

  it('refuses anything else', () => {
    expect(() => parseStages('100-200 for 20')).toThrow(/is not a level or a break/);
  });

  it('reads and writes minutes and seconds', () => {
    expect(parseMinutesSeconds('138:20')).toBe(8300);
    expect(formatMinutesSeconds(700)).toBe('11:40');
    expect(formatMinutesSeconds(1)).toBe('0:01');
    expect(() => parseMinutesSeconds('ten')).toThrow(/is not minutes:seconds/);
  });
});
