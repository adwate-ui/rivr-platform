import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { FaqBlock } from './FaqBlock.tsx';

const QUESTIONS = [
  { question: 'Who can join?', answer: 'Anyone 18 or over who finishes the identity check.' },
  { question: 'How do I pay?', answer: 'By UPI or in cash at the cage.' },
];

describe('FaqBlock', () => {
  it('shows each question, closed, with its answer inside', () => {
    const { container } = renderIn(<FaqBlock heading="Questions" questions={QUESTIONS} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Questions' })).toBeInTheDocument();
    const items = [...container.querySelectorAll('details')];
    expect(items.map((item) => item.querySelector('summary')?.textContent)).toEqual(['Who can join?', 'How do I pay?']);
    expect(items.every((item) => !item.open)).toBe(true);
    expect(items[1]).toHaveTextContent('By UPI or in cash at the cage.');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<FaqBlock heading="Questions" questions={QUESTIONS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
