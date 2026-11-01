import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { CallTimeTimer } from './CallTimeTimer.tsx';

describe('CallTimeTimer', () => {
  it('says the time left in hours and minutes, rounded up', () => {
    renderIn(<CallTimeTimer secondsLeft={4290} />);
    expect(screen.getByText('Call time 1 h 12 min left')).toBeInTheDocument();
  });

  it('says when the clock stands still while the player is away', () => {
    renderIn(<CallTimeTimer secondsLeft={2400} isPaused />);
    expect(screen.getByText('Call time paused, 40 min left')).toBeInTheDocument();
  });

  it('reads a last few seconds as a minute, and nothing left as done', () => {
    renderIn(<><CallTimeTimer secondsLeft={20} /><CallTimeTimer secondsLeft={0} /></>);
    expect(screen.getByText('Call time 1 min left')).toBeInTheDocument();
    expect(screen.getByText('Call time complete')).toHaveClass('text-content-muted');
  });

  it('as the seat card figure, names the clock and sets the time large in tabular figures', () => {
    renderIn(<CallTimeTimer secondsLeft={4290} size="figure" />);
    expect(screen.getByText('Call time left')).toBeInTheDocument();
    expect(screen.getByText('1 h 12 min')).toHaveClass('tabular-nums', 'text-28');
  });

  it('as a figure, says when it stands still, and nothing left as done', () => {
    renderIn(<><CallTimeTimer secondsLeft={2400} isPaused size="figure" /><CallTimeTimer secondsLeft={0} size="figure" /></>);
    expect(screen.getByText('Call time paused')).toBeInTheDocument();
    expect(screen.getByText('40 min')).toBeInTheDocument();
    expect(screen.getByText('Call time complete')).toBeInTheDocument();
  });
});
