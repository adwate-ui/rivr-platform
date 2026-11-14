import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The launch is kept by the module, so each case starts the app afresh.
async function startApp() {
  vi.resetModules();
  const update = await import('./update.ts');
  update.watchLaunch();
  return update;
}

let now = 0;

beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('a new version as the app starts', () => {
  it('is taken at once, on the page and even on a screen left mid-step, while nothing is typed', async () => {
    const { takeUpdateWhenHidden } = await startApp();
    window.history.replaceState(null, '', '/kyc');
    const take = vi.fn();
    now += 5000;
    takeUpdateWhenHidden(take);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('waits once the member has typed, or after the first minute', async () => {
    const typed = await startApp();
    document.dispatchEvent(new Event('input', { bubbles: true }));
    const afterTyping = vi.fn();
    typed.takeUpdateWhenHidden(afterTyping);
    expect(afterTyping).not.toHaveBeenCalled();

    const late = await startApp();
    now += 60_000;
    const afterAMinute = vi.fn();
    late.takeUpdateWhenHidden(afterAMinute);
    expect(afterAMinute).not.toHaveBeenCalled();
  });

  it('is taken at the next screen when it was waiting, once', async () => {
    const { takeUpdateWhenHidden, takeWaitingUpdate } = await startApp();
    window.history.replaceState(null, '', '/sign-in');
    document.dispatchEvent(new Event('input', { bubbles: true }));
    const take = vi.fn();
    takeUpdateWhenHidden(take);
    expect(take).not.toHaveBeenCalled();
    takeWaitingUpdate();
    takeWaitingUpdate();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('takes nothing at a screen change when no version is waiting', async () => {
    const { takeWaitingUpdate } = await startApp();
    expect(() => takeWaitingUpdate()).not.toThrow();
  });
});
