import { addBreadcrumb, flush, getClient } from '@sentry/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HANDLED, type Kept } from './kept.ts';
import { startSentry } from './sentry.ts';

// The real SDK, with one change: what it would post to Sentry is kept here instead, to be read as it would leave the phone.
const posted = vi.hoisted(() => new Array<unknown>());
// For a value that is no error the SDK gives its own place in the code as where it was thrown: in the app that is one of
// its scripts under /assets/, in a test this folder. The tests of such values allow it; the others leave this empty.
const alsoAllowed = vi.hoisted(() => new Array<string>());
const THIS_FOLDER = '/error-reporting/';

vi.mock('@sentry/react', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@sentry/react')>();
  const keep = () => ({
    send: (envelope: unknown) => {
      posted.push(envelope);
      return Promise.resolve({});
    },
    flush: () => Promise.resolve(true),
  });
  const init = (options: Parameters<typeof sdk.init>[0] = {}) => sdk.init({ ...options, transport: keep, allowUrls: [...(options.allowUrls ?? []), ...alsoAllowed] });
  return { ...sdk, init };
});

const DSN = 'https://public@sentry.invalid/1';
const options = { dsn: DSN, app: 'player', version: 'release-test', environment: 'staging' };

/** An error thrown from one of the app's own scripts, or from `file`. */
function errorFrom(message: string, file = `${window.location.origin}/assets/index-a1b2.js`): Error {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at signUp (${file}:1:2040)`;
  return error;
}

/** Sentry started with `waiting` to send and the venue as `venue.isPractice` says. */
function started(waiting: Kept[], venue: { isPractice: boolean | null } = { isPractice: false }) {
  return startSentry(options, waiting, () => venue.isPractice);
}

/** Everything posted so far, as the text that would leave the phone. */
async function wire(): Promise<string> {
  await flush(2000);
  return JSON.stringify(posted);
}

beforeEach(() => {
  posted.length = 0;
  alsoAllowed.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('startSentry', () => {
  it('posts an error with its numbers, addresses and breadcrumbs scrubbed, and asks Sentry to keep no IP address', async () => {
    const send = started([{ error: errorFrom('No member for +91 98765 43210, PAN ABCDE1234F'), isCaught: false, route: '/sessions/$sessionId' }]);
    addBreadcrumb({ category: 'fetch', data: { method: 'GET', url: 'https://club.example/rest/v1/member?phone=eq.919876543210', status_code: 500 } });
    addBreadcrumb({ category: 'ui.input', message: 'input[name="pan"]' });
    send();
    const sent = await wire();
    expect(sent).toContain('No member for [number], PAN [pan]');
    expect(sent).toContain('"url":"https://club.example/rest/v1/member"');
    expect(sent).toContain('"tags":{"app":"player","route":"/sessions/$sessionId","kind":"error"}');
    expect(sent).toContain('"release":"release-test"');
    expect(sent).toContain('"environment":"staging"');
    expect(sent).toContain('"infer_ip":"never"');
    expect(sent).toContain('"handled":false');
    expect(sent).not.toMatch(/98765|ABCDE1234F|phone=eq|ui\.input|"user"|ip_address|"extra"|"contexts"/);
  });

  it.each([
    ['a string the app reported', { error: 'Asha Verma could not sign up', isCaught: true, route: '/sign-up' }],
    ['a string thrown with nothing to catch it', { error: 'Asha Verma was thrown', isCaught: false, route: '/sign-up' }],
    ['a number a promise was rejected with', { error: 9876543210, isCaught: false, route: '/sign-up' }],
  ])('posts none of the words of %s, which was not an error', async (_what, kept) => {
    alsoAllowed.push(THIS_FOLDER);
    started([kept])();
    const sent = await wire();
    expect(posted).toHaveLength(1);
    expect(sent).toContain('"value":"[value]"');
    expect(sent).not.toMatch(/Asha|Verma|98765/);
  });

  it('posts a failure a screen handled as an issue of its own by its code, marked handled', async () => {
    started([{ error: Object.assign(errorFrom('refused:not_live'), { name: HANDLED }), isCaught: true, route: '/kyc' }])();
    const sent = await wire();
    expect(sent).toContain('"type":"HandledFailure","value":"refused:not_live"');
    expect(sent).toContain('"tags":{"app":"player","route":"/kyc","kind":"handled"}');
    expect(sent).toContain('"fingerprint":["handled","refused:not_live"]');
  });

  it('posts nothing from the practice venue, and holds what happens until the venue is known', async () => {
    const venue: { isPractice: boolean | null } = { isPractice: null };
    const waiting: Kept[] = [{ error: errorFrom('before the venue was known'), isCaught: true, route: '/' }];
    const send = started(waiting, venue);
    send();
    expect(waiting).toHaveLength(1);
    venue.isPractice = true;
    send();
    expect(waiting).toHaveLength(0);
    waiting.push({ error: errorFrom('in the practice venue'), isCaught: false, route: '/' });
    send();
    await wire();
    expect(posted).toHaveLength(0);
    venue.isPractice = false;
    waiting.push({ error: errorFrom('at the club'), isCaught: false, route: '/' });
    send();
    expect(await wire()).toContain('at the club');
    expect(posted).toHaveLength(1);
  });

  it('posts only errors thrown from the app\'s own scripts, not a browser extension\'s or an in-app browser\'s', async () => {
    const send = started([
      { error: errorFrom('thrown by an extension', 'chrome-extension://abcdefghijklmnop/content.js'), isCaught: false, route: '/' },
      { error: errorFrom('thrown by a script added to the page', 'https://cdn.example/injected.js'), isCaught: false, route: '/' },
      { error: errorFrom('thrown by the app'), isCaught: false, route: '/' },
    ]);
    send();
    const sent = await wire();
    expect(posted).toHaveLength(1);
    expect(sent).toContain('thrown by the app');
  });

  it('scrubs once more as an event leaves, so one that skipped the first scrub is still scrubbed', () => {
    started([]);
    const event = { user: { id: 'u1', username: 'Asha Verma' }, exception: { values: [{ type: 'Error', value: 'No member for +91 98765 43210' }] } };
    getClient()?.emit('beforeSendEvent', event, { originalException: new Error('x') });
    expect(JSON.stringify(event)).toContain('No member for [number]');
    expect(JSON.stringify(event)).not.toMatch(/Asha|98765|"user"/);
  });
});

describe('error reporting, from the page to the post', () => {
  it('posts none of the words of a string thrown after Sentry has loaded, or reported before it had', async () => {
    alsoAllowed.push(THIS_FOLDER);
    vi.stubEnv('VITE_SENTRY_DSN_PLAYER', DSN);
    vi.resetModules();
    const { reportError, setPracticeVenue, startErrorReporting } = await import('./errorReporting.ts');
    reportError('Asha Verma reported before Sentry loaded');
    window.dispatchEvent(new ErrorEvent('error', { error: 'Asha Verma thrown before Sentry loaded' }));
    startErrorReporting({ app: 'player', version: 'release-test', environment: undefined, route: () => '/sign-up' });
    setPracticeVenue(false);
    await vi.waitFor(() => expect(posted).toHaveLength(2), { timeout: 3000 });
    window.dispatchEvent(new ErrorEvent('error', { error: 'Asha Verma thrown after Sentry loaded' }));
    await vi.waitFor(() => expect(posted).toHaveLength(3), { timeout: 3000 });
    expect(JSON.stringify(posted)).not.toMatch(/Asha|Verma/);
    expect(JSON.stringify(posted)).toContain('"route":"/sign-up"');
  });
});
