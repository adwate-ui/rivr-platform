import { describe, expect, it } from 'vitest';
import { istParts } from './tournaments.ts';

describe('a moment for a form', () => {
  it('gives its IST day and time', () => {
    expect(istParts(new Date('2026-11-22T14:30:00Z'))).toEqual({ day: '2026-11-22', time: '20:00' });
    expect(istParts(new Date('2026-11-22T20:00:00Z'))).toEqual({ day: '2026-11-23', time: '01:30' });
  });
});
