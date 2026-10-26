import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { CardsBlock } from './CardsBlock.tsx';

const CARDS = [
  { label: '01', title: 'Play', text: 'The game, done properly.', points: ['Professional dealers'] },
  { label: '02', title: 'Connect', link: { label: 'See what’s on', href: '/tournaments' } },
];

describe('CardsBlock', () => {
  it('shows each card with its label, text, points and link, and the quote beneath', () => {
    renderIn(<CardsBlock heading="What we stand for" cards={CARDS} quote="The next decision." />);
    expect(screen.getByRole('heading', { level: 2, name: 'What we stand for' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Play' })).toBeInTheDocument();
    expect(screen.getByText('Professional dealers')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See what’s on: Connect' })).toHaveAttribute('href', '/tournaments');
    expect(screen.getByText('The next decision.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<CardsBlock heading="What we stand for" cards={CARDS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
