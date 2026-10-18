import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SocialCard } from './SocialCard.tsx';

const WINNER = {
  label: 'Winner',
  title: 'Arjun M.',
  amountPaise: 50_000_000n,
  details: ['RIVR Sunday', '15 Nov 2026'],
  venue: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram',
} as const;

describe('SocialCard', () => {
  it('draws the wordmark, the label, the title, the figure in gold, its details and the venue', () => {
    renderIn(<SocialCard {...WINNER} />);
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Arjun M.' })).toBeInTheDocument();
    expect(screen.getByText('₹5,00,000')).toHaveClass('text-money');
    expect(screen.getByText('RIVR Sunday')).toBeInTheDocument();
    expect(screen.getByText(WINNER.venue)).toBeInTheDocument();
  });

  it('fills the page it is drawn on, so the render request alone sets the size', () => {
    renderIn(<SocialCard {...WINNER} />);
    expect(screen.getByRole('article')).toHaveClass('h-dvh', 'w-full');
  });

  it('says what the figure is directly beneath it', () => {
    renderIn(<SocialCard {...WINNER} label="Tournament" title="RIVR Sunday" amountLabel="Guaranteed" />);
    expect(screen.getByText('₹5,00,000').nextElementSibling).toHaveTextContent('Guaranteed');
  });

  it('makes the title the hero when the card has no figure, such as a promotion', () => {
    renderIn(<SocialCard label="Promotion" title="Double points" details={['Thursday, 14:00 to 20:00']} venue={WINNER.venue} />);
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Double points' })).toHaveClass('text-96');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SocialCard {...WINNER} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
