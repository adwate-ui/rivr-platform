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

  it('makes each step a raised card holding its action and content, in the console\'s look (console v3)', () => {
    renderIn(<StepList label="Practice reset" look="cards" steps={[
      { title: 'Switch to the practice venue', state: 'current', action: <button type="button">Switch to practice</button> },
      { title: 'Reset the practice venue', state: 'next', content: <p>Type the venue's name.</p> },
    ]} />);
    const [first, second] = screen.getAllByRole('listitem');
    expect(first).toHaveClass('bg-raised', 'rounded-lg');
    expect(first).toHaveAttribute('aria-current', 'step');
    expect(within(first ?? document.body).getByRole('button', { name: 'Switch to practice' })).toBeInTheDocument();
    expect(within(second ?? document.body).getByText("Type the venue's name.")).toBeInTheDocument();
    expect(screen.getByText('Switch to the practice venue').textContent).toBe('Switch to the practice venue, current step');
  });

  it('rules each step between hairlines in the redesign\'s look (decision 0320)', () => {
    renderIn(<StepList label="Identity check" look="ruled" steps={[{ title: 'Selfie', state: 'done' }, { title: 'DigiLocker', state: 'current' }]} />);
    expect(screen.getAllByRole('listitem')[0]).toHaveClass('border-t');
  });
});
