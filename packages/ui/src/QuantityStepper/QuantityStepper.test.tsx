import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { QuantityStepper } from './QuantityStepper.tsx';

describe('QuantityStepper', () => {
  it('is a group named by what it counts, with one fewer and one more, from the keyboard too', async () => {
    const onChange = vi.fn();
    const { container } = renderIn(<QuantityStepper label="Masala chai" value={2} onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Masala chai' })).toHaveTextContent('2');
    await userEvent.click(screen.getByRole('button', { name: 'One more Masala chai' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    screen.getByRole('button', { name: 'One fewer Masala chai' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('turns off a button at its limit', () => {
    renderIn(<QuantityStepper label="Beer" value={0} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'One fewer Beer' })).toBeDisabled();
    renderIn(<QuantityStepper label="Whisky" value={9} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'One more Whisky' })).toBeDisabled();
  });

  it('hands the focus to the other button when a press reaches the limit, so a keyboard is not dropped (F5-07)', async () => {
    function Counted() {
      const [value, setValue] = useState(8);
      return <QuantityStepper label="Masala chai" value={value} onChange={setValue} />;
    }
    renderIn(<Counted />);
    screen.getByRole('button', { name: 'One more Masala chai' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'One more Masala chai' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'One fewer Masala chai' })).toHaveFocus();
  });

  it('hands the focus to one more when a press reaches nothing, at the other limit', async () => {
    function Counted() {
      const [value, setValue] = useState(1);
      return <QuantityStepper label="Masala chai" value={value} onChange={setValue} />;
    }
    renderIn(<Counted />);
    screen.getByRole('button', { name: 'One fewer Masala chai' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'One fewer Masala chai' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'One more Masala chai' })).toHaveFocus();
  });

  it('drops its label beside the buttons and fills one more in gold when round (decision 0320)', () => {
    renderIn(<QuantityStepper label="Masala chai" value={1} onChange={() => undefined} look="round" />);
    expect(screen.getByRole('group', { name: 'Masala chai' })).not.toHaveTextContent('Masala chai');
    expect(screen.getByRole('button', { name: 'One more Masala chai' })).toHaveClass('bg-action', 'rounded-full');
  });
});
