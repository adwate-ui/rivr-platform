import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PromotionsBlock } from './PromotionsBlock.tsx';

const PROMOTIONS = [{ title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' }, { title: 'High hands' }];

describe('PromotionsBlock', () => {
  it('shows each live promotion, and says when none runs', () => {
    const { unmount } = renderIn(<PromotionsBlock heading="On the house" promotions={PROMOTIONS} emptyText="None running." />);
    expect(screen.getByRole('heading', { level: 3, name: 'Referral' })).toBeInTheDocument();
    expect(screen.getByText('Every day')).toBeInTheDocument();
    unmount();
    renderIn(<PromotionsBlock promotions={[]} emptyText="None running." />);
    expect(screen.getByText('None running.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PromotionsBlock heading="On the house" promotions={PROMOTIONS} emptyText="None running." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
