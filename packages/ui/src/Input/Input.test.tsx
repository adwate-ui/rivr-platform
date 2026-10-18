import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Input } from './Input.tsx';

function ControlledUtr() {
  const [value, setValue] = useState('');
  return <Input label="UTR" value={value} onChange={(event) => setValue(event.target.value)} inputMode="numeric" />;
}

describe('Input', () => {
  it('is a text field named by its label', () => {
    renderIn(<Input label="Mobile number" type="tel" />);
    expect(screen.getByRole('textbox', { name: 'Mobile number' })).toHaveAttribute('type', 'tel');
  });

  it('takes typing when controlled', async () => {
    renderIn(<ControlledUtr />);
    await userEvent.type(screen.getByRole('textbox', { name: 'UTR' }), '412908771204');
    expect(screen.getByRole('textbox', { name: 'UTR' })).toHaveValue('412908771204');
  });

  it('is reached with Tab', async () => {
    renderIn(<Input label="Amount" />);
    await userEvent.tab();
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();
  });

  it('describes itself with the hint', () => {
    renderIn(<Input label="UTR" hint="The 12-digit reference from your bank app." />);
    expect(screen.getByRole('textbox', { name: 'UTR' })).toHaveAccessibleDescription('The 12-digit reference from your bank app.');
  });

  it('marks itself invalid and reads out the error after the hint', () => {
    renderIn(<Input label="UTR" hint="12 digits." error="UTR not found. Check the number and try again." />);
    const field = screen.getByRole('textbox', { name: 'UTR' });
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('12 digits. UTR not found. Check the number and try again.');
    expect(field).toHaveClass('border-alert');
  });

  it('has no accessibility violations with a hint and an error', async () => {
    const { container } = renderIn(<Input label="UTR" hint="12 digits." error="UTR not found." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
