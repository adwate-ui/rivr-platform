import type { VenueTv } from '@rivr/db';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TvStatus } from './TvRow.tsx';
import { RotationChips, TableChips } from './tvCopy.tsx';

afterEach(cleanup);

const TV: VenueTv = { deviceId: 'd1', name: 'Bar TV', isPaired: true, mode: 'waitlist', rotation: [], tables: [], lastSeenAt: null, isOnline: false };

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

describe('what a TV turns to in between (decision 0163)', () => {
  it('offers every board but its main one, the high hand bonus among them', () => {
    render(<RotationChips label="What Bar TV turns to in between" mode="waitlist" value={[]} onChange={() => undefined} />);
    const chips = within(screen.getByRole('group', { name: 'What Bar TV turns to in between' })).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Call-time board', 'Promotions', 'Hours leaderboard', 'High hand bonus']);
  });

  it('leaves out only the main board, so a TV on the high hand bonus turns to the other four', () => {
    render(<RotationChips label="What Bar TV turns to in between" mode="high_hand" value={[]} onChange={() => undefined} />);
    expect(screen.getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Waitlist board', 'Call-time board', 'Promotions', 'Hours leaderboard']);
  });
});

describe('the tables a TV\'s call time board shows (the owner, 22 Nov)', () => {
  it('offers each table by name, the ones picked pressed, and says none picked is every table', () => {
    render(<TableChips label="Call time tables on Bar TV" tables={{ tables: [{ id: 't1', name: 'Table 1' }, { id: 't2', name: 'Table 2' }], isError: false, retry: () => undefined }}
      value={['t2']} onChange={() => undefined} />);
    const chips = within(screen.getByRole('group', { name: 'Call time tables on Bar TV' })).getAllByRole('button');
    expect(chips.map((chip) => [chip.textContent, chip.getAttribute('aria-pressed')])).toEqual([['Table 1', 'false'], ['Table 2', 'true']]);
    expect(screen.getByText('None picked shows every table.')).toBeDefined();
  });
});

describe('the tables while they load (UI review)', () => {
  it('says so while they load, and offers Retry when they could not be read', () => {
    const { rerender } = render(<TableChips label="Call time tables" tables={{ tables: null, isError: false, retry: () => undefined }} value={[]} onChange={() => undefined} />);
    expect(screen.queryByRole('group', { name: 'Call time tables' })).toBeNull();
    rerender(<TableChips label="Call time tables" tables={{ tables: null, isError: true, retry: () => undefined }} value={[]} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: /Try again|Retry/ })).toBeDefined();
  });
});
