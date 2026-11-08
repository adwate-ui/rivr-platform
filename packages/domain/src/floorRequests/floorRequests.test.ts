import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUEST_TARGETS, isRequestLate, REQUEST_TARGET_SECONDS, requestTargets } from './index.ts';

describe('how long a request may wait on the floor (decision 0479)', () => {
  it('gives a top-up its own sixty seconds and the rest five minutes when the club set none', () => {
    expect(REQUEST_TARGET_SECONDS).toBe(300);
    expect(DEFAULT_REQUEST_TARGETS).toEqual({ topUpSeconds: 180, otherSeconds: 300 });
    expect(requestTargets(undefined)).toEqual(DEFAULT_REQUEST_TARGETS);
    expect(requestTargets({ topUpSeconds: null, otherSeconds: null })).toEqual(DEFAULT_REQUEST_TARGETS);
  });

  it('takes the club\'s targets, each on its own', () => {
    expect(requestTargets({ topUpSeconds: 180, otherSeconds: 600 })).toEqual({ topUpSeconds: 180, otherSeconds: 600 });
    expect(requestTargets({ topUpSeconds: 180, otherSeconds: null })).toEqual({ topUpSeconds: 180, otherSeconds: 300 });
  });

  it('shows a top-up late only past its target', () => {
    const targets = requestTargets({ topUpSeconds: 180, otherSeconds: 300 });
    expect([179, 180, 181].map((seconds) => isRequestLate('top_up', seconds, targets))).toEqual([false, false, true]);
  });

  it('shows every other request late past the other target', () => {
    const targets = requestTargets({ topUpSeconds: 180, otherSeconds: 300 });
    for (const kind of ['join', 'time', 'leaving', 'left_owing'] as const) {
      expect([300, 301].map((seconds) => isRequestLate(kind, seconds, targets))).toEqual([false, true]);
    }
  });

  it('never shows late an approved player to seat, ready or not (the owner, 8 Nov)', () => {
    for (const kind of ['seat', 'seat_check', 'seat_wait'] as const) expect(isRequestLate(kind, 3600, requestTargets(undefined))).toBe(false);
  });
});
