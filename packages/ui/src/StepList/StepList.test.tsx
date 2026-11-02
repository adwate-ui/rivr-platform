import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { StepList } from './StepList.tsx';

const steps = [
  { title: 'Selfie', state: 'done' },
  { title: 'DigiLocker', detail: 'Your Aadhaar, its OTP and your consent.', state: 'current' },
  { title: 'Verified', state: 'next' },
] as const;

describe('StepList', () => {
  it('reads out as an ordered list named for the flow, the current step marked as the step', () => {
    renderIn(<StepList label="Identity check" steps={steps} />);
    const list = screen.getByRole('list', { name: 'Identity check' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
  });

  it('says which steps are done and which is current, and shows what a step asks for', () => {
    renderIn(<StepList label="Identity check" steps={steps} />);
    expect(screen.getByText('Selfie').textContent).toBe('Selfie, done');
    expect(screen.getByText('DigiLocker').textContent).toBe('DigiLocker, current step');
    expect(screen.getByText('Verified').textContent).toBe('Verified');
    expect(screen.getByText('Your Aadhaar, its OTP and your consent.')).toBeInTheDocument();
  });

  it('marks a step done with a tick and the others with their number', () => {
    const { container } = renderIn(<StepList label="Identity check" steps={steps} />);
    const marks = [...container.querySelectorAll('li > span[aria-hidden="true"]:not(.absolute)')];
    expect(marks[0]?.querySelector('svg')).not.toBeNull();
    expect(marks[1]).toHaveTextContent('2');
    expect(marks[2]).toHaveTextContent('3');
  });
});
