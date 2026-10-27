import type { LiveTournament } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedTournament } from './useDelayedTournament.ts';

const START = 1_000_000;

/** The tournament as the server said it at `atMs`: `elapsedSeconds` in, running or not, `playersLeft` left. */
function heard(atMs: number, elapsedSeconds: number, isRunning = true, playersLeft = 9): LiveTournament {
  return {
    name: 'RIVR Sunday',
    stages: [{ kind: 'level', smallBlind: 400, bigBlind: 800, ante: 800, minutes: 20 }],
    clock: { elapsedSeconds, isRunning, readAtMs: atMs },
    field: { entries: 58, playersLeft, chipsInPlay: 58 * 30_000, pool: fromPaise(52_200_000n) },
  };
}

interface Props { latest: LiveTournament | null | undefined; atMs: number; delay: number }

function render(first: Props) {
  return renderHook(({ latest, atMs, delay }: Props) => useDelayedTournament(latest, atMs, delay), { initialProps: first });
}

/** Moves the clock on to `atMs`, a second at a time, as the overlay ticks. */
function tickTo(atMs: number) {
  act(() => {
    vi.advanceTimersByTime(atMs - Date.now());
  });
}

describe('the stream overlay’s hole-card delay (decision 0256)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it('shows nothing until what it first heard is the delay old, then the clock as it was then', () => {
    const { result } = render({ latest: heard(START, 500), atMs: START, delay: 20 });
    tickTo(START + 19_000);
    expect(result.current).toBeUndefined();
    tickTo(START + 20_000);
    expect(result.current?.elapsedSeconds).toBe(500);
    tickTo(START + 25_000);
    expect(result.current?.elapsedSeconds).toBe(505);
  });

  it('holds back each change by the delay: the level moved, a player out, the clock paused', () => {
    const { result, rerender } = render({ latest: heard(START, 500), atMs: START, delay: 20 });
    tickTo(START + 10_000);
    rerender({ latest: heard(START + 10_000, 1200, true, 8), atMs: START + 10_000, delay: 20 });
    tickTo(START + 15_000);
    rerender({ latest: heard(START + 15_000, 1205, false, 8), atMs: START + 15_000, delay: 20 });
    tickTo(START + 29_000);
    expect(result.current?.elapsedSeconds).toBe(509);
    expect(result.current?.tournament?.field.playersLeft).toBe(9);
    tickTo(START + 30_000);
    expect(result.current?.elapsedSeconds).toBe(1200);
    expect(result.current?.tournament?.field.playersLeft).toBe(8);
    tickTo(START + 35_000);
    expect(result.current?.elapsedSeconds).toBe(1205);
    tickTo(START + 60_000);
    expect(result.current?.elapsedSeconds).toBe(1205);
  });

  it('keeps the reading on the stream when a later one arrives, and drops only those before it', () => {
    const { result, rerender } = render({ latest: heard(START, 500), atMs: START, delay: 10 });
    tickTo(START + 5_000);
    rerender({ latest: heard(START + 5_000, 600), atMs: START + 5_000, delay: 10 });
    tickTo(START + 20_000);
    rerender({ latest: heard(START + 20_000, 900), atMs: START + 20_000, delay: 10 });
    expect(result.current?.elapsedSeconds).toBe(605);
    tickTo(START + 25_000);
    expect(result.current?.elapsedSeconds).toBe(610);
    tickTo(START + 30_000);
    expect(result.current?.elapsedSeconds).toBe(900);
  });

  it('shows that none is running only once the delay has passed', () => {
    const { result, rerender } = render({ latest: heard(START, 500), atMs: START, delay: 20 });
    tickTo(START + 5_000);
    rerender({ latest: null, atMs: START + 5_000, delay: 20 });
    tickTo(START + 24_000);
    expect(result.current?.tournament).not.toBeNull();
    tickTo(START + 25_000);
    expect(result.current).toEqual({ tournament: null, elapsedSeconds: 0 });
  });

  it('waits for the first reading, and with no delay shows it at the next tick', () => {
    const { result, rerender } = render({ latest: undefined, atMs: 0, delay: 0 });
    tickTo(START + 3_000);
    expect(result.current).toBeUndefined();
    rerender({ latest: heard(START + 3_000, 500), atMs: START + 3_000, delay: 0 });
    tickTo(START + 4_000);
    expect(result.current?.elapsedSeconds).toBe(501);
  });
});
