import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BONUS_LINES, LATER, renderRewards } from './rewardsTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Rewards: the histories', () => {
  describe('the points history (F-054)', () => {
    const LINES = Array.from({ length: 20 }, (_, index) => ({ line_id: `p${index}`, at: `2026-10-${String(index + 1).padStart(2, '0')}T18:00:00Z`, kind: 'earned', points: 250, reason: `Visit ${index}` }));

    it('offers no history where the tier does not have it', async () => {
      renderRewards(3250, undefined, { pointsHistory: 'hidden' });
      expect(await screen.findByText('Spend on rewards.', {}, LATER)).toBeDefined();
      expect(screen.queryByRole('button', { name: /Spend on rewards/ })).toBeNull();
    });

    it('says which tiers have it where it is locked, and shows no lines', async () => {
      renderRewards(3250, undefined, { pointsHistory: 'locked' });
      fireEvent.click(await screen.findByRole('button', { name: /Spend on rewards/ }, LATER));
      expect(await screen.findByText('Black card only.', {}, LATER)).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Points history' })).toBeNull();
    });

    it('draws what came in in cream and what went or is locked muted, never gold (decision 0463)', async () => {
      renderRewards();
      fireEvent.click(await screen.findByRole('button', { name: /Spend on rewards/ }, LATER));
      const plus = await screen.findByText('+250', {}, LATER);
      expect(plus.className).toContain('text-content');
      expect(plus.className).not.toContain('accent');
      expect(screen.getByText('−500').className).toContain('text-content-muted');
    });

    it('keeps its lines while more come, and if they fail says so under them', async () => {
      let answerEarlier: (reply: Response) => void = () => undefined;
      renderRewards(3250, undefined, {
        pointsReply: (asked) => (asked.p_limit === 20 ? Response.json(LINES) : new Promise<Response>((resolve) => { answerEarlier = resolve; })),
      });
      fireEvent.click(await screen.findByRole('button', { name: /Spend on rewards/ }, LATER));
      fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, LATER));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByText(/^Visit 0 · /)).toBeDefined();
      answerEarlier(Response.json({ code: 'XX000', message: 'down' }, { status: 500 }));
      expect(await screen.findByRole('button', { name: 'Try again' }, LATER)).toBeDefined();
      expect(screen.getByText(/^Visit 0 · /)).toBeDefined();
    });
  });

  it('keeps the bonus chips lines if earlier ones fail, and draws them in cream', async () => {
    const lines = Array.from({ length: 20 }, (_, index) => ({ ...BONUS_LINES[1], line_id: `g${index}`, reason: `Grant ${index}`, at: `2026-10-${String(index + 1).padStart(2, '0')}T18:00:00Z` }));
    renderRewards(3250, { balance: 3_000_000, lines, isEarlierDown: true });
    fireEvent.click(await screen.findByRole('button', { name: /Bonus chips/ }, LATER));
    const plus = (await screen.findAllByText('+1,500', {}, LATER))[0];
    expect(plus?.className).not.toContain('accent');
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, LATER));
    expect(await screen.findByRole('button', { name: 'Try again' }, LATER)).toBeDefined();
    expect(screen.getByText(/^Grant 0 · /)).toBeDefined();
  });
});
