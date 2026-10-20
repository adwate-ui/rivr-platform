import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DisplayPreview } from './DisplayPreview.tsx';

describe('DisplayPreview', () => {
  it('shows a TV stage, wordmark and all, named for what it previews, inside the console\'s own main', () => {
    renderIn(<main><DisplayPreview label="TV slide"><p>Double points</p></DisplayPreview></main>);
    expect(screen.getByRole('group', { name: 'TV slide' })).toHaveTextContent('Double points');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('draws the 1920 by 1080 stage scaled down to the box, and the box as tall as the stage drawn', () => {
    renderIn(<DisplayPreview label="TV slide">{null}</DisplayPreview>);
    const preview = screen.getByRole('group', { name: 'TV slide' });
    const stage = preview.firstElementChild?.firstElementChild;
    expect(stage instanceof HTMLElement ? [stage.style.width, stage.style.transform, stage.style.transformOrigin] : null)
      .toEqual(['1920px', 'scale(0.25)', 'top left']);
    expect(preview.style.height).toBe('270px');
  });

  it('has no accessibility violations inside a page\'s main', async () => {
    const { container } = renderIn(<main><DisplayPreview label="TV slide"><p>Double points</p></DisplayPreview></main>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
