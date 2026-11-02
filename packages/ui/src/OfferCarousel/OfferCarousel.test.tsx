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

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<OfferCarousel title="Tonight" countLabel="1 offer" offers={[{ id: 'a', title: 'Referral', offer: 'Chips', onOpen: () => undefined }]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
