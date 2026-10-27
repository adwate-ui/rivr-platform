import { describe, expect, it } from 'vitest';
import { leagueSeasonSchema, rewardItemSchema } from './rewards.ts';

const CAP = { kind: 'merchandise', name: ' RIVR cap ', detail: 'At the host desk', price: '4000', stock: '', isLive: true };
const STAY = { kind: 'hotel_night', name: 'Partner hotel', detail: 'The host confirms by text', price: '2', stock: '6', isLive: true };

describe('rewardItemSchema', () => {
  it('reads the price as a whole number and a blank stock as no limit', () => {
    expect(rewardItemSchema.parse(CAP)).toEqual({ ...CAP, name: 'RIVR cap', price: 4000, stock: null });
    expect(rewardItemSchema.parse({ ...CAP, stock: '12' }).stock).toBe(12);
  });

  it('refuses a price of nothing, a fraction or more than a crore, and a kind the catalogue does not hold', () => {
    for (const price of ['0', '12.5', '100000000', '']) expect(rewardItemSchema.safeParse({ ...CAP, price }).success).toBe(false);
    expect(rewardItemSchema.safeParse({ ...CAP, kind: 'cash' }).success).toBe(false);
    expect(rewardItemSchema.safeParse({ ...CAP, stock: '-1' }).success).toBe(false);
    expect(rewardItemSchema.safeParse({ ...CAP, detail: ' ' }).success).toBe(false);
  });
});

describe('rewardItemSchema for a hotel night', () => {
  it('prices it in whole nights, from one to a thousand', () => {
    expect(rewardItemSchema.parse(STAY)).toMatchObject({ kind: 'hotel_night', price: 2, stock: 6 });
    expect(rewardItemSchema.safeParse({ ...STAY, price: '1000' }).success).toBe(true);
    expect(rewardItemSchema.safeParse({ ...STAY, price: '1001' }).success).toBe(false);
    expect(rewardItemSchema.safeParse({ ...CAP, price: '1001' }).success).toBe(true);
  });
});

describe('leagueSeasonSchema', () => {
  it('takes a name and months in order', () => {
    expect(leagueSeasonSchema.parse({ name: ' Season one ', firstMonth: '2026-11', lastMonth: '2027-04' }))
      .toEqual({ name: 'Season one', firstMonth: '2026-11', lastMonth: '2027-04' });
    expect(leagueSeasonSchema.safeParse({ name: 'One month', firstMonth: '2026-11', lastMonth: '2026-11' }).success).toBe(true);
  });

  it('refuses a last month before the first, and anything but a month', () => {
    expect(leagueSeasonSchema.safeParse({ name: 'Back', firstMonth: '2027-04', lastMonth: '2026-11' }).success).toBe(false);
    expect(leagueSeasonSchema.safeParse({ name: 'Day', firstMonth: '2026-11-01', lastMonth: '2026-12' }).success).toBe(false);
    expect(leagueSeasonSchema.safeParse({ name: 'Thirteen', firstMonth: '2026-13', lastMonth: '2026-13' }).success).toBe(false);
  });
});
