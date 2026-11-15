import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvStage } from './TvStage.tsx';

// 02:43 IST.
const NOW = new Date('2026-11-15T21:13:00Z');

describe('TvStage', () => {
  it('heads a board with the wordmark, its title beside it and the club\'s time, and runs the notice along the foot', () => {
    renderIn(
      <DisplayShell clockAt={NOW} notice="Table 4 opens at 9 tonight.">
        <TvStage title="Waitlist"><p>No one waiting.</p></TvStage>
      </DisplayShell>,
    );
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' })).toBeInTheDocument();
    expect(screen.queryByText('Poker club')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Waitlist' })).toHaveClass('font-display');
    expect(screen.getByText('02:43')).toHaveAttribute('datetime', NOW.toISOString());
    expect(screen.getByText('No one waiting.')).toBeInTheDocument();
    expect(screen.getByText('Table 4 opens at 9 tonight.').parentElement).toHaveClass('border-t', 'border-accent');
  });

  it('has no rule and no line at the foot with no notice, and no clock where the shell gives none', () => {
    const { container } = renderIn(<DisplayShell><TvStage title="Waitlist"><p>No one waiting.</p></TvStage></DisplayShell>);
    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelector('time')).toBeNull();
  });

  it('titles the stage at level 2 where it is a preview inside another screen, and has no title on a screen with none', () => {
    const { rerender } = renderIn(<TvStage title="Promotions" level={2}><p>Offer</p></TvStage>);
    expect(screen.getByRole('heading', { level: 2, name: 'Promotions' })).toBeInTheDocument();
    rerender(<TvStage><p>Loading</p></TvStage>);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(
      <DisplayShell clockAt={NOW} notice="Table 4 opens at 9 tonight.">
        <TvStage title="Waitlist"><p>No one waiting.</p></TvStage>
      </DisplayShell>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
