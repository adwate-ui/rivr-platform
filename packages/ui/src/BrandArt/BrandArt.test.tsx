import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { BrandArt } from './BrandArt.tsx';

function resizeWindow(width: number, height: number) {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  window.dispatchEvent(new Event('resize'));
}

/** The fixed stage the art is drawn on. */
function stage(): HTMLElement | null {
  return screen.getByRole('img', { name: 'RIVR Poker Club' }).parentElement;
}

describe('BrandArt', () => {
  afterEach(() => resizeWindow(1024, 768));

  it('draws an app icon as the red card on its 96 px stage, scaled to the icon', () => {
    resizeWindow(192, 192);
    renderIn(<BrandArt art="icon" />);
    expect(stage()).toHaveStyle({ width: '96px', height: '96px', transform: 'scale(2)' });
    expect(screen.queryByText('Poker club')).toBeNull();
  });

  it('keeps the card inside the safe zone of a maskable or adaptive icon by drawing it on a larger stage', () => {
    resizeWindow(512, 512);
    renderIn(<BrandArt art="maskable" />);
    expect(stage()).toHaveStyle({ width: '112px' });
  });

  it('draws the wordmark and tagline for a splash screen or cover, fitted to the shorter side', () => {
    resizeWindow(1500, 500);
    renderIn(<BrandArt art="lockup" />);
    expect(screen.getByText('Poker club')).toBeInTheDocument();
    expect(stage()).toHaveStyle({ width: '400px', transform: 'scale(1.25)' });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<BrandArt art="icon" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
