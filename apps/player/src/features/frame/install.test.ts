import { describe, expect, it } from 'vitest';
import { installOfferKind } from './install.ts';

const SECOND_VISIT = { visits: 2, isMember: true, installed: false, dismissed: false, canPrompt: true, isIphone: false };

describe('installOfferKind', () => {
  it('offers install on a member\'s second visit, through the browser where it can', () => {
    expect(installOfferKind(SECOND_VISIT)).toBe('prompt');
  });

  it('tells an iPhone how, where the browser cannot ask', () => {
    expect(installOfferKind({ ...SECOND_VISIT, canPrompt: false, isIphone: true })).toBe('ios');
  });

  it('never on the first visit, before sign-up, once installed, once put away, or where nothing can install it', () => {
    expect(installOfferKind({ ...SECOND_VISIT, visits: 1 })).toBeNull();
    expect(installOfferKind({ ...SECOND_VISIT, isMember: false })).toBeNull();
    expect(installOfferKind({ ...SECOND_VISIT, installed: true })).toBeNull();
    expect(installOfferKind({ ...SECOND_VISIT, dismissed: true })).toBeNull();
    expect(installOfferKind({ ...SECOND_VISIT, canPrompt: false })).toBeNull();
  });
});
