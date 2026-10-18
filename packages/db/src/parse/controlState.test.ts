import { describe, expect, it } from 'vitest';
import { NOTHING_ENGAGED, toControlState } from './controlState.ts';

const GURUGRAM = '00000000-0000-4000-8000-000000000001';
const PRACTICE = '00000000-0000-4000-8000-000000000002';
const control = (overrides: Partial<Parameters<typeof toControlState>[0][number]>) => ({
  venue_id: GURUGRAM, level: 'venue_freeze' as const, feature: null, member_id: null, released_at: null, ...overrides,
});

describe('toControlState', () => {
  it('reports nothing engaged when there are no rows', () => {
    expect(toControlState([])).toEqual(NOTHING_ENGAGED);
  });

  it('shows a venue freeze', () => {
    expect(toControlState([control({})]).isVenueFrozen).toBe(true);
  });

  it('ignores released controls', () => {
    expect(toControlState([control({ released_at: '2026-11-15T00:00:00Z' })])).toEqual(NOTHING_ENGAGED);
  });

  it('lists killed features', () => {
    const state = toControlState([control({ level: 'feature_kill', feature: 'withdrawals' }), control({ level: 'feature_kill', feature: 'credit' })]);
    expect(state.killedFeatures).toEqual(['withdrawals', 'credit']);
    expect(state.isVenueFrozen).toBe(false);
  });

  it('shows a member freeze', () => {
    expect(toControlState([control({ level: 'member_freeze', member_id: 'm' })]).isMemberFrozen).toBe(true);
  });

  it('limits itself to one venue when asked', () => {
    expect(toControlState([control({ venue_id: PRACTICE })], GURUGRAM)).toEqual(NOTHING_ENGAGED);
    expect(toControlState([control({ venue_id: PRACTICE })], PRACTICE).isVenueFrozen).toBe(true);
  });
});
