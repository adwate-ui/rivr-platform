import { describe, expect, it } from 'vitest';
import { tanSchema } from './venueConfig.ts';
import { holdingSchema, shareholderSchema } from './shareholding.ts';

const HOLDER = '00000000-0000-4000-8000-0000000000a1';

describe('the shareholding register (#97)', () => {
  it('adds a partner or an investor, named', () => {
    expect(shareholderSchema.safeParse({ name: 'Seed Fund', kind: 'investor' }).success).toBe(true);
    expect(shareholderSchema.safeParse({ name: ' ', kind: 'partner' }).success).toBe(false);
    expect(shareholderSchema.safeParse({ name: 'A friend', kind: 'friend' }).success).toBe(false);
  });

  it('reads a share in percent as basis points, up to two decimals and never above 100', () => {
    const percent = (typed: string) => holdingSchema.safeParse({ shareholderId: HOLDER, percent: typed, effectiveFrom: '2026-06-01', note: '' });
    expect(percent('60').data?.percent).toBe(6000);
    expect(percent('12.5').data?.percent).toBe(1250);
    expect(percent('0.01').data?.percent).toBe(1);
    expect(percent('100').data?.percent).toBe(10000);
    expect(percent('0').data?.percent).toBe(0);
    for (const typed of ['100.01', '101', '12.345', '-5', '', 'half']) expect(percent(typed).success).toBe(false);
  });

  it('takes the day it starts as a date', () => {
    expect(holdingSchema.safeParse({ shareholderId: HOLDER, percent: '50', effectiveFrom: '1 June', note: '' }).success).toBe(false);
  });
});

describe('a TAN (#93)', () => {
  it('is four letters, five digits and a letter, in capitals', () => {
    expect(tanSchema.parse(' delr12345e ')).toBe('DELR12345E');
    expect(tanSchema.safeParse('DELR1234E').success).toBe(false);
    expect(tanSchema.safeParse('27AAPFU0939F1ZV').success).toBe(false);
  });
});
