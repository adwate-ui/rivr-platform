import { describe, expect, it } from 'vitest';
import { offerDraft, offerFrom } from './offer.ts';

describe('a host queue offer', () => {
  it('is a promotion effect: a bonus in whole chips or a message; or none', () => {
    expect(offerFrom('bonus', '2000')).toEqual({ kind: 'bonus', amount_paise: 200000 });
    expect(offerFrom('message', 'We miss you at the table')).toEqual({ kind: 'message', text: 'We miss you at the table' });
    expect(offerFrom('none', 'anything')).toBeNull();
  });

  it('is not one when what was typed is not: no amount, or a bonus not in whole chips', () => {
    expect(offerFrom('bonus', '')).toBeUndefined();
    expect(offerFrom('bonus', 'lots')).toBeUndefined();
    expect(offerFrom('bonus', '2025')).toBeUndefined();
    expect(offerFrom('message', '  ')).toBeUndefined();
  });

  it('shows an offer already made again, so saving the call keeps it', () => {
    for (const offer of [{ kind: 'bonus', amount_paise: 200000 }, { kind: 'message', text: 'Come back' }] as const) {
      const draft = offerDraft(offer);
      expect(offerFrom(draft.kind, draft.value)).toEqual(offer);
    }
    expect(offerDraft(null)).toEqual({ kind: 'none', value: '' });
  });
});
