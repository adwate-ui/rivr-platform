import { describe, expect, it } from 'vitest';
import { promotionBuilderSchema, promotionConditionsSchema, promotionEffectSchema } from './promotions.ts';

describe('promotion schemas (#83)', () => {
  it('takes no conditions, or any of them together', () => {
    expect(promotionConditionsSchema.safeParse({}).success).toBe(true);
    expect(promotionConditionsSchema.safeParse({ days: [2], from: '22:00', until: '04:00', first_n: { count: 5, per: 'table' } }).success).toBe(true);
    expect(promotionConditionsSchema.safeParse({ stakes: ['nlh_100_200'], min_visits_in_month: 4, call_time_complete: true }).success).toBe(true);
  });

  it('refuses an unknown condition, a day outside the week and half a window', () => {
    expect(promotionConditionsSchema.safeParse({ gender: 'f' }).success).toBe(false);
    expect(promotionConditionsSchema.safeParse({ days: [8] }).success).toBe(false);
    expect(promotionConditionsSchema.safeParse({ from: '14:00' }).success).toBe(false);
    expect(promotionConditionsSchema.safeParse({ from: '24:00', until: '02:00' }).success).toBe(false);
  });

  it('opens a window before it closes within the club day, which ends at 06:00', () => {
    expect(promotionConditionsSchema.safeParse({ from: '18:00', until: '06:00' }).success).toBe(true);
    expect(promotionConditionsSchema.safeParse({ from: '05:00', until: '07:00' }).success).toBe(false);
    expect(promotionConditionsSchema.safeParse({ from: '10:00', until: '10:00' }).success).toBe(false);
    expect(promotionConditionsSchema.safeParse({ from: '20:00', until: '14:00' }).success).toBe(false);
  });

  it('names hours played and the hands of a hand-logged rule', () => {
    expect(promotionConditionsSchema.safeParse({ min_hours: 2, hands: ['royal_flush', 'bad_beat'] }).success).toBe(true);
    expect(promotionConditionsSchema.safeParse({ hands: ['full_house'] }).success).toBe(false);
    expect(promotionConditionsSchema.safeParse({ min_hours: 0 }).success).toBe(false);
  });

  it('gives a bonus as an amount or a share, never both, in whole ₹50 chips', () => {
    expect(promotionEffectSchema.safeParse({ kind: 'bonus', percent_bps: 2000, cap_paise: 200_000, expires_days: 7 }).success).toBe(true);
    expect(promotionEffectSchema.safeParse({ kind: 'bonus', amount_paise: 100_000, expires_days: 30 }).success).toBe(true);
    expect(promotionEffectSchema.safeParse({ kind: 'bonus', amount_paise: 100_000, percent_bps: 2000, expires_days: 7 }).success).toBe(false);
    expect(promotionEffectSchema.safeParse({ kind: 'bonus', amount_paise: 102_000, expires_days: 7 }).success).toBe(false);
    expect(promotionEffectSchema.safeParse({ kind: 'bonus', percent_bps: 2000 }).success).toBe(false);
  });

  it('takes the builder\'s four blocks, a window whole and within the club day (#84)', () => {
    const flow7 = { days: [4], from: '14:00', until: '20:00', stake: 'nlh_100_200', reward: 'double_points', limit: 'none' };
    expect(promotionBuilderSchema.safeParse(flow7).success).toBe(true);
    expect(promotionBuilderSchema.safeParse({ ...flow7, days: [], from: null, until: null, stake: null }).success).toBe(true);
    expect(promotionBuilderSchema.safeParse({ ...flow7, until: null }).success).toBe(false);
    expect(promotionBuilderSchema.safeParse({ ...flow7, from: '22:00', until: '08:00' }).success).toBe(false);
    expect(promotionBuilderSchema.safeParse({ ...flow7, reward: 'free_lunch' }).success).toBe(false);
  });

  it('gives points, items and messages by kind', () => {
    expect(promotionEffectSchema.safeParse({ kind: 'points', multiplier_percent: 200 }).success).toBe(true);
    expect(promotionEffectSchema.safeParse({ kind: 'points', multiplier_percent: 100 }).success).toBe(false);
    expect(promotionEffectSchema.safeParse({ kind: 'cab_eligibility' }).success).toBe(true);
    expect(promotionEffectSchema.safeParse({ kind: 'jackpot_payout', pool: 'season', amount_paise: 500_000 }).success).toBe(true);
    expect(promotionEffectSchema.safeParse({ kind: 'message', text: '  ' }).success).toBe(false);
    expect(promotionEffectSchema.safeParse({ kind: 'cocktail' }).success).toBe(false);
  });
});
