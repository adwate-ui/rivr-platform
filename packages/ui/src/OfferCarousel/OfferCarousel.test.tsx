import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { OfferCarousel } from './OfferCarousel.tsx';

describe('OfferCarousel', () => {
  it('heads the offers with the title and the count, and opens a linked one', async () => {
    const onOpen = vi.fn();
    renderIn(<OfferCarousel title="Tonight" countLabel="2 offers" offers={[
      { id: 'a', title: 'Referral', offer: '1,000 bonus chips each', schedule: 'Every day', onOpen },
      { id: 'b', title: 'Happy hour', offer: '2-for-1 at the Glaza bar' },
    ]} />);
    expect(screen.getByRole('heading', { name: 'Tonight' })).toBeInTheDocument();
    expect(screen.getByText('2 offers')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Referral/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Happy hour/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  // Issue 776: a promotion's card may carry a link.
  it('makes a card with an address a link that opens in a new tab', () => {
    renderIn(<OfferCarousel title="Tonight" countLabel="1 offer" offers={[
      { id: 'a', title: 'Happy hour', offer: '2-for-1 at the Glaza bar', href: 'https://glaza.example/happy-hour' },
    ]} />);
    const card = screen.getByRole('link', { name: /Happy hour/ });
    expect(card).toHaveAttribute('href', 'https://glaza.example/happy-hour');
    expect(card).toHaveAttribute('target', '_blank');
    expect(card).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ignores an address that is not https, so the card only says its offer', () => {
    renderIn(<OfferCarousel title="Tonight" countLabel="1 offer" offers={[{ id: 'a', title: 'Happy hour', offer: '2-for-1', href: 'javascript:alert(1)' }]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('2-for-1')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<OfferCarousel title="Tonight" countLabel="2 offers" offers={[
      { id: 'a', title: 'Referral', offer: 'Chips', onOpen: () => undefined },
      { id: 'b', title: 'Happy hour', offer: '2-for-1', href: 'https://glaza.example/happy-hour' },
    ]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
