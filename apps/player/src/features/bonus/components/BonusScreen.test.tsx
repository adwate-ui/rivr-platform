import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BONUS_LINES, LATER, renderBonus } from './bonusTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Twenty lines given, the newest first, so Show earlier is offered. */
const TWENTY = Array.from({ length: 20 }, (_, index) => ({ ...BONUS_LINES[1], line_id: `g${index}`, reason: `Grant ${index}`, at: `2026-10-${String(index + 1).padStart(2, '0')}T18:00:00Z` }));

describe('Bonus (redesign of 15 Nov)', () => {
  it('shows the balance with what it is for, and its history at once, each line signed, with no rupee', async () => {
    const { historyAsked } = renderBonus();
    expect(await screen.findByText('1,250', {}, LATER)).toBeDefined();
    expect(screen.getByText('Balance')).toBeDefined();
    expect(screen.getByText('Use with your buy-in. Never expires.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'History' })).toBeDefined();
    expect(await screen.findByText('Buy-in · Table 3 · 15 Nov', {}, LATER)).toBeDefined();
    expect(screen.getByText('−1,000')).toBeDefined();
    expect(screen.getByText('Welcome bonus · 14 Nov')).toBeDefined();
    expect(screen.getByText('+1,500')).toBeDefined();
    expect(historyAsked).toEqual([{ p_limit: 20 }]);
    expect(screen.queryByRole('button', { name: 'Show earlier' })).toBeNull();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText(/chips/i)).toBeNull();
  });

  it('names the hand on a line a high hand paid (redesign RD-25)', async () => {
    renderBonus({ balance: 1_400_000, lines: [
      { line_id: 'h1', at: '2026-11-15T21:13:00Z', kind: 'credited', amount_paise: 1_000_000, reason: 'High hand bonus', table_name: null, hand: 'straight_flush', rank: 'nine' },
      ...BONUS_LINES,
    ] });
    expect(await screen.findByText('High hand: Straight flush, Nine high · 16 Nov', {}, LATER)).toBeDefined();
    expect(screen.getByText('+10,000')).toBeDefined();
    expect(screen.queryByText(/High hand bonus/)).toBeNull();
  });

  it('offers earlier lines once twenty are shown', async () => {
    const { historyAsked } = renderBonus({ balance: 3_000_000, lines: TWENTY });
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, LATER));
    await waitFor(() => expect(historyAsked).toEqual([{ p_limit: 20 }, { p_limit: 40 }]));
  });

  it('keeps its lines if earlier ones fail, and draws what came in in cream, never gold', async () => {
    renderBonus({ balance: 3_000_000, lines: TWENTY, isEarlierDown: true });
    const plus = (await screen.findAllByText('+1,500', {}, LATER))[0];
    expect(plus?.className).not.toContain('accent');
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, LATER));
    expect(await screen.findByRole('button', { name: 'Try again' }, LATER)).toBeDefined();
    expect(screen.getByText(/^Grant 0 · /)).toBeDefined();
  });

  it('shows no Bonus as 0 with an empty history', async () => {
    renderBonus({ balance: 0, lines: [] });
    expect(await screen.findByText('Nothing here yet.', {}, LATER)).toBeDefined();
    expect(screen.getByText('0')).toBeDefined();
  });

  it('offers Try again when the balance cannot be read, and says Bonus is for members to anyone else', async () => {
    renderBonus({ balance: 'down', lines: [] });
    expect(await screen.findByRole('button', { name: 'Try again' }, LATER)).toBeDefined();
    expect(screen.queryByText('Balance')).toBeNull();
    cleanup();
    renderBonus({ balance: 'none', lines: [] });
    expect(await screen.findByText('Bonus is for members.', {}, LATER)).toBeDefined();
  });

  it('copies the member’s invite link, with their code, and says so', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }));
    renderBonus();
    expect(await screen.findByText('RIVR4821', {}, LATER)).toBeDefined();
    expect(screen.getByText('2 joined')).toBeDefined();
    expect(screen.getByText('1,000 Bonus each when a friend joins and takes a first seat.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Invite link copied')).toBeDefined();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('RIVR4821'));
  });
});
