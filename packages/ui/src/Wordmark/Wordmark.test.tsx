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

  it('adds the letter-spaced tagline when asked', () => {
    renderIn(<Wordmark size="lg" withTagline />);
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' })).toHaveTextContent('Poker club');
  });

  it('sets the motto beneath the mark as text a screen reader reads, in the display face', () => {
    renderIn(<Wordmark size="lg" withTagline withMotto />);
    const motto = screen.getByText('Skill runs deep.');
    expect(motto).toHaveClass('font-display', 'italic');
    expect(motto.closest('[role="img"]')).toBeNull();
  });

  it('centres the mark, the tagline and the motto when asked', () => {
    const { container } = renderIn(<Wordmark size="lg" withTagline withMotto align="center" />);
    expect(container.firstElementChild).toHaveClass('items-center');
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' })).toHaveClass('items-center');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Wordmark withTagline withMotto />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
