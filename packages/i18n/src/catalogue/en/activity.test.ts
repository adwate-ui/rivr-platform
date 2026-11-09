import { describe, expect, it } from 'vitest';
import { activityActionWord, activityEntityWord } from './activity.ts';

describe('the audit log in words (F-034)', () => {
  it('says what was done and to what', () => {
    expect(activityActionWord('update')).toBe('Changed');
    expect(activityActionWord('points.lock')).toBe('Locked points');
    expect(activityEntityWord('member_tier_change')).toBe('Tier change');
    expect(activityEntityWord('bonus_grant')).toBe('Bonus chips given');
    expect(activityEntityWord('points_earning')).toBe('Points earned');
  });

  it('never shows a code it does not know', () => {
    expect(activityActionWord('made.up')).toBe('Recorded');
    expect(activityEntityWord('made_up')).toBe('Record');
  });
});
