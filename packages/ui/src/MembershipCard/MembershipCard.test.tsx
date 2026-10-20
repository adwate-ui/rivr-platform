import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { MembershipCard } from './MembershipCard.tsx';

const ARJUN = { name: 'Arjun Mehta', tier: 'Black card', memberNumber: '1024' } as const;

describe('MembershipCard', () => {
  it('names itself and shows the wordmark, the member, their tier and number', () => {
    renderIn(<MembershipCard {...ARJUN} />);
    const card = screen.getByRole('article', { name: 'Membership card' });
    expect(card).toContainElement(screen.getByRole('img', { name: 'RIVR Poker Club' }));
    expect(screen.getByText('Arjun Mehta')).toBeInTheDocument();
    expect(screen.getByText('Black card')).toBeInTheDocument();
    expect(screen.getByText('No. 1024')).toBeInTheDocument();
  });

  it('keeps the ID-1 shape and never grows past the card width', () => {
    renderIn(<MembershipCard {...ARJUN} />);
    expect(screen.getByRole('article')).toHaveClass('aspect-card', 'w-full', 'max-w-card');
  });

  it('draws the QR it is given in the cream square', () => {
    renderIn(<MembershipCard {...ARJUN} qr={<svg role="img" aria-label="Door code" />} />);
    expect(screen.getByRole('img', { name: 'Door code' }).parentElement).toHaveClass('bg-cream', 'aspect-square');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<MembershipCard {...ARJUN} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
