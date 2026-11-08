import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoorScreen } from './DoorScreen.tsx';

/** What the camera has in front of it: a card's code, or nothing. */
const camera = vi.hoisted(() => {
  const seen: { code: string | null } = { code: null };
  return seen;
});

vi.mock('jsqr', () => ({ default: () => (camera.code === null ? null : { data: camera.code }) }));

const REFUSED = () => Response.json({ code: 'XX000', message: 'down' }, { status: 500 });
const WELCOME = () => Response.json([{ action: 'in', first_name: 'Kavya', played_seconds: 0 }]);
const TRY_AGAIN = 'Try again.';
const LATER = { timeout: 5000 };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  camera.code = null;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.resolve({ getTracks: () => [] }) } });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({ drawImage: () => undefined, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }) });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

/** A signed-in kiosk whose scans are answered in turn by `replies`; the codes it was sent. */
function renderDoor(replies: (() => Response | Promise<Response>)[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-00000000e002', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const scans: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/door_scan')) return Response.json([]);
    scans.push(Reflect.get(Object(JSON.parse(String(init?.body))), 'p_code'));
    return (replies.shift() ?? WELCOME)();
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DoorScreen />
    </RivrDataProvider>,
  );
  return scans;
}

const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('the door kiosk', () => {
  it('keeps a refusal past a check-in\u2019s six seconds, and the same card tried again replaces it (F-143)', async () => {
    const scans = renderDoor([REFUSED, WELCOME]);
    camera.code = 'RIVR-58-aaa';
    await pass(300);
    expect(await screen.findByText(TRY_AGAIN, {}, LATER)).toBeDefined();
    camera.code = null;
    await pass(8_000);
    expect(screen.getByText(TRY_AGAIN)).toBeDefined();
    camera.code = 'RIVR-58-bbb';
    await pass(300);
    expect(await screen.findByText('Welcome, Kavya.', {}, LATER)).toBeDefined();
    expect(screen.queryByText(TRY_AGAIN)).toBeNull();
    expect(scans).toEqual(['RIVR-58-aaa', 'RIVR-58-bbb']);
  });

  it('does not send a refused card still held up four times a second', async () => {
    const scans = renderDoor([REFUSED, REFUSED]);
    camera.code = 'RIVR-58-aaa';
    await pass(300);
    await screen.findByText(TRY_AGAIN, {}, LATER);
    await pass(1_500);
    expect(scans).toHaveLength(1);
    await pass(2_000);
    expect(scans).toHaveLength(2);
  });

  it('holds a checked-in card still held up for its thirty seconds', async () => {
    const scans = renderDoor([WELCOME]);
    camera.code = 'RIVR-58-aaa';
    await pass(300);
    await screen.findByText('Welcome, Kavya.', {}, LATER);
    await pass(10_000);
    expect(scans).toHaveLength(1);
  });

  it('hears a card read while another scan is going, once that scan is done', async () => {
    let answer: (reply: Response) => void = () => undefined;
    const slow = () => new Promise<Response>((resolve) => { answer = resolve; });
    const scans = renderDoor([slow, WELCOME]);
    camera.code = 'RIVR-58-aaa';
    await pass(300);
    camera.code = 'RIVR-61-ccc';
    await pass(600);
    expect(scans).toEqual(['RIVR-58-aaa']);
    answer(Response.json([{ action: 'in', first_name: 'Mira', played_seconds: 0 }]));
    await pass(600);
    expect(scans).toEqual(['RIVR-58-aaa', 'RIVR-61-ccc']);
  });
});
