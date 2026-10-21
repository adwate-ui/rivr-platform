import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TextBlock } from '../TextBlock/TextBlock.tsx';
import { WebBand } from './WebBand.tsx';

describe('WebBand', () => {
  it('holds its block in a band of its tone', () => {
    renderIn(<WebBand tone="cream"><TextBlock heading="A members' club" body="Dealers at every table." /></WebBand>);
    const band = screen.getByRole('heading', { level: 2, name: "A members' club" }).closest('[data-band]');
    expect(band).toHaveAttribute('data-band', 'cream');
    expect(band).toHaveClass('bg-cream');
  });

  it('has no accessibility violations on any tone', async () => {
    for (const tone of ['dark', 'deep', 'cream'] as const) {
      const { container, unmount } = renderIn(<WebBand tone={tone}><TextBlock body="Dealers at every table." /></WebBand>);
      expect(await axeViolations(container)).toEqual([]);
      unmount();
    }
  });
});
