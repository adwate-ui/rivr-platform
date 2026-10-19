import { describe, expect, it } from 'vitest';
import { orderWaitlist, type TierPriority, type WaitingPlace } from './priority.ts';

const HIGH = { smallBlind: 10_000n, bigBlind: 20_000n };
const LOW = { smallBlind: 5_000n, bigBlind: 10_000n };
const BLACK_CARD: TierPriority = { reason: 'Black card', weight: 2, onlyAtQualifyingStake: true };
const FOUNDERS: TierPriority = { reason: 'Founders\' Circle', weight: 1, onlyAtQualifyingStake: false };

/** A member who joined `minutes` after 19:00. */
function place(id: string, minutes: number, tier: TierPriority | null = null): WaitingPlace {
  return { id, joinedAt: Date.UTC(2026, 10, 15, 13, 30 + minutes), tier, qualifyingStake: tier === BLACK_CARD ? HIGH : null };
}

const FIVE_WAITING = [place('kabir', 0), place('naina', 1), place('rohan', 2), place('dev', 3), place('asha', 4)];

describe('orderWaitlist', () => {
  it('puts a black card joining behind five members first on the list for their qualifying stake', () => {
    const order = orderWaitlist(HIGH, [...FIVE_WAITING, place('arjun', 5, BLACK_CARD)]);
    expect(order.map(({ id, priority }) => [id, priority.reason])).toEqual([
      ['arjun', 'Black card'], ['kabir', null], ['naina', null], ['rohan', null], ['dev', null], ['asha', null],
    ]);
  });

  it('places the same black card by join time, with no marker, on another stake\'s list', () => {
    const order = orderWaitlist(LOW, [...FIVE_WAITING, place('arjun', 5, BLACK_CARD)]);
    expect(order.map(({ id }) => id)).toEqual(['kabir', 'naina', 'rohan', 'dev', 'asha', 'arjun']);
    expect(order.at(-1)?.priority).toEqual({ weight: 0, reason: null });
  });

  it('puts Founders\' Circle behind a black card at its stake and ahead of join time, earliest first among equals', () => {
    const order = orderWaitlist(HIGH, [place('kabir', 0), place('meera', 2, FOUNDERS), place('arjun', 3, BLACK_CARD), place('sana', 1, FOUNDERS)]);
    expect(order.map(({ id }) => id)).toEqual(['arjun', 'sana', 'meera', 'kabir']);
  });

  it('breaks a tie in join time by id, so every surface shows the same order', () => {
    expect(orderWaitlist(LOW, [place('b', 0), place('a', 0)]).map(({ id }) => id)).toEqual(['a', 'b']);
  });
});
