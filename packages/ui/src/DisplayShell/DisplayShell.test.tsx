import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvStage } from '../TvStage/TvStage.tsx';
import { DisplayShell } from './DisplayShell.tsx';

function resizeWindow(width: number, height: number) {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  window.dispatchEvent(new Event('resize'));
}

/** The fixed stage that holds the TV's board. */
function stage(): HTMLElement | null {
  return screen.getByRole('main').parentElement;
}

describe('DisplayShell', () => {
  afterEach(() => resizeWindow(1024, 768));

  it('lays the board out on a 1920 by 1080 stage, and gives its header the clock and its foot the notice', () => {
    resizeWindow(1920, 1080);
    renderIn(
      // 00:10 IST.
      <DisplayShell clockAt={new Date('2026-11-15T18:40:00Z')} notice="Table 4 opens at 9 tonight.">
        <TvStage title="Waitlist"><p>No one waiting.</p></TvStage>
      </DisplayShell>,
    );
    expect(screen.getByRole('main')).toHaveTextContent('No one waiting.');
    expect(screen.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument();
    expect(screen.getByText('00:10')).toBeInTheDocument();
    expect(screen.getByText('Table 4 opens at 9 tonight.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' })).toBeInTheDocument();
    expect(stage()).toHaveStyle({ width: '1920px', height: '1080px', transform: 'scale(1)' });
  });

  it('scales the stage to fit a smaller screen without cropping', () => {
    resizeWindow(960, 1080);
    renderIn(
      <DisplayShell>
        <h1>Waitlist</h1>
      </DisplayShell>,
    );
    expect(stage()).toHaveStyle({ transform: 'scale(0.5)' });
  });

  it('follows the window when it is resized', () => {
    resizeWindow(1920, 1080);
    renderIn(
      <DisplayShell>
        <h1>Seats opening</h1>
      </DisplayShell>,
    );
    act(() => resizeWindow(3840, 2160));
    expect(stage()).toHaveStyle({ transform: 'scale(2)' });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(
      <DisplayShell clockAt={new Date('2026-11-15T18:40:00Z')} notice="Table 4 opens at 9 tonight.">
        <TvStage title="High hand bonus"><p>No high hand yet tonight.</p></TvStage>
      </DisplayShell>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
