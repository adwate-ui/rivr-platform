import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TextArea } from './TextArea.tsx';

function ControlledSop() {
  const [value, setValue] = useState('');
  return <TextArea label="Text" value={value} onChange={(event) => setValue(event.target.value)} />;
}

describe('TextArea', () => {
  it('is a multi-line text field named by its label', () => {
    renderIn(<TextArea label="Text" rows={4} />);
    const field = screen.getByRole('textbox', { name: 'Text' });
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('rows', '4');
  });

  it('takes several lines of typing when controlled', async () => {
    renderIn(<ControlledSop />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Text' }), '1. Count the float.{Enter}2. Open the shift.');
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('1. Count the float.\n2. Open the shift.');
  });

  it('is reached with Tab', async () => {
    renderIn(<TextArea label="Text" />);
    await userEvent.tab();
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveFocus();
  });

  it('marks itself invalid and reads out the hint and the error', () => {
    renderIn(<TextArea label="Text" hint="One step a line." error="Write the text of this version." />);
    const field = screen.getByRole('textbox', { name: 'Text' });
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('One step a line. Write the text of this version.');
    expect(field).toHaveClass('border-alert');
  });

  it('has no accessibility violations with a hint and an error', async () => {
    const { container } = renderIn(<TextArea label="Text" hint="One step a line." error="Write the text." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
