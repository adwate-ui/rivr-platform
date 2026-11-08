import type { TabletPlayer } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { ringStatus } from './seatStatus.ts';

const PLAYER: TabletPlayer = { sessionId: 's1', fullName: 'Rahul Verma', isAway: false, isLeaving: false, pendingBuyIn: null, callTimeLeft: null };

describe('what the ring says of a seat (F-189)', () => {
  it('says nothing of a player with nothing to watch', () => {
    expect(ringStatus(PLAYER)).toBeUndefined();
    expect(ringStatus({ ...PLAYER, callTimeLeft: 3_600 })).toBeUndefined();
  });

  it('says away', () => {
    expect(ringStatus({ ...PLAYER, isAway: true })).toEqual({ kind: 'away', label: 'Away' });
  });

  it('counts down the last fifteen minutes of call time, and stops at the end', () => {
    expect(ringStatus({ ...PLAYER, callTimeLeft: 900 })).toEqual({ kind: 'ending', label: '15 min left' });
    expect(ringStatus({ ...PLAYER, callTimeLeft: 901 })).toBeUndefined();
    expect(ringStatus({ ...PLAYER, callTimeLeft: 0 })).toBeUndefined();
  });

  it('says leaving before call time, and call time before away', () => {
    expect(ringStatus({ ...PLAYER, isLeaving: true, isAway: true, callTimeLeft: 60 })?.kind).toBe('leaving');
    expect(ringStatus({ ...PLAYER, isAway: true, callTimeLeft: 60 })?.kind).toBe('ending');
  });
});
