import { describe, expect, it } from 'vitest';
import { activityActionWord, activityEntityWord } from './activity.ts';

describe('the audit log in words (F-034)', () => {
  it('says what was done and to what', () => {
    expect(activityActionWord('update')).toBe('Changed');
    expect(activityActionWord('points.lock')).toBe('Locked points');
    expect(activityActionWord('member.hours_reset')).toBe('Reset hours');
    expect(activityActionWord('bonus.approve')).toBe('Approved Bonus');
    expect(activityActionWord('bonus.use')).toBe('Used Bonus');
    expect(activityEntityWord('promotion_bonus_decision')).toBe('Bonus from promotions');
    expect(activityEntityWord('member_tier_change')).toBe('Tier change');
    expect(activityEntityWord('bonus_grant')).toBe('Bonus given');
    expect(activityEntityWord('points_earning')).toBe('Points earned');
  });

  it('never shows a code it does not know', () => {
    expect(activityActionWord('made.up')).toBe('Recorded');
    expect(activityEntityWord('made_up')).toBe('Record');
  });
});
