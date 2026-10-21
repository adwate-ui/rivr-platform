import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { WebFooter } from './WebFooter.tsx';

const LINKS = [
  { label: '@rivr.pokerclub', href: 'https://www.instagram.com/rivr.pokerclub/' },
  { label: 'info@rivrpoker.com', href: 'mailto:info@rivrpoker.com' },
];

describe('WebFooter', () => {
  it('says where the club is, how to reach it, and its 18+ line', () => {
    renderIn(<WebFooter address="Glaza, M3M 65th Avenue, Gurugram" notice="Strictly 18+. Poker is a game of skill." links={LINKS} />);
    expect(screen.getByText('Glaza, M3M 65th Avenue, Gurugram')).toBeInTheDocument();
    expect(screen.getByText('Strictly 18+. Poker is a game of skill.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'info@rivrpoker.com' })).toHaveAttribute('href', 'mailto:info@rivrpoker.com');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<WebFooter address="Glaza, Gurugram" notice="Strictly 18+." links={LINKS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
