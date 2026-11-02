import { createRivrClient, RivrDataProvider, type MySeat } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SeatActions } from './SeatActions.tsx';

afterEach(cleanup);

const SEAT: MySeat = {
  tableName: 'Table 1', seat: 4, isAway: false, hasCallTime: true, callTimeLeft: 9668, playedSeconds: 1140, isLeaving: false, topUp: null,
  callTimeMinutes: 180, startedAt: '2026-11-15T16:55:30Z', callTimeEndsAt: null, tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n,
  timeRequestMinutes: 60,
};

function Seat({ seat }: { seat: MySeat }) {
  return (
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={new QueryClient()}>
      <ToastProvider><SeatActions seat={seat} onOpen={() => undefined} /></ToastProvider>
    </RivrDataProvider>
  );
}

describe('Tonight › Time requested', () => {
  it('says how much the floor added once it approves: the request goes and the call time grows', () => {
    const { rerender } = render(<Seat seat={SEAT} />);
    expect(screen.queryByText('1 hour added')).toBeNull();
    rerender(<Seat seat={{ ...SEAT, timeRequestMinutes: null, callTimeMinutes: 240, callTimeLeft: 13268 }} />);
    expect(screen.getByText('1 hour added')).toBeDefined();
  });

  it('says nothing when the floor declines: the request goes and the call time stays', () => {
    const { rerender } = render(<Seat seat={SEAT} />);
    rerender(<Seat seat={{ ...SEAT, timeRequestMinutes: null }} />);
    expect(screen.queryByText(/added$/)).toBeNull();
  });
});
