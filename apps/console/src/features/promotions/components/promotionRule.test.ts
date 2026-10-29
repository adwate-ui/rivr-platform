import type { PromotionAwaitingApproval } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { approvalLines } from './promotionRule.ts';

const waiting = (overrides: Partial<PromotionAwaitingApproval>): PromotionAwaitingApproval => ({
  id: 'p1', name: 'Ladies\' Night drinks', detail: 'A welcome drink', runs: 'Fridays', requestedBy: 'Ishita Bose',
  requestedAt: '2026-10-27T10:00:00Z', isMine: false, rules: [], perPlayer: null, budget: { paise: null, count: null, period: 'promotion' },
  websiteRules: [], websiteQuestions: [], ...overrides,
});
const STAKES = [{ code: 'nlh_100_200', name: 'NLH 100/200' }];

describe('what a waiting promotion does, for its approver', () => {
  it('says what the stored rule gives, whatever the card words say', () => {
    const lines = approvalLines(waiting({
      rules: [{ trigger: 'date_window', conditions: {}, effect: { kind: 'bonus', amount_paise: 1_000_000_000, expires_days: 90 } }],
    }), STAKES);
    expect(lines).toEqual([
      'Once each club day in its window: a ₹1,00,00,000 bonus, ending after 90 days',
      'Who and when: anyone, any time',
      'No limit per member',
      'No budget: it gives without a cap',
    ]);
  });

  it('names who and when, the per-member limit and the budget', () => {
    const lines = approvalLines(waiting({
      rules: [{
        trigger: 'buy_in',
        conditions: { stakes: ['nlh_100_200'], days: [5, 2], from: '22:00', until: '04:00', first_n: { count: 2, per: 'table' } },
        effect: { kind: 'bonus', percent_bps: 2000, cap_paise: 500_000, expires_days: 7 },
      }],
      perPlayer: { limit: 1, period: 'day' },
      budget: { paise: 5_000_000n, count: 100, period: 'promotion' },
    }), STAKES);
    expect(lines).toEqual([
      'On a buy-in: a bonus of 20% of the buy-in, up to ₹5,000, ending after 7 days',
      'Who and when: at NLH 100/200 · on Tuesday and Friday · from 22:00 to 04:00 · the first 2 at each table',
      'At most 1 per member each club day',
      'Budget: ₹50,000 or 100 grants, whichever comes first',
    ]);
  });

  it('describes points, prizes and the rest', () => {
    const lines = approvalLines(waiting({
      rules: [
        { trigger: 'hours_played', conditions: { call_time_complete: true }, effect: { kind: 'points', multiplier_percent: 200 } },
        { trigger: 'hand_logged', conditions: { hands: ['royal_flush'] }, effect: { kind: 'physical_prize', prize: 'A watch', value_paise: 2_500_000 } },
        { trigger: 'check_in', conditions: { new_player: true }, effect: { kind: 'spin' } },
      ],
      perPlayer: { limit: 3, period: 'promotion' },
      budget: { paise: null, count: 50, period: 'month' },
    }), STAKES);
    expect(lines).toEqual([
      'For hours played: 2 times the points earned',
      'Who and when: once call time is complete',
      'When a hand is logged: A watch, worth ₹25,000',
      'Who and when: for a royal flush',
      'On a check-in: a spin of the wheel',
      'Who and when: new players only',
      'At most 3 per member in all',
      'Budget: 50 grants, each month',
    ]);
  });

  it('says a card-only template gives nothing', () => {
    expect(approvalLines(waiting({ rules: [] }), STAKES)).toEqual([
      'Card only: the engine gives nothing, the floor runs it', 'No limit per member', 'No budget: it gives without a cap',
    ]);
  });

  it('cannot be read when its rules are not ones the console knows', () => {
    expect(approvalLines(waiting({ rules: null }), STAKES)).toBeNull();
  });
});
