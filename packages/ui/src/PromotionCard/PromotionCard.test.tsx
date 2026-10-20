import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PromotionCard } from './PromotionCard.tsx';

describe('PromotionCard', () => {
  it('shows the promotion, what it gives, and who and when, named by its title', () => {
    renderIn(<PromotionCard title="High hands" detail="Royal flush ₹25,000" runs="Every night" />);
    const card = screen.getByRole('article', { name: 'High hands' });
    expect(card).toHaveTextContent('High handsRoyal flush ₹25,000Every night');
    expect(screen.getByText('Every night')).toHaveClass('text-content-muted');
  });

  it('shows only what it is given', () => {
    renderIn(<PromotionCard title="Double points" />);
    expect(screen.getByRole('article', { name: 'Double points' })).toHaveTextContent(/^Double points$/);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PromotionCard title="Double points" runs="NLH 100/200 · Thursday, 14:00 to 20:00" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
