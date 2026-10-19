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
    expect(screen.getByText('Call time done')).toHaveClass('text-content-muted');
  });
});
