import type { BonusFileLineToSave } from '@rivr/db/bonusFile';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetRequestId, hasRequestId, keepRequestId, requestIdFor } from './bonusFileRequests.ts';

const file = (chips: number): BonusFileLineToSave[] => [{ line: 2, memberId: 'm1', kind: 'add', chips, reason: 'Diwali gift' }];

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
    for (let chips = 50; chips <= 550; chips += 50) keepRequestId('v1', file(chips), `id-${chips}`);
    expect(requestIdFor('v1', file(50))).not.toBe('id-50');
    expect(requestIdFor('v1', file(100))).toBe('id-100');
    expect(requestIdFor('v1', file(550))).toBe('id-550');
  });

  it('keeps them in memory where sessionStorage is not to be had, and reads past what is not its own', () => {
    sessionStorage.setItem('rivr.bonus-file.requests.v3', '{"not": "a list"}');
    expect(requestIdFor('v3', file(500))).toMatch(/^[0-9a-f-]{36}$/);
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    keepRequestId('v4', file(500), 'kept');
    expect(requestIdFor('v4', file(500))).toBe('kept');
  });
});
