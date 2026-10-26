import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TournamentClock } from './TournamentClock.tsx';

const CLOCK = { title: 'RIVR Sunday · level 7', remaining: '11:34', blinds: '400/800 ante 800', next: 'Next 500/1,000 ante 1,000' };

describe('TournamentClock', () => {
  it('shows the tournament and level, the time left as the largest figure, the blinds and the next level', () => {
    renderIn(<TournamentClock {...CLOCK} />);
    expect(screen.getByRole('region', { name: 'RIVR Sunday · level 7' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('11:34');
    expect(screen.getByRole('timer')).toHaveClass('text-56');
    expect(screen.getByText('400/800 ante 800')).toBeInTheDocument();
    expect(screen.getByText('Next 500/1,000 ante 1,000')).toBeInTheDocument();
  });

  it('says when the clock is not running, and shows no next level on the last', () => {
    renderIn(<TournamentClock {...CLOCK} next={undefined} status="Paused" />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.queryByText(/^Next/)).not.toBeInTheDocument();
  });

  it('names each figure under the clock, and shows no row without figures', () => {
    const { rerender } = renderIn(<TournamentClock {...CLOCK} stats={[{ label: 'Entries', value: '58' }, { label: 'Pool', value: '₹5,22,000' }]} />);
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Entries', 'Pool']);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['58', '₹5,22,000']);
    rerender(<TournamentClock {...CLOCK} />);
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
  });

  it('puts the floor’s controls under the clock, reachable by keyboard', async () => {
    const onNext = vi.fn();
    renderIn(<TournamentClock {...CLOCK} actions={<Button variant="text" onClick={onNext}>Next level</Button>} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Next level' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TournamentClock {...CLOCK} status="Paused" stats={[{ label: 'Entries', value: '58' }]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
