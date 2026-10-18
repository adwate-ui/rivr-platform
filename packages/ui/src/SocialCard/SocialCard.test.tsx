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
  it('draws a feed post at 1080 by 1350 under the wordmark: label, title, the figure in gold and its details', () => {
    renderIn(<SocialCard format="feed" {...WINNER} />);
    expect(screen.getByRole('article')).toHaveStyle({ width: '1080px', height: '1350px' });
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Arjun M.' })).toBeInTheDocument();
    expect(screen.getByText('₹5,00,000')).toHaveClass('text-money');
    expect(screen.getByText('RIVR Sunday')).toBeInTheDocument();
    expect(screen.getByText(WINNER.venue)).toBeInTheDocument();
  });

  it('draws a story at 1080 by 1920', () => {
    renderIn(<SocialCard format="story" {...WINNER} />);
    expect(screen.getByRole('article')).toHaveStyle({ width: '1080px', height: '1920px' });
  });

  it('shows no figure when the card has none, such as a promotion', () => {
    renderIn(<SocialCard format="feed" label="Promotion" title="Double points" details={['Thursday, 14:00 to 20:00']} venue={WINNER.venue} />);
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SocialCard format="feed" {...WINNER} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
