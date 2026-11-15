import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvPromotionSlide } from './TvPromotionSlide.tsx';

const SLIDE = { board: 'Promotions', label: 'Offer', title: 'Friday four-hour bonus', detail: '1,000 Bonus after 4 hours', when: 'Every day, all tables' };

describe('TvPromotionSlide', () => {
  it('shows the promotion large under the board\'s title, its label in gold, what it gives and when it runs', () => {
    renderIn(<TvPromotionSlide {...SLIDE} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Promotions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Friday four-hour bonus' })).toHaveClass('font-display', 'text-96');
    expect(screen.getByText('Offer')).toHaveClass('uppercase', 'text-accent');
    expect(screen.getByText('1,000 Bonus after 4 hours')).toBeInTheDocument();
    expect(screen.getByText('Every day, all tables')).toBeInTheDocument();
  });

  it('marks its place in a rotation of several with a gold pill among quiet dots, and shows no pager alone', () => {
    const { rerender, container } = renderIn(<TvPromotionSlide {...SLIDE} pager={{ current: 2, count: 3, label: 'Promotion 2 of 3' }} />);
    const pager = screen.getByRole('img', { name: 'Promotion 2 of 3' });
    expect(pager.children).toHaveLength(3);
    expect(pager.children[1]).toHaveClass('w-12', 'bg-accent');
    expect(pager.children[1]).not.toHaveClass('opacity-hairline');
    expect(pager.children[0]).toHaveClass('w-4', 'bg-content', 'opacity-hairline');
    rerender(<TvPromotionSlide {...SLIDE} pager={{ current: 1, count: 1, label: 'Promotion 1 of 1' }} />);
    expect(screen.queryByRole('img', { name: /^Promotion/ })).toBeNull();
    expect(container.textContent).not.toContain('1 of 1');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvPromotionSlide {...SLIDE} pager={{ current: 1, count: 2, label: 'Promotion 1 of 2' }} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('titles the board at level 2 and the promotion at 3 where it is a preview inside another screen, so that screen keeps its one h1', () => {
    renderIn(<TvPromotionSlide {...SLIDE} level={2} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Promotions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Friday four-hour bonus' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
