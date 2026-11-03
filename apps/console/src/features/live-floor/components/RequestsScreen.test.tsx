import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, renderFloorScreen, requestRow, seatRow, tableRow } from './floorTestApi.tsx';
import { RequestsScreen } from './RequestsScreen.tsx';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const API = {
  tables: [tableRow('t1', 'Table 1')],
  seats: [seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi', time: { id: 'r1', minutes: 60 } })],
  requests: [requestRow({ kind: 'time', id: 'r1', name: 'Kabir Sethi', minutes: 7, session_id: 's2', table_id: 't1', seat: 5, asked: 60, call_time_left: 600 })],
  queues: [{ queue: 'kycReview', waiting: 2 }, { queue: 'feedback', waiting: 4 }],
};

describe('Requests on a phone (console v3)', () => {
  it('lists the floor\'s requests as a screen, late in danger, with what else waits below', async () => {
    renderFloorScreen(RequestsScreen, API);
    expect(await screen.findByRole('heading', { name: 'Requests' }, { timeout: 5000 })).toBeDefined();
    expect(await screen.findByText('Wants +1 h')).toBeDefined();
    expect(screen.getByText('Table 1, seat 5 · 10 min left')).toBeDefined();
    expect(screen.getByText('7 min').className).toContain('text-danger');
    expect(await screen.findByText('Also waiting')).toBeDefined();
    expect(screen.getByRole('button', { name: /KYC checks/ })).toBeDefined();
    expect(screen.queryByText('Spins to do')).toBeNull();
  });

  it('approves more time with Undo, which calls the database\'s undo', async () => {
    const { rpcs } = renderFloorScreen(RequestsScreen, API);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }, { timeout: 5000 }));
    await screen.findByText('Kabir Sethi: +1 h approved');
    expect(rpcs('decide_call_time_request')).toEqual([{ p_request_id: 'r1', p_is_approved: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_call_time')).toEqual([{ p_request_id: 'r1' }]));
  });

  it('opens the player\'s sheet from their name', async () => {
    renderFloorScreen(RequestsScreen, API);
    fireEvent.click(await screen.findByRole('button', { name: 'Kabir Sethi' }, { timeout: 5000 }));
    expect(await screen.findByRole('dialog', { name: 'Kabir Sethi' })).toBeDefined();
  });

  it('has nothing for staff who are not the floor', async () => {
    renderFloorScreen(RequestsScreen, { ...API, role: 'marketing' });
    expect(await screen.findByText('All clear.', {}, { timeout: 5000 })).toBeDefined();
  });
});
