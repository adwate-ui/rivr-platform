import { describe, expect, it } from 'vitest';
import { offerDraft, offerFrom, offerText } from './offer.ts';

describe('a host queue offer', () => {
  it('is a promotion effect: points, a bonus in whole chips, a spin or a message; or none', () => {
    expect(offerFrom('points', ' 500 ')).toEqual({ kind: 'points', points: 500 });
    expect(offerFrom('bonus', '2000')).toEqual({ kind: 'bonus', amount_paise: 200000, expires_days: 30 });
    expect(offerFrom('spin', '')).toEqual({ kind: 'spin' });
    expect(offerFrom('message', 'We miss you at the table')).toEqual({ kind: 'message', text: 'We miss you at the table' });
    expect(offerFrom('none', 'anything')).toBeNull();
  });

  it('is not one when what was typed is not: no amount, or a bonus not in whole chips', () => {
    expect(offerFrom('points', '')).toBeUndefined();
    expect(offerFrom('points', 'lots')).toBeUndefined();
    expect(offerFrom('bonus', '2025')).toBeUndefined();
    expect(offerFrom('message', '  ')).toBeUndefined();
  });

  it('reads in words', () => {
    expect(offerText({ kind: 'points', points: 500 })).toBe('500 points');
    expect(offerText({ kind: 'bonus', amount_paise: 200000, expires_days: 30 })).toBe('₹2,000 bonus');
    expect(offerText({ kind: 'spin' })).toBe('a free spin');
    expect(offerText({ kind: 'cab_eligibility' })).toBe('an offer');
  });

  it('shows an offer already made again, so saving the call keeps it', () => {
    for (const offer of [{ kind: 'points', points: 500 }, { kind: 'bonus', amount_paise: 200000, expires_days: 30 }, { kind: 'spin' }, { kind: 'message', text: 'Come back' }] as const) {
      const draft = offerDraft(offer);
      expect(offerFrom(draft.kind, draft.value)).toEqual(offer);
    }
    expect(offerDraft(null)).toEqual({ kind: 'none', value: '' });
  });
});
