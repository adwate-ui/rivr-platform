import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Wordmark } from './Wordmark.tsx';

describe('Wordmark', () => {
  it('is one image named for the club, not four letters', () => {
    renderIn(<Wordmark />);
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' })).toBeInTheDocument();
  });

  it('sets each letter on a cream tile in the display face, then the red card', () => {
    const { container } = renderIn(<Wordmark />);
    const tiles = container.querySelectorAll('[role="img"] > div > span');
    expect([...tiles].map((tile) => tile.textContent)).toEqual(['R', 'I', 'V', 'R', '']);
    expect(tiles[0]).toHaveClass('bg-cream', 'font-display', 'text-on-cream');
    expect(tiles[4]).toHaveClass('bg-alert');
  });

  it('adds the letter-spaced tagline when asked, in the reader’s language', () => {
    renderIn(<Wordmark size="lg" withTagline />, 'hi');
    expect(screen.getByRole('img', { name: 'RIVR पोकर क्लब' })).toHaveTextContent('पोकर क्लब');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Wordmark withTagline />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
