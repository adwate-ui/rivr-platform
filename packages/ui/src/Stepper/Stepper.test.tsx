import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Stepper } from './Stepper.tsx';

const STEPS = ['Sent', 'Preparing', 'On its way', 'Delivered'];

describe('Stepper', () => {
  it('lists the steps and marks the one reached as current', () => {
    renderIn(<Stepper steps={STEPS} current={2} label="Order" />);
    const list = screen.getByRole('list', { name: 'Order' });
    expect(list.querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByText('On its way').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Delivered')).toHaveClass('text-content-muted');
    expect(screen.getByText('Sent')).toHaveClass('text-content');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Stepper steps={STEPS} current={0} label="Order" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
