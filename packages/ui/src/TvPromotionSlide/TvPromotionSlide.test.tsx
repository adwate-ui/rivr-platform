import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvPromotionSlide } from './TvPromotionSlide.tsx';

const SLIDE = { label: 'Promotion', title: 'High hands', detail: 'Royal flush ₹25,000', when: 'Every night' };

describe('TvPromotionSlide', () => {
  it('shows the promotion large, what it gives and when it runs', () => {
    renderIn(<TvPromotionSlide {...SLIDE} />);
    expect(screen.getByRole('heading', { level: 1, name: 'High hands' })).toHaveClass('font-display', 'text-96');
    expect(screen.getByText('Royal flush ₹25,000')).toBeInTheDocument();
    expect(screen.getByText('Every night')).toBeInTheDocument();
  });

  it('marks its place in a rotation of several, quietly, and shows no pager alone', () => {
    const { rerender, container } = renderIn(<TvPromotionSlide {...SLIDE} pager={{ current: 2, count: 3, label: 'Promotion 2 of 3' }} />);
    const pager = screen.getByRole('img', { name: 'Promotion 2 of 3' });
    expect(pager.children).toHaveLength(3);
    expect(pager.children[1]).not.toHaveClass('opacity-hairline');
    expect(pager.children[0]).toHaveClass('bg-content', 'opacity-hairline');
    rerender(<TvPromotionSlide {...SLIDE} pager={{ current: 1, count: 1, label: 'Promotion 1 of 1' }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).not.toContain('1 of 1');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvPromotionSlide {...SLIDE} pager={{ current: 1, count: 2, label: 'Promotion 1 of 2' }} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
