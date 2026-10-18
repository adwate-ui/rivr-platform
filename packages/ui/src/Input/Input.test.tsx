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

  it('shows a fixed prefix before the value and reads it out with the field', () => {
    renderIn(<Input label="Mobile number" type="tel" variant="line" prefix="+91" defaultValue="98110 42817" />);
    const field = screen.getByRole('textbox', { name: 'Mobile number' });
    expect(screen.getByText('+91')).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription('+91');
    expect(field).toHaveValue('98110 42817');
  });

  it('draws a line field and a code field as an underline, which turns red on an error', () => {
    renderIn(<Input label="Code" variant="code" placeholder="6 digits" error="Code expired. Request a new one." />);
    const field = screen.getByRole('textbox', { name: 'Code' });
    expect(field).toHaveAttribute('placeholder', '6 digits');
    expect(field).toHaveClass('border-b', 'border-alert', 'tracking-tv');
    expect(field).not.toHaveClass('rounded-md');
  });

  it('keeps a prefixed field a full touch target, and dims the prefix with it when disabled', () => {
    renderIn(<Input label="Mobile number" type="tel" variant="line" prefix="+91" disabled />);
    const field = screen.getByRole('textbox', { name: 'Mobile number' });
    expect(field).toHaveClass('min-h-touch');
    expect(field).not.toHaveClass('disabled:opacity-disabled');
    expect(field.parentElement).toHaveClass('has-disabled:opacity-disabled');
  });

  it('has no accessibility violations as a line field with a prefix', async () => {
    const { container } = renderIn(<Input label="Mobile number" type="tel" variant="line" prefix="+91" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
