import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetOffline, keepForOffline, restoreForOffline } from './offlineCache.ts';
import { queryKeys } from './queryKeys.ts';

const STORED = 'rivr.offline.v1';
const USER = 'u1';
const RECORD = { status: 'verified', hasSelfie: true, photoPath: 'v/m/selfie.jpg', dateOfBirth: '1990-01-01', maskedAadhaar: 'XXXX XXXX 1234', pan: 'ABCPM1234F', isAtTheClub: false };

function setOnline(isOnline: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
}

/** The answers landing in a cache that keeps for offline, then the write it holds back for a moment. */
function kept(answers: readonly (readonly [readonly unknown[], unknown])[], userId = USER) {
  const cache = new QueryClient();
  const stop = keepForOffline(cache, userId);
  for (const [queryKey, data] of answers) cache.setQueryData(queryKey, data);
  vi.advanceTimersByTime(1000);
  stop();
  return localStorage.getItem(STORED) ?? '';
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setOnline(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe('the offline cache', () => {
  it('keeps what an installed app opens with, and nothing else', () => {
    const stored = kept([[queryKeys.membershipCard(USER), { memberNumber: '14' }], [queryKeys.member(USER), { fullName: 'Kavya Rao' }], [['user', USER, 'my-sessions'], ['secret session']]]);
    expect(stored).toContain('Kavya Rao');
    expect(stored).toContain('"memberNumber":"14"');
    expect(stored).not.toContain('secret session');
  });

  it('keeps what an earlier launch read and this one did not, for a club night', () => {
    kept([[queryKeys.membershipCard(USER), { memberNumber: '14' }]]);
    // A later launch that reads Home and never opens Card.
    vi.advanceTimersByTime(11 * 60 * 60 * 1000);
    expect(kept([[queryKeys.floorTables(USER), []]])).toContain('"memberNumber":"14"');
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(kept([[queryKeys.floorTables(USER), []]])).not.toContain('"memberNumber":"14"');
  });

  it('saves only the signed-in member\u2019s answers, so a session that ended without signing out leaves nothing of it', () => {
    kept([[queryKeys.member('asha'), { fullName: 'Asha Verma' }]], 'asha');
    const stored = kept([[queryKeys.member('asha'), { fullName: 'Asha Verma' }], [queryKeys.member(USER), { fullName: 'Kavya Rao' }]]);
    expect(stored).toContain('Kavya Rao');
    expect(stored).not.toContain('Asha Verma');
  });

  it('does not save an answer again once it is over a club night old, however often it is restored', () => {
    kept([[queryKeys.mySeat(USER), { seat: 4 }]]);
    setOnline(false);
    const cache = new QueryClient();
    restoreForOffline(cache);
    const stop = keepForOffline(cache, USER);
    vi.advanceTimersByTime(13 * 60 * 60 * 1000);
    cache.setQueryData(queryKeys.floorTables(USER), []);
    vi.advanceTimersByTime(1000);
    stop();
    expect(localStorage.getItem(STORED)).not.toContain('"seat":4');
  });

  it('restores each answer by its own age, whenever the last save was', () => {
    kept([[queryKeys.membershipCard(USER), { memberNumber: '14' }]]);
    vi.advanceTimersByTime(11 * 60 * 60 * 1000);
    kept([[queryKeys.floorTables(USER), [{ bigBlind: 20000n }]]]);
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    setOnline(false);
    const cache = new QueryClient();
    restoreForOffline(cache);
    expect(cache.getQueryData(queryKeys.floorTables(USER))).toEqual([{ bigBlind: 20000n }]);
    expect(cache.getQueryData(queryKeys.membershipCard(USER))).toBeUndefined();
  });

  it('keeps what it restored through a long night with nothing reading it', () => {
    kept([[queryKeys.membershipCard(USER), { memberNumber: '14' }]]);
    setOnline(false);
    const cache = new QueryClient();
    restoreForOffline(cache);
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(cache.getQueryData(queryKeys.membershipCard(USER))).toEqual({ memberNumber: '14', photoPath: null });
  });

  it('keeps of the card what the door needs, and not the path to the selfie', () => {
    const stored = kept([[queryKeys.membershipCard(USER), { memberNumber: '14', photoPath: 'v/m/selfie.jpg' }]]);
    expect(stored).toContain('"memberNumber":"14"');
    expect(stored).not.toContain('selfie.jpg');
  });

  it('keeps of an identity check what the gate reads, and none of its documents', () => {
    const stored = kept([[queryKeys.kycRecord(USER), RECORD]]);
    expect(stored).toContain('"status":"verified"');
    for (const document of ['ABCPM1234F', '1990-01-01', 'XXXX XXXX 1234', 'selfie.jpg']) expect(stored).not.toContain(document);
  });

  it('brings it back when the phone opens offline, money as bigints, and says it is offline at once', () => {
    kept([[queryKeys.floorTables(USER), [{ bigBlind: 20000n }]]]);
    setOnline(false);
    const cache = new QueryClient();
    restoreForOffline(cache);
    expect(cache.getQueryData(queryKeys.floorTables(USER))).toEqual([{ bigBlind: 20000n }]);
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('brings the member\u2019s tabs back as the Map the app reads', () => {
    kept([[queryKeys.featureAccess(USER), new Map([['rewards.catalogue', { state: 'enabled' }]])]]);
    setOnline(false);
    const cache = new QueryClient();
    restoreForOffline(cache);
    expect(cache.getQueryData(queryKeys.featureAccess(USER))).toEqual(new Map([['rewards.catalogue', { state: 'enabled' }]]));
  });

  it('shows nothing old when the phone opens online', () => {
    kept([[queryKeys.member(USER), { fullName: 'Kavya Rao' }]]);
    const cache = new QueryClient();
    restoreForOffline(cache);
    expect(cache.getQueryData(queryKeys.member(USER))).toBeUndefined();
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('drops what was kept more than a club night ago', () => {
    kept([[queryKeys.member(USER), { fullName: 'Kavya Rao' }]]);
    setOnline(false);
    const cache = new QueryClient();
    restoreForOffline(cache, Date.now() + 12 * 60 * 60 * 1000 + 1);
    expect(cache.getQueryData(queryKeys.member(USER))).toBeUndefined();
    expect(localStorage.getItem(STORED)).toBeNull();
  });

  it('forgets everything when asked, as at sign-out', () => {
    kept([[queryKeys.member(USER), { fullName: 'Kavya Rao' }]]);
    forgetOffline();
    expect(localStorage.getItem(STORED)).toBeNull();
  });

  it('survives what it cannot read, opening as if nothing was kept', () => {
    localStorage.setItem(STORED, 'not json');
    setOnline(false);
    const cache = new QueryClient();
    expect(() => restoreForOffline(cache)).not.toThrow();
    expect(cache.getQueryCache().getAll()).toHaveLength(0);
  });

  it.each([
    ['queries that are no list', { state: { queries: 'none' } }],
    ['an entry with nothing in it', { state: { queries: [{}] } }],
  ])('forgets %s, rather than throw while the app starts', (_name, slot) => {
    localStorage.setItem(STORED, JSON.stringify(slot));
    setOnline(false);
    expect(() => restoreForOffline(new QueryClient())).not.toThrow();
    expect(localStorage.getItem(STORED)).toBeNull();
  });
});
