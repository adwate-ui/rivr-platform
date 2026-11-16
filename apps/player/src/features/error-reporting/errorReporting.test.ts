import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kept } from './kept.ts';

// Sentry itself stays out of these tests: what matters here is whether and when it is loaded, and what it is handed.
const sentry = vi.hoisted(() => ({
  started: vi.fn(),
  send: vi.fn(),
  waiting: new Array<unknown>(),
  isPractice: (): boolean | null => false,
}));

vi.mock('./sentry.ts', () => ({
  startSentry: (options: unknown, waiting: Kept[], isPractice: () => boolean | null) => {
    sentry.started(options);
    sentry.waiting = waiting;
    sentry.isPractice = isPractice;
    return sentry.send;
  },
}));

const DSN = 'https://public@sentry.invalid/1';
const options = { app: 'player', version: 'release-test', environment: 'staging', route: () => '/sign-up' };

/** The first paint, and Sentry's code arriving after it. */
async function paint() {
  await vi.runAllTimersAsync();
  await vi.dynamicImportSettled();
}

/** The module as an app that has just started has it, in a build that names Sentry's address or one that does not. */
async function freshModule(dsn = DSN) {
  vi.stubEnv('VITE_SENTRY_DSN_PLAYER', dsn);
  vi.resetModules();
  return import('./errorReporting.ts');
}

/** An error nothing caught, as the browser tells the page of it. */
const thrown = (error: unknown) => window.dispatchEvent(new ErrorEvent('error', { error }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'setTimeout'] });
  sentry.waiting = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('error reporting', () => {
  it('listens for nothing, keeps nothing and loads nothing in a build that names no Sentry address', async () => {
    const listened = vi.spyOn(window, 'addEventListener');
    // As a build has it when the variable is not set: empty.
    const { reportError, reportFailure, setPracticeVenue, startErrorReporting } = await freshModule('');
    startErrorReporting(options);
    reportError(new Error('a screen failed'));
    reportFailure('refused:not_live');
    setPracticeVenue(null);
    await paint();
    expect(listened.mock.calls.map(([type]) => type)).not.toContain('error');
    expect(sentry.started).not.toHaveBeenCalled();
    expect(sentry.send).not.toHaveBeenCalled();
  });

  it('keeps an error thrown before the app has started, as the module listens from the moment it loads', async () => {
    const { startErrorReporting } = await freshModule();
    const early = new Error('thrown while the app loaded');
    thrown(early);
    startErrorReporting(options);
    await paint();
    expect(sentry.waiting).toEqual([{ error: early, isCaught: false, route: '' }]);
  });

  it('loads Sentry only after the first paint, and once', async () => {
    const { startErrorReporting } = await freshModule();
    startErrorReporting(options);
    startErrorReporting(options);
    await vi.dynamicImportSettled();
    expect(sentry.started).not.toHaveBeenCalled();
    await paint();
    expect(sentry.started.mock.calls).toEqual([[{ app: 'player', version: 'release-test', environment: 'staging', dsn: DSN }]]);
    expect(sentry.send).toHaveBeenCalledTimes(1);
  });

  it('keeps each error with the route it happened on, and whether the app caught it or nothing did', async () => {
    const { reportError, startErrorReporting } = await freshModule();
    let route = '/sign-up';
    startErrorReporting({ ...options, route: () => route });
    const drawing = new Error('a screen failed');
    reportError(drawing);
    route = '/kyc';
    const loose = new Error('thrown in a handler');
    thrown(loose);
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'rejected with words' }));
    // A script from another site that fails: the browser gives no error with it.
    thrown(undefined);
    await paint();
    expect(sentry.waiting).toEqual([
      { error: drawing, isCaught: true, route: '/sign-up' },
      { error: loose, isCaught: false, route: '/kyc' },
      { error: 'rejected with words', isCaught: false, route: '/kyc' },
    ]);
  });

  it('keeps ten errors at most while they wait', async () => {
    const { reportError, startErrorReporting } = await freshModule();
    startErrorReporting(options);
    for (let count = 1; count <= 12; count += 1) reportError(new Error(`failed ${String(count)}`));
    await paint();
    expect(sentry.waiting).toHaveLength(10);
  });

  it('asks Sentry to send as each error comes, once it has loaded', async () => {
    const { reportError, startErrorReporting } = await freshModule();
    startErrorReporting(options);
    await paint();
    sentry.send.mockClear();
    const later = new Error('a screen failed later');
    reportError(later);
    expect(sentry.send).toHaveBeenCalledTimes(1);
    // Sentry has no listener of its own: an error nothing caught still comes through here.
    const loose = new Error('thrown later');
    thrown(loose);
    expect(sentry.waiting).toEqual([{ error: later, isCaught: true, route: '/sign-up' }, { error: loose, isCaught: false, route: '/sign-up' }]);
  });

  it('reports a failure a screen handled by its code, once a visit for each code', async () => {
    const { reportFailure, startErrorReporting } = await freshModule();
    startErrorReporting(options);
    reportFailure('refused:not_live');
    reportFailure('refused:not_live');
    reportFailure('camera:blocked');
    await paint();
    expect(sentry.waiting).toHaveLength(2);
    expect(sentry.waiting[0]).toMatchObject({ isCaught: true, route: '/sign-up', error: { name: 'HandledFailure', message: 'refused:not_live' } });
    expect(sentry.waiting[1]).toMatchObject({ error: { name: 'HandledFailure', message: 'camera:blocked' } });
  });

  it('tells Sentry whose venue it is as that becomes known, and asks it to send again', async () => {
    const { setPracticeVenue, startErrorReporting } = await freshModule();
    startErrorReporting(options);
    setPracticeVenue(null);
    await paint();
    expect(sentry.isPractice()).toBeNull();
    sentry.send.mockClear();
    setPracticeVenue(true);
    expect(sentry.isPractice()).toBe(true);
    setPracticeVenue(false);
    expect(sentry.isPractice()).toBe(false);
    expect(sentry.send).toHaveBeenCalledTimes(2);
  });

  // Last: from here on this file's Sentry is one that fails to arrive.
  it('keeps nothing more when Sentry cannot be fetched', async () => {
    vi.doMock('./sentry.ts', () => {
      throw new Error('no connection');
    });
    const { reportError, startErrorReporting } = await freshModule();
    startErrorReporting(options);
    reportError(new Error('a screen failed'));
    await paint();
    reportError(new Error('a screen failed again'));
    expect(sentry.started).not.toHaveBeenCalled();
    expect(sentry.send).not.toHaveBeenCalled();
  });
});
