import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PromotionPager } from './PromotionPager.tsx';

const CARDS = [
  { id: 'tue', title: 'Buy-in bonus Tuesday', runs: 'Tuesday · all stakes' },
  { id: 'ref', title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' },
];
const LABELS = ['Promotion 1 of 2', 'Promotion 2 of 2'];

describe('PromotionPager', () => {
  it('shows one card at a time, and its dot says which', () => {
    renderIn(<PromotionPager label="Promotions" cards={CARDS} pageLabels={LABELS} />);
    expect(screen.getByRole('region', { name: 'Promotions' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Buy-in bonus Tuesday' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Referral' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Promotion 1 of 2' })).toHaveAttribute('aria-current', 'true');
  });

  it('shows another card when its dot is pressed', () => {
    renderIn(<PromotionPager label="Promotions" cards={CARDS} pageLabels={LABELS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Promotion 2 of 2' }));
    expect(screen.getByRole('article', { name: 'Referral' })).toHaveTextContent('₹1,000 to each side');
    expect(screen.getByRole('button', { name: 'Promotion 1 of 2' })).not.toHaveAttribute('aria-current');
  });

  it('shows no dots for one card, and nothing for none', () => {
    const { rerender, container } = renderIn(<PromotionPager label="Promotions" cards={CARDS.slice(0, 1)} pageLabels={LABELS.slice(0, 1)} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<PromotionPager label="Promotions" cards={[]} pageLabels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PromotionPager label="Promotions" cards={CARDS} pageLabels={LABELS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
