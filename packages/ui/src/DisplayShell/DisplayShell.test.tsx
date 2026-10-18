import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DisplayShell } from './DisplayShell.tsx';

function resizeWindow(width: number, height: number) {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  window.dispatchEvent(new Event('resize'));
}

/** The fixed stage that holds the header and the TV mode. */
function stage(): HTMLElement | null {
  return screen.getByRole('main').parentElement;
}

describe('DisplayShell', () => {
  afterEach(() => resizeWindow(1024, 768));

  it('lays the TV mode out on a 1920 by 1080 stage under the wordmark, with the clock opposite', () => {
    resizeWindow(1920, 1080);
    renderIn(
      <DisplayShell corner={<p>00:10</p>}>
        <h1>Bad-beat jackpot</h1>
      </DisplayShell>,
    );
    expect(screen.getByRole('main')).toHaveTextContent('Bad-beat jackpot');
    expect(screen.getByRole('banner')).toHaveTextContent('00:10');
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
        <h1>Tournament clock</h1>
      </DisplayShell>,
    );
    act(() => resizeWindow(3840, 2160));
    expect(stage()).toHaveStyle({ transform: 'scale(2)' });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(
      <DisplayShell>
        <h1>High hand</h1>
      </DisplayShell>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
