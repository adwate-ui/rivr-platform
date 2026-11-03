import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { NoticeCard } from './NoticeCard.tsx';

describe('NoticeCard', () => {
  it('is an article named by its eyebrow, with the notice in full and nothing to close it (decision 0424)', () => {
    renderIn(<NoticeCard label="From the club" text={'Launch night is Sunday.\nDetails: https://rivrpoker.com/launch'} />);
    const card = screen.getByRole('article', { name: 'From the club' });
    expect(card).toHaveTextContent('Launch night is Sunday.Details: rivrpoker.com/launch');
    expect(screen.getByRole('link', { name: 'rivrpoker.com/launch' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no accessibility violations, two at once as Tonight shows them', async () => {
    const { container } = renderIn(
      <>
        <NoticeCard label="From the club" text="Open till 4 tonight." />
        <NoticeCard label="From the club" text={'Launch night is Sunday.\nDetails: https://rivrpoker.com/launch'} />
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
