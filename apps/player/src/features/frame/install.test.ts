import { describe, expect, it } from 'vitest';
import { installOfferKind, installWay, isSnoozed } from './install.ts';

const MEMBER = { isMember: true, installed: false, snoozed: false, canPrompt: true, isIphone: false };
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 17, 12);

describe('installOfferKind', () => {
  it('offers install from a member\'s first visit, through the browser where it can', () => {
    expect(installOfferKind(MEMBER)).toBe('prompt');
  });

  it('tells an iPhone how, where the browser cannot ask', () => {
    expect(installOfferKind({ ...MEMBER, canPrompt: false, isIphone: true })).toBe('ios');
  });

  it('never before sign-up, once installed, while Not now holds it, or where nothing is known to install it', () => {
    expect(installOfferKind({ ...MEMBER, isMember: false })).toBeNull();
    expect(installOfferKind({ ...MEMBER, installed: true })).toBeNull();
    expect(installOfferKind({ ...MEMBER, snoozed: true })).toBeNull();
    // An Android browser with no prompt may have it installed already; Home says nothing there.
    expect(installOfferKind({ ...MEMBER, canPrompt: false })).toBeNull();
  });

  it('gives Profile the way to install, the Android steps where the browser gives no prompt', () => {
    expect(installWay({ canPrompt: true, isIphone: false, isAndroid: true })).toBe('prompt');
    expect(installWay({ canPrompt: false, isIphone: true, isAndroid: false })).toBe('ios');
    expect(installWay({ canPrompt: false, isIphone: false, isAndroid: true })).toBe('android');
    expect(installWay({ canPrompt: false, isIphone: false, isAndroid: false })).toBeNull();
  });
});

describe('Not now (the owner, 17 Nov)', () => {
  it('holds the offer for the rest of the visit, and it is back on the next', () => {
    const first = { times: 1, visit: 1, at: NOW };
    expect(isSnoozed(first, 1, NOW + 5 * 60 * 1000)).toBe(true);
    expect(isSnoozed(first, 2, NOW + 60 * 60 * 1000)).toBe(false);
  });

  it('then waits a day, 3 days, 7 days, and 30 days each time after', () => {
    const waits = [[2, 1], [3, 3], [4, 7], [5, 30], [9, 30]] as const;
    for (const [times, days] of waits) {
      const snooze = { times, visit: 5, at: NOW };
      expect(isSnoozed(snooze, 6, NOW + days * DAY - 1)).toBe(true);
      expect(isSnoozed(snooze, 6, NOW + days * DAY)).toBe(false);
    }
  });

  it('holds nothing before the first Not now', () => {
    expect(isSnoozed(null, 1, NOW)).toBe(false);
    expect(isSnoozed({ times: 0, visit: 1, at: NOW }, 1, NOW)).toBe(false);
  });
});
