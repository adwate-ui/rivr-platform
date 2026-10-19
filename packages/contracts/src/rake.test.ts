import { describe, expect, it } from 'vitest';
import { rakeChangeSchema } from './rake.ts';

const CHANGE = { tableTypeCode: 'nlh_100_200', ratePercent: '5', cap: '7000', on: '2026-10-20', at: '10:00', reason: ' Weekend cap ' };

describe('a rake change as the console schedules it (#37)', () => {
  it('gives the rake.config values and the time in India', () => {
    expect(rakeChangeSchema.parse(CHANGE)).toEqual({
      tableTypeCode: 'nlh_100_200', rateBasisPoints: 500, capPaise: 700000, effectiveFrom: '2026-10-20T10:00:00+05:30', reason: 'Weekend cap',
    });
    expect(rakeChangeSchema.parse({ ...CHANGE, ratePercent: '4.75' }).rateBasisPoints).toBe(475);
  });

  it('takes a rate up to 10%, with at most two decimals', () => {
    expect(rakeChangeSchema.safeParse({ ...CHANGE, ratePercent: '10' }).success).toBe(true);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, ratePercent: '10.5' }).success).toBe(false);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, ratePercent: '4.755' }).success).toBe(false);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, ratePercent: '' }).success).toBe(false);
  });

  it('takes a cap of whole ₹50 chips up to ₹1,00,000', () => {
    expect(rakeChangeSchema.safeParse({ ...CHANGE, cap: '0' }).success).toBe(true);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, cap: '100000' }).success).toBe(true);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, cap: '7010' }).success).toBe(false);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, cap: '100050' }).success).toBe(false);
  });

  it('takes a date, a 24-hour time and a reason', () => {
    expect(rakeChangeSchema.safeParse({ ...CHANGE, at: '24:00' }).success).toBe(false);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, at: '9:00' }).success).toBe(false);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, on: '20 Oct' }).success).toBe(false);
    expect(rakeChangeSchema.safeParse({ ...CHANGE, reason: '  ' }).success).toBe(false);
  });
});
