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
    const { unmount } = renderIn(<BrandArt art="maskable" />);
    expect(stage()).toHaveStyle({ width: '112px' });
    unmount();
    renderIn(<BrandArt art="adaptive" />);
    expect(stage()).toHaveStyle({ width: '140px' });
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

  it('draws a shared link\'s image as the lockup filling the left half beside the photograph, marked a concept (AS-09)', () => {
    resizeWindow(1200, 630);
    const { container } = renderIn(<BrandArt art="share" backdrop="/brand/share-room.jpg" />);
    // A 400 px stage fits the 600 by 630 half: a stage twice as wide fits the whole page.
    expect(stage()).toHaveStyle({ width: '400px', transform: 'scale(1.5)' });
    expect(container.querySelector('img')).toHaveAttribute('src', '/brand/share-room.jpg');
    expect(screen.getByText('Concept visualisation')).toBeInTheDocument();
  });

  it('draws the lockup alone for a share image with no photograph, never an empty picture', () => {
    resizeWindow(1200, 630);
    const { container } = renderIn(<BrandArt art="share" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Poker club')).toBeInTheDocument();
  });
});
