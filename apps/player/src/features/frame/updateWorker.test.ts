import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// The service worker's own part (public/update-sw.js), run against a stand-in for the worker's global.
const SOURCE = Object.values(import.meta.glob<string>('../../../public/update-sw.js', { query: '?raw', import: 'default', eager: true }))[0] ?? '';

interface WorkerEvent {
  data?: unknown;
  source?: { id: string };
  waitUntil: (promise: Promise<unknown>) => void;
}

interface OpenWindow {
  id: string;
  url: string;
  postMessage: Mock;
  navigate: Mock;
}

/** A worker installing over an older one (`isUpdate`) or for the first time, with these windows open. */
function startWorker(isUpdate: boolean) {
  const handlers = new Map<string, Set<(event: WorkerEvent) => void>>();
  const on = (type: string) => handlers.get(type) ?? new Set<(event: WorkerEvent) => void>();
  const windows: OpenWindow[] = [];
  const self = {
    registration: { active: isUpdate ? {} : null },
    clients: { matchAll: vi.fn(() => Promise.resolve(windows)), claim: vi.fn(() => Promise.resolve()) },
    skipWaiting: vi.fn(() => Promise.resolve()),
    addEventListener: (type: string, handler: (event: WorkerEvent) => void) => handlers.set(type, on(type).add(handler)),
    removeEventListener: (type: string, handler: (event: WorkerEvent) => void) => on(type).delete(handler),
  };
  // The worker's file, run as the browser would, with the test's (fake) timers.
  runInNewContext(SOURCE, {
    self, URL, Promise, Set,
    setTimeout: (run: () => void, ms: number) => setTimeout(run, ms),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => { clearTimeout(timer); },
  });
  const fire = async (type: string, event: Omit<WorkerEvent, 'waitUntil'> = {}) => {
    const waits: Promise<unknown>[] = [];
    for (const handler of on(type)) handler({ ...event, waitUntil: (promise) => waits.push(promise) });
    await Promise.all(waits);
  };
  /** A window on `path`; `answers` for a version that takes new versions itself (update.ts). */
  const open = (id: string, path: string, answers = false) => {
    const window: OpenWindow = {
      id,
      url: `https://app.rivr.test${path}`,
      postMessage: vi.fn(() => {
        if (answers) void fire('message', { data: 'rivr-takes-updates', source: { id } });
      }),
      navigate: vi.fn(() => Promise.resolve(null)),
    };
    windows.push(window);
    return window;
  };
  return { self, fire, open };
}

/** Fires the event, past the two seconds the worker waits for answers. */
async function fireAndWait(worker: ReturnType<typeof startWorker>, type: string) {
  const firing = worker.fire(type);
  await vi.advanceTimersByTimeAsync(2000);
  await firing;
}

/** Installs, then activates. */
async function installThenActivate(worker: ReturnType<typeof startWorker>) {
  await fireAndWait(worker, 'install');
  await fireAndWait(worker, 'activate');
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the service worker and an app too old to take a new version on sign-in', () => {
  it('takes over at once and reloads its sign-in screen', async () => {
    const worker = startWorker(true);
    const signIn = worker.open('a', '/sign-in?next=%2Fbonus');
    await installThenActivate(worker);
    expect(worker.self.skipWaiting).toHaveBeenCalledTimes(1);
    expect(worker.self.clients.claim).toHaveBeenCalledTimes(1);
    expect(signIn.navigate).toHaveBeenCalledWith('https://app.rivr.test/sign-in?next=%2Fbonus');
  });

  it('leaves a version that takes new versions itself to do so', async () => {
    const worker = startWorker(true);
    const signIn = worker.open('a', '/sign-in', true);
    await installThenActivate(worker);
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
    expect(signIn.navigate).not.toHaveBeenCalled();
  });

  it('waits, asking nothing, while any other screen is open, such as an ID check', async () => {
    const worker = startWorker(true);
    const signIn = worker.open('a', '/sign-in');
    worker.open('b', '/kyc');
    await fireAndWait(worker, 'install');
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
    expect(signIn.postMessage).not.toHaveBeenCalled();
  });

  it('still reloads an old sign-in screen, and nothing else, once it takes over another way', async () => {
    const worker = startWorker(true);
    const signIn = worker.open('a', '/sign-in');
    const kyc = worker.open('b', '/kyc');
    await fireAndWait(worker, 'activate');
    expect(signIn.navigate).toHaveBeenCalledWith('https://app.rivr.test/sign-in');
    expect(kyc.navigate).not.toHaveBeenCalled();
  });

  it('does nothing on the first install, whose page takes new versions itself', async () => {
    const worker = startWorker(false);
    const signIn = worker.open('a', '/sign-in', true);
    await installThenActivate(worker);
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
    expect(signIn.navigate).not.toHaveBeenCalled();
  });
});
