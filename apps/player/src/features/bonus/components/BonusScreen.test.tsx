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
    // Each line: what it was, its day beneath, and its Bonus (redesign RD-20).
    const used = (await screen.findByText('Buy-in · Table 3', {}, LATER)).closest('div');
    expect(used?.textContent).toBe('Buy-in · Table 315 Nov−1,000');
    expect(screen.getByText('Welcome bonus').closest('div')?.textContent).toBe('Welcome bonus14 Nov+1,500');
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
    expect(await screen.findByText('High hand: Straight flush, Nine high', {}, LATER)).toBeDefined();
    expect(screen.getByText('+10,000')).toBeDefined();
    expect(screen.queryByText(/High hand bonus/)).toBeNull();
  });

  it('offers earlier lines once twenty are shown', async () => {
    const { historyAsked } = renderBonus({ balance: 3_000_000, lines: TWENTY });
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, LATER));
    await waitFor(() => expect(historyAsked).toEqual([{ p_limit: 20 }, { p_limit: 40 }]));
  });

  it('keeps its lines if earlier ones fail, and draws what came in gold, as the redesign has it', async () => {
    renderBonus({ balance: 3_000_000, lines: TWENTY, isEarlierDown: true });
    const plus = (await screen.findAllByText('+1,500', {}, LATER))[0];
    expect(plus?.className).toContain('text-accent');
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, LATER));
    expect(await screen.findByRole('button', { name: 'Try again' }, LATER)).toBeDefined();
    expect(screen.getByText('Grant 0')).toBeDefined();
  });

  it('draws what went out muted', async () => {
    renderBonus();
    expect((await screen.findByText('−1,000', {}, LATER)).className).toContain('text-content-muted');
  });

  it.each([
    [null, 'Use with your buy-in. Never expires.'],
    [0, 'Use with your buy-in. Never expires.'],
    [1, 'Use with your buy-in. Expires after 1 day.'],
    [30, 'Use with your buy-in. Expires after 30 days.'],
  ])('says under the balance what the club\'s "Bonus expires" setting says: %s days', async (expiryDays, line) => {
    renderBonus({ balance: 125_000, lines: [], expiryDays });
    expect(await screen.findByText(line, {}, LATER)).toBeDefined();
  });

  it('shows the balance large in cream, under its name, with no icon', async () => {
    renderBonus({ balance: 1_400_000, lines: [] });
    const figure = await screen.findByText('14,000', {}, LATER);
    expect(figure.className).toContain('font-display');
    expect(figure.className).not.toContain('text-money');
    expect(figure.previousElementSibling?.textContent).toBe('Balance');
    expect(figure.parentElement?.querySelector('svg')).toBeNull();
  });

  it('offers the invite with no word of a reward while no referral promotion is live', async () => {
    renderBonus({ balance: 125_000, lines: [], referralBonus: null });
    expect(await screen.findByText('RIVR4821', {}, LATER)).toBeDefined();
    expect(screen.getByText('Refer a friend')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Share invite' })).toBeDefined();
    expect(document.body.textContent).not.toMatch(/Bonus each|for you both|first seat|reward/i);
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
    // A referral promotion is live, so the reward is promised (redesign RD-20).
    expect(screen.getByText('1,000 Bonus each. When a friend joins and takes a first seat.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Invite link copied')).toBeDefined();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('RIVR4821'));
  });
});
