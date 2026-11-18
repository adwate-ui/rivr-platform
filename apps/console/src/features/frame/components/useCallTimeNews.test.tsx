import type { SeatedPlayer } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCallTimeNews } from './useCallTimeNews.ts';

afterEach(cleanup);

/** Kabir at Table 1, seat 5, owing his call time with none set, unless changed. */
const kabir = (change: Partial<SeatedPlayer> = {}): SeatedPlayer => ({
  sessionId: 's1', tableId: 't1', seat: 5, memberId: 'm1', fullName: 'Kabir Sethi', tierName: 'Black card', startedAt: '2026-11-15T15:00:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: 600, leavingAt: null, topUp: null, callTimeSetAt: null, callTimeEndsAt: null, owesCallTime: true,
  callTimeChoicesOpen: [30, 60, 120], isCallTimeSetByMember: false, callTimeChangeId: null, ...change,
});

function News({ seats }: { seats: readonly SeatedPlayer[] }) {
  useCallTimeNews(seats);
  return null;
}

const shown = (seats: readonly SeatedPlayer[]) => <ToastProvider place="console"><News seats={seats} /></ToastProvider>;

describe('the floor told of a member\'s call time (the owner, 18 Nov)', () => {
  it('tells the floor once when a member sets it, and when they extend it, with when they leave', async () => {
    const view = render(shown([kabir()]));
    expect(screen.queryByText(/call time/)).toBeNull();
    // Set from the app: ends at 23:40 IST.
    view.rerender(shown([kabir({ callTimeSetAt: '2026-11-15T16:30:00Z', callTimeEndsAt: '2026-11-15T18:10:00Z', isCallTimeSetByMember: true, callTimeChangeId: 'c1' })]));
    expect(await screen.findByText('Kabir Sethi set call time · leaves 23:40')).toBeDefined();
    // The same change read again tells nothing more.
    view.rerender(shown([kabir({ callTimeSetAt: '2026-11-15T16:30:00Z', callTimeEndsAt: '2026-11-15T18:10:01Z', isCallTimeSetByMember: true, callTimeChangeId: 'c1' })]));
    expect(screen.getAllByText(/set call time/)).toHaveLength(1);
    // Extended by an hour: ends at 00:40.
    view.rerender(shown([kabir({ callTimeSetAt: '2026-11-15T16:30:00Z', callTimeEndsAt: '2026-11-15T19:10:00Z', isCallTimeSetByMember: true, callTimeChangeId: 'c2' })]));
    expect(await screen.findByText('Kabir Sethi extended call time · leaves 00:40')).toBeDefined();
  });

  it('tells nothing when an Undo brings back an earlier change, and tells of two members at once in one', async () => {
    const set = { callTimeSetAt: '2026-11-15T16:30:00Z', callTimeEndsAt: '2026-11-15T18:10:00Z', isCallTimeSetByMember: true, callTimeChangeId: 'c1' };
    const naina = (change: Partial<SeatedPlayer> = {}) => kabir({ sessionId: 's2', fullName: 'Naina Kapoor', ...change });
    const view = render(shown([kabir(set), naina()]));
    // The floor adds time (c2), then undoes it: c1 is the latest again, already seen.
    view.rerender(shown([kabir({ ...set, isCallTimeSetByMember: false, callTimeChangeId: 'c2' }), naina()]));
    view.rerender(shown([kabir(set), naina()]));
    expect(screen.queryByText(/call time/)).toBeNull();
    view.rerender(shown([kabir({ ...set, callTimeChangeId: 'c3' }), naina({ ...set, callTimeChangeId: 'n1' })]));
    expect(await screen.findByText('Kabir Sethi, Naina Kapoor set or extended call time')).toBeDefined();
  });

  it('tells nothing of the floor\'s own Add call time, nor of what the first read finds', () => {
    const view = render(shown([kabir({ callTimeSetAt: '2026-11-15T16:30:00Z', callTimeEndsAt: '2026-11-15T18:10:00Z', isCallTimeSetByMember: true, callTimeChangeId: 'c1' })]));
    view.rerender(shown([kabir({ callTimeSetAt: '2026-11-15T16:30:00Z', callTimeEndsAt: '2026-11-15T18:40:00Z', isCallTimeSetByMember: false, callTimeChangeId: 'c2' })]));
    expect(screen.queryByText(/call time/)).toBeNull();
  });
});
