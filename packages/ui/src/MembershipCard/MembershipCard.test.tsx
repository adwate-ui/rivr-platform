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

  it('shows the photo it is given between the wordmark and the member\u2019s name (decision 0300)', () => {
    renderIn(<MembershipCard {...ARJUN} photo={<img alt="Your photo" src="data:," />} />);
    const photo = screen.getByRole('img', { name: 'Your photo' });
    expect(photo.parentElement).toHaveClass('flex-1', 'min-h-0');
    expect(screen.getByRole('img', { name: 'RIVR Poker Club' }).compareDocumentPosition(photo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(photo.compareDocumentPosition(screen.getByText('Arjun Mehta')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<MembershipCard {...ARJUN} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('sets the redesign\'s card with its number along the top and no QR (decision 0320)', () => {
    renderIn(<MembershipCard look="redesign" name="Ira Kapoor" tier="Founders' Circle" memberNumber="73" qr={<span>QR</span>} />);
    expect(screen.getByRole('article', { name: /membership card/i })).toHaveTextContent('No. 73');
    expect(screen.queryByText('QR')).toBeNull();
  });

  it('spans a phone\'s column on the player app, as the QR panel under it is centred in it, no wider than a phone (owner, 3 Nov)', () => {
    renderIn(<MembershipCard look="redesign" name="Ira Kapoor" tier="Founders' Circle" memberNumber="73" />);
    const card = screen.getByRole('article', { name: /membership card/i });
    expect(card).toHaveClass('w-full', 'max-w-phone');
    expect(card).not.toHaveClass('max-w-card');
  });
});
