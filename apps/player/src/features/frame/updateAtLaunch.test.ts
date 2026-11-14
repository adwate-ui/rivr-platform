import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The launch is kept by the module, so each case starts the app afresh.
async function startApp() {
  vi.resetModules();
  const update = await import('./update.ts');
  update.watchLaunch();
  return update;
}

/** A router with two screens, on the first. */
async function twoScreens() {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/' }),
    createRoute({ getParentRoute: () => rootRoute, path: '/card' }),
  ]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) });
  await router.load();
  return router;
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
  it('is taken at once, on the page and even on a screen left mid-step, before the first touch or key', async () => {
    const { takeUpdateWhenHidden } = await startApp();
    window.history.replaceState(null, '', '/kyc');
    const take = vi.fn();
    now += 5000;
    takeUpdateWhenHidden(take);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('waits once the member has touched the screen or a key, or after the first minute', async () => {
    for (const first of ['pointerdown', 'keydown']) {
      const begun = await startApp();
      document.dispatchEvent(new Event(first, { bubbles: true }));
      const afterIt = vi.fn();
      begun.takeUpdateWhenHidden(afterIt);
      expect(afterIt).not.toHaveBeenCalled();
    }

    const late = await startApp();
    now += 60_000;
    const afterAMinute = vi.fn();
    late.takeUpdateWhenHidden(afterAMinute);
    expect(afterAMinute).not.toHaveBeenCalled();
  });

  it('is taken at the next screen when it was waiting, once, and not at another search on the same screen', async () => {
    const { takeUpdateWhenHidden, takeWaitingUpdateAtNewScreens } = await startApp();
    const router = await twoScreens();
    takeWaitingUpdateAtNewScreens(router);
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    const take = vi.fn();
    takeUpdateWhenHidden(take);
    await router.navigate({ href: '/?tab=rewards' });
    expect(take).not.toHaveBeenCalled();
    await router.navigate({ href: '/card' });
    expect(take).toHaveBeenCalledTimes(1);
    await router.navigate({ href: '/' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('takes nothing at a screen change when no version is waiting', async () => {
    const { takeWaitingUpdateAtNewScreens } = await startApp();
    const router = await twoScreens();
    takeWaitingUpdateAtNewScreens(router);
    await expect(router.navigate({ href: '/card' })).resolves.toBeUndefined();
  });
});
