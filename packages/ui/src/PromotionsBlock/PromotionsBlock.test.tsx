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

  it('shows a promotion’s rules in order and its questions, each opening on its answer', () => {
    renderIn(<PromotionsBlock heading="On the house" emptyText="None running." promotions={[{
      title: 'Bad Beat Jackpot', rules: ['Quad eights or better must lose', 'Both hole cards play'],
      questions: [{ question: 'Do I claim it?', answer: 'No: the floor pays it at the table.' }],
    }]} />);
    expect(screen.getAllByRole('listitem').slice(1).map((rule) => rule.textContent)).toEqual(['Quad eights or better must lose', 'Both hole cards play']);
    expect(screen.getByText('Do I claim it?').closest('details')).toHaveTextContent('No: the floor pays it at the table.');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PromotionsBlock heading="On the house" promotions={PROMOTIONS} emptyText="None running." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
