import type { VenueTv } from '@rivr/db';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TvStatus } from './TvRow.tsx';

afterEach(cleanup);

const TV: VenueTv = { deviceId: 'd1', name: 'Bar TV', isPaired: true, mode: 'waitlist', rotation: [], lastSeenAt: null, isOnline: false };

describe('whether a TV is on (audit F-083)', () => {
  it('says it is online and what it shows', () => {
    render(<TvStatus tv={{ ...TV, isOnline: true, lastSeenAt: '2026-11-15T16:30:00Z' }} />);
    expect(screen.getByText('Online · showing Waitlist board')).toBeDefined();
  });

  it('says online alone while it has no board', () => {
    render(<TvStatus tv={{ ...TV, mode: null, isOnline: true, lastSeenAt: '2026-11-15T16:30:00Z' }} />);
    expect(screen.getByText('Online')).toBeDefined();
  });

  it('says when an off TV was last seen', () => {
    render(<TvStatus tv={{ ...TV, lastSeenAt: '2026-11-15T16:30:00Z' }} />);
    expect(screen.getByText(/^Offline · last seen /)).toBeDefined();
  });

  it('says offline for a TV never heard from', () => {
    render(<TvStatus tv={TV} />);
    expect(screen.getByText('Offline')).toBeDefined();
  });

  it('says it waits for a TV yet to pick up its login', () => {
    render(<TvStatus tv={{ ...TV, isPaired: false, mode: null }} />);
    expect(screen.getByText('Waiting for the TV')).toBeDefined();
  });
});
