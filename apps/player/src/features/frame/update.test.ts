import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let visibility: DocumentVisibilityState = 'visible';
// The module keeps whether sign-in has begun and what waits, so each case starts the app afresh.
let update: typeof import('./update.ts');

/** The member types on sign-in: from then a reload would lose it. */
function typeOnSignIn() {
  update.watchSignInTyping();
  document.dispatchEvent(new Event('input'));
}

/** The member leaves the page, or comes back to it. */
function show(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(async () => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.resetModules();
  update = await import('./update.ts');
});

afterEach(() => {
  // Back to jsdom's own, from Document.prototype.
  Reflect.deleteProperty(document, 'visibilityState');
  window.history.replaceState(null, '', '/');
});

describe('takeUpdateWhenHidden', () => {
  it('never takes it while the member is away mid sign-in or KYC, and takes it once they leave from elsewhere', () => {
    const take = vi.fn();
    window.history.replaceState(null, '', '/sign-in');
    typeOnSignIn();
    update.takeUpdateWhenHidden(take);
    show('hidden');
    expect(take).not.toHaveBeenCalled();
    show('visible');
    window.history.replaceState(null, '', '/kyc/return');
    show('hidden');
    expect(take).not.toHaveBeenCalled();
    show('visible');
    window.history.replaceState(null, '', '/');
    show('hidden');
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('takes it at once on sign-in before anything is typed, even in sight', () => {
    const take = vi.fn();
    window.history.replaceState(null, '', '/sign-in');
    update.takeUpdateWhenHidden(take);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('takes a new version at once when the page is out of sight', () => {
    visibility = 'hidden';
    const take = vi.fn();
    update.takeUpdateWhenHidden(take);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('waits while the member is on the page, and takes it the next time they leave, once', () => {
    const take = vi.fn();
    update.takeUpdateWhenHidden(take);
    show('visible');
    expect(take).not.toHaveBeenCalled();

    show('hidden');
    expect(take).toHaveBeenCalledTimes(1);
    show('visible');
    show('hidden');
    expect(take).toHaveBeenCalledTimes(1);
  });
});

describe('a new version waiting', () => {
  it('says it is waiting, and Refresh takes it once, even mid sign-in', () => {
    const take = vi.fn();
    const heard = vi.fn();
    update.subscribeToWaitingUpdate(heard);
    window.history.replaceState(null, '', '/sign-in');
    typeOnSignIn();
    update.takeUpdateWhenHidden(take);
    expect(update.hasWaitingUpdate()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);

    update.takeWaitingUpdate();
    update.takeWaitingUpdate();
    expect(take).toHaveBeenCalledTimes(1);
    expect(update.hasWaitingUpdate()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('asks the server every 10 minutes and each time the member comes back, quietly when offline', async () => {
    vi.useFakeTimers();
    try {
      const ask = vi.fn(() => Promise.reject(new Error('offline')));
      update.watchForNewVersion({ update: ask });
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(ask).toHaveBeenCalledTimes(1);
      show('hidden');
      show('visible');
      expect(ask).toHaveBeenCalledTimes(2);
      await vi.runOnlyPendingTimersAsync();
    } finally {
      vi.useRealTimers();
    }
  });
});
