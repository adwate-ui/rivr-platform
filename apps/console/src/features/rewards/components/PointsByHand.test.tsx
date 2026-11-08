import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PointsByHand } from './PointsByHand.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const MIHIR = { member_id: '00000000-0000-4000-8000-000000000213', full_name: 'Mihir Shah', member_number: 1042, earned: 1200, locked: 0 };

/**
 * Aditya, who gives points, signed in (a super admin when `canGiveBonus`), and a fake API that finds Mihir by his number;
 * the League points and the bonus chips it was asked to give.
 */
function renderPoints(canGiveBonus = false) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const given: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/member_points')) return Response.json([MIHIR]);
    if (url.includes('/rpc/give_bonus_chips')) {
      given.push(JSON.parse(String(init?.body)));
      return Response.json('g1');
    }
    if (url.includes('/rpc/give_league_points')) {
      given.push(JSON.parse(String(init?.body)));
      return Response.json([{ members: 1, points: 40 }]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <PointsByHand venueId="v1" canGiveBonus={canGiveBonus} />
    </RivrDataProvider>,
  );
  return given;
}

/** Finds Mihir by his number, and waits for his points. */
async function findMihir() {
  fireEvent.change(screen.getByLabelText('Member’s mobile number'), { target: { value: '9000000213' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find' }));
  await screen.findByLabelText('Points to give or release', {}, { timeout: 5000 });
}

describe('PointsByHand', () => {
  it('lets a super admin add bonus chips to the member found, where points are given (the owner, 9 Nov)', async () => {
    const given = renderPoints(true);
    expect(screen.getByRole('heading', { name: 'Points and bonus chips by hand' })).toBeDefined();
    await findMihir();
    fireEvent.change(screen.getByRole('textbox', { name: /^Bonus chips/ }), { target: { value: '500' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Reason for chips/ }), { target: { value: 'Birthday at the club' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add bonus chips' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add 500 bonus chips' }));
    expect(await screen.findByText('500 bonus chips added.')).toBeDefined();
    expect(given).toEqual([{ p_member_id: MIHIR.member_id, p_chips: 500, p_reason: 'Birthday at the club', p_request_id: expect.any(String) }]);
  });

  it('gives other staff points only', async () => {
    renderPoints();
    expect(screen.getByRole('heading', { name: 'Points by hand' })).toBeDefined();
    await findMihir();
    expect(screen.queryByRole('button', { name: 'Add bonus chips' })).toBeNull();
  });

  it('gives League points to the member found, by their member number, and says so (L-01)', async () => {
    const given = renderPoints();
    fireEvent.change(screen.getByLabelText('Member’s mobile number'), { target: { value: '9000000213' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find' }));
    fireEvent.change(await screen.findByLabelText('Points to give or release', {}, { timeout: 5000 }), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'November League night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Give League points' }));
    expect(await screen.findByText('40 League points given to Mihir Shah.')).toBeDefined();
    expect(given).toEqual([
      expect.objectContaining({ p_venue_id: 'v1', p_rows: [{ member_number: 1042, points: 40 }], p_reason: 'November League night' }),
    ]);
  });
});
