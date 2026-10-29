import type { PromotionBuilder } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { rewardDetail, rewardTitle, runsText } from './promotionCopy.ts';

const STAKES = [{ code: 'nlh_50_100', name: 'NLH 50/100' }, { code: 'nlh_100_200', name: 'NLH 100/200' }];
const FLOW_7: PromotionBuilder = {
  days: [4], from: '14:00', until: '20:00', stake: 'nlh_100_200', reward: 'double_points', limit: 'none', bonus_cap_rupees: 5000,
};

describe('promotion copy (#84)', () => {
  it('words flow 7 as the cards say it', () => {
    expect(rewardTitle(FLOW_7)).toBe('Double points');
    expect(runsText(FLOW_7, STAKES)).toBe('NLH 100/200 · Thursday, 14:00 to 20:00');
  });

  it('says every stake and every day when none is chosen, and lists days in week order', () => {
    expect(runsText({ ...FLOW_7, days: [], from: null, until: null, stake: null }, STAKES)).toBe('All stakes · Every day');
    expect(runsText({ ...FLOW_7, days: [6, 2], from: null, until: null }, STAKES)).toBe('NLH 100/200 · Tuesday and Saturday');
    expect(runsText({ ...FLOW_7, days: [1, 2, 3, 4, 5, 6, 7], from: null, until: null }, STAKES)).toBe('NLH 100/200 · Every day');
    expect(rewardTitle({ ...FLOW_7, reward: 'buy_in_bonus' })).toBe('10% buy-in bonus');
  });

  it('tells players the limit', () => {
    expect(runsText({ ...FLOW_7, limit: 'once_per_member' }, STAKES)).toBe('NLH 100/200 · Thursday, 14:00 to 20:00 · Once per member');
    expect(runsText({ ...FLOW_7, limit: 'first_50' }, STAKES)).toBe('NLH 100/200 · Thursday, 14:00 to 20:00 · First 50 members a day');
  });

  it('tells players the most a buy-in bonus gives, and nothing for points', () => {
    expect(rewardDetail({ ...FLOW_7, reward: 'buy_in_bonus' })).toBe('Up to 5,000 bonus chips a buy-in');
    expect(rewardDetail({ ...FLOW_7, reward: 'buy_in_bonus', bonus_cap_rupees: 2000 })).toBe('Up to 2,000 bonus chips a buy-in');
    expect(rewardDetail(FLOW_7)).toBeUndefined();
  });
});
