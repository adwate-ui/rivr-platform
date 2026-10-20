import { promotionConditionsSchema, promotionEffectSchema, type PromotionBuilder } from '@rivr/contracts/promotions';
import { describe, expect, it } from 'vitest';
import { promotionDraft } from './builder.ts';
import { promotionApplies } from './promotions.ts';

const FLOW_7: PromotionBuilder = { days: [4], from: '14:00', until: '20:00', stake: 'nlh_100_200', reward: 'double_points', limit: 'none' };
const FACTS = {
  tierId: null, tableId: 'table-2', visitsInMonth: 0, daysSinceLastVisit: null, isCallTimeComplete: false, grantedToday: 0,
  grantedTodayAtTable: 0, hoursPlayed: 1, hand: null,
};

describe('promotions builder (#84)', () => {
  it('makes flow 7 double points on hours played, Thursdays 14:00 to 20:00 at 100/200, with no limit', () => {
    const draft = promotionDraft(FLOW_7);
    expect(draft).toEqual({
      rule: {
        trigger: 'hours_played',
        conditions: { days: [4], from: '14:00', until: '20:00', stakes: ['nlh_100_200'] },
        effect: { kind: 'points', multiplier_percent: 200 },
      },
      perPlayer: null,
    });
    const at100 = { ...FACTS, stake: 'nlh_100_200' };
    expect(promotionApplies(draft.rule.conditions, { ...at100, at: new Date('2026-11-19T15:00:00+05:30') })).toBe(true);
    expect(promotionApplies(draft.rule.conditions, { ...at100, at: new Date('2026-11-19T20:00:00+05:30') })).toBe(false);
    expect(promotionApplies(draft.rule.conditions, { ...FACTS, stake: 'nlh_50_100', at: new Date('2026-11-19T15:00:00+05:30') })).toBe(false);
  });

  it('leaves out what was not chosen, so nothing chosen is every day and every stake', () => {
    expect(promotionDraft({ ...FLOW_7, days: [], from: null, until: null, stake: null }).rule.conditions).toEqual({});
  });

  it('gives triple points, or 10% of a buy-in as bonus for a week', () => {
    expect(promotionDraft({ ...FLOW_7, reward: 'triple_points' }).rule.effect).toEqual({ kind: 'points', multiplier_percent: 300 });
    const bonus = promotionDraft({ ...FLOW_7, reward: 'buy_in_bonus' }).rule;
    expect([bonus.trigger, bonus.effect]).toEqual(['buy_in', { kind: 'bonus', percent_bps: 1000, expires_days: 7 }]);
  });

  it('limits to the first 50 members a club day, one each, or once for each member', () => {
    const first50 = promotionDraft({ ...FLOW_7, limit: 'first_50' });
    expect([first50.rule.conditions.first_n, first50.perPlayer]).toEqual([{ count: 50, per: 'day' }, { limit: 1, period: 'day' }]);
    expect(promotionDraft({ ...FLOW_7, limit: 'once_per_member' }).perPlayer).toEqual({ limit: 1, period: 'promotion' });
  });

  it('makes only rules the engine and the database accept, days in order', () => {
    const draft = promotionDraft({ ...FLOW_7, days: [6, 2], limit: 'first_50', reward: 'buy_in_bonus' });
    expect(draft.rule.conditions.days).toEqual([2, 6]);
    expect(promotionConditionsSchema.safeParse(draft.rule.conditions).success).toBe(true);
    expect(promotionEffectSchema.safeParse(draft.rule.effect).success).toBe(true);
  });
});
