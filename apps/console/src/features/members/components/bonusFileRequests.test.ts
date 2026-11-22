import type { BonusFileLineToSave } from '@rivr/db/bonusFile';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetRequestId, hasRequestId, keepRequestId, requestIdFor } from './bonusFileRequests.ts';

const file = (chips: number): BonusFileLineToSave[] => [{ line: 2, memberId: 'm1', kind: 'add', chips, reason: 'Diwali gift' }];
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** The module as a page loaded afresh finds it: nothing in memory, sessionStorage as it was. */
async function reloaded() {
  vi.resetModules();
  return import('./bonusFileRequests.ts');
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('Bonus file request ids', () => {
  it('gives a file its kept id until forgotten, a new one otherwise, and never keeps the lines themselves', () => {
    const first = requestIdFor('v1', file(500));
    expect(requestIdFor('v1', file(500))).not.toBe(first);
    expect(hasRequestId('v1', file(500))).toBe(false);
    keepRequestId('v1', file(500), first);
    expect(hasRequestId('v1', file(500))).toBe(true);
    expect(requestIdFor('v1', file(500))).toBe(first);
    expect(requestIdFor('v1', file(550))).not.toBe(first);
    expect(requestIdFor('v2', file(500))).not.toBe(first);
    expect(JSON.stringify(sessionStorage)).not.toContain('Diwali');
    forgetRequestId('v1', file(500));
    expect(requestIdFor('v1', file(500))).not.toBe(first);
  });

  it('keeps the ten newest files', () => {
    for (let chips = 50; chips <= 550; chips += 50) keepRequestId('v5', file(chips), ID(chips));
    expect(requestIdFor('v5', file(50))).not.toBe(ID(50));
    expect(requestIdFor('v5', file(100))).toBe(ID(100));
    expect(requestIdFor('v5', file(550))).toBe(ID(550));
  });

  it('finds an id kept before a reload, and reads back only what is a fingerprint and an id', async () => {
    keepRequestId('v6', file(500), ID(1));
    const page = await reloaded();
    expect(page.requestIdFor('v6', file(500))).toBe(ID(1));
    sessionStorage.setItem('rivr.bonus-file.requests.v7', JSON.stringify([['x', 'not-an-id'], 'junk', [1, 2]]));
    expect((await reloaded()).hasRequestId('v7', file(500))).toBe(false);
    sessionStorage.setItem('rivr.bonus-file.requests.v8', '{"not": "a list"}');
    expect((await reloaded()).requestIdFor('v8', file(500))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps them in memory where sessionStorage takes no more, and an id forgotten then stays forgotten', async () => {
    const page = await reloaded();
    page.keepRequestId('v9', file(500), ID(2));
    const real = sessionStorage;
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => real.getItem(key), setItem: () => { throw new Error('full'); } });
    page.keepRequestId('v9', file(550), ID(3));
    expect(page.requestIdFor('v9', file(550))).toBe(ID(3));
    page.forgetRequestId('v9', file(500));
    expect(page.hasRequestId('v9', file(500))).toBe(false);
  });
});
