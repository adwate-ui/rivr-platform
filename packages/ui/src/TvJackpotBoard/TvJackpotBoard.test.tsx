import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvJackpotBoard } from './TvJackpotBoard.tsx';

const BOARD = {
  label: 'Bad-beat jackpot', amount: 34_260_000n, highHandLabel: 'High hand tonight', noHighHandText: 'No high hand yet tonight.',
};

describe('TvJackpotBoard', () => {
  it('shows the jackpot figure, and tonight\'s high hand beneath it', () => {
    renderIn(<TvJackpotBoard {...BOARD} highHand={{ title: 'Four of a kind, Queens', line: 'Table 2 · 22:18 · ₹2,000' }} />);
    expect(screen.getByText('₹3,42,600')).toHaveClass('font-display', 'text-280');
    expect(screen.getByRole('heading', { level: 2, name: 'Four of a kind, Queens' })).toBeInTheDocument();
    expect(screen.getByText('Table 2 · 22:18 · ₹2,000')).toBeInTheDocument();
  });

  it('says when no high hand is paid yet tonight', () => {
    renderIn(<TvJackpotBoard {...BOARD} highHand={null} />);
    expect(screen.getByText('No high hand yet tonight.')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvJackpotBoard {...BOARD} highHand={null} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
