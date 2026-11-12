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

  // The owner, 12 Nov: the member's ID check reads apart from the club's notices, with the same name and words.
  it('draws the alert tone apart from a club notice, named and read the same way', () => {
    renderIn(
      <>
        <NoticeCard label="From the club" text="Open till 4 tonight." />
        <NoticeCard tone="alert" label="ID check" text="Bring your Aadhaar and PAN on your first visit." />
      </>,
    );
    const club = screen.getByRole('article', { name: 'From the club' });
    const idCheck = screen.getByRole('article', { name: 'ID check' });
    expect(idCheck).toHaveTextContent('ID checkBring your Aadhaar and PAN on your first visit.');
    expect(idCheck.className).not.toBe(club.className);
  });

  it('has no accessibility violations in the alert tone', async () => {
    const { container } = renderIn(<NoticeCard tone="alert" label="ID check" text="Bring your Aadhaar and PAN on your first visit." />);
    expect(await axeViolations(container)).toEqual([]);
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
