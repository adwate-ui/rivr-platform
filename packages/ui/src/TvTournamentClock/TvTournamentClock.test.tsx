import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvTournamentClock } from './TvTournamentClock.tsx';

const CLOCK = {
  name: 'RIVR Sunday', level: 'Level 7', remaining: '11:29', blinds: '400/800', ante: 'Ante 800', next: 'Next 500/1,000 ante 1,000',
  stats: [{ label: 'Players', value: '31' }, { label: 'Pool', value: '₹5,22,000' }],
  payoutsLabel: 'Payouts', noPayoutsText: 'Payouts are set when registration closes.',
};

describe('TvTournamentClock', () => {
  it('shows the level, the time left as the largest figure, the blinds and the next level', () => {
    renderIn(<TvTournamentClock {...CLOCK} payouts={[]} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Level 7' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('11:29');
    expect(screen.getByRole('timer')).toHaveClass('text-280');
    expect(screen.getByText('400/800')).toBeInTheDocument();
    expect(screen.getByText('Ante 800')).toBeInTheDocument();
    expect(screen.getByText('Next 500/1,000 ante 1,000')).toBeInTheDocument();
  });

  it('names each figure under the clock', () => {
    renderIn(<TvTournamentClock {...CLOCK} payouts={[]} />);
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Players', 'Pool']);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['31', '₹5,22,000']);
  });

  it('lists the payouts by place, or says when they are not set yet', () => {
    const { rerender } = renderIn(<TvTournamentClock {...CLOCK} payouts={[{ place: '1', amount: 15_660_000n }, { place: '2', amount: 10_440_000n }]} />);
    expect(screen.getByRole('region', { name: 'Payouts' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('₹1,56,600')).toBeInTheDocument();
    rerender(<TvTournamentClock {...CLOCK} payouts={[]} />);
    expect(screen.getByText('Payouts are set when registration closes.')).toBeInTheDocument();
  });

  it('shows the first nine paid places of a big field, so the figures under the clock stay on the stage', () => {
    const payouts = Array.from({ length: 15 }, (_, index) => ({ place: String(index + 1), amount: 1_000_000n }));
    renderIn(<TvTournamentClock {...CLOCK} payouts={payouts} />);
    expect(screen.getAllByRole('listitem').map((item) => item.firstChild?.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(screen.getAllByRole('term')).toHaveLength(2);
  });

  it('says when the clock is paused', () => {
    renderIn(<TvTournamentClock {...CLOCK} payouts={[]} status="Paused" />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvTournamentClock {...CLOCK} payouts={[{ place: '1', amount: 15_660_000n }]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
