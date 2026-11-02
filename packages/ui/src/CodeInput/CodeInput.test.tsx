import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { CodeInput } from './CodeInput.tsx';

function Harness({ onComplete, error }: { onComplete?: (code: string) => void; error?: string }) {
  const [value, setValue] = useState('');
  return <CodeInput label="6-digit code" value={value} onChange={setValue} onComplete={onComplete} error={error} />;
}

describe('CodeInput', () => {
  it('is one labelled field that a phone can fill from a message', () => {
    renderIn(<Harness />);
    const field = screen.getByLabelText('6-digit code');
    expect(field).toHaveAttribute('autocomplete', 'one-time-code');
    expect(field).toHaveAttribute('inputmode', 'numeric');
  });

  it('shows each digit typed in its own cell', async () => {
    renderIn(<Harness />);
    await userEvent.type(screen.getByLabelText('6-digit code'), '482');
    const cells = [...document.querySelectorAll('.rounded-md')];
    expect(cells.map((cell) => cell.textContent)).toEqual(['4', '8', '2', '', '', '']);
  });

  it('keeps digits only from a paste, however long, and goes on once all six are in', async () => {
    const onComplete = vi.fn();
    renderIn(<Harness onComplete={onComplete} />);
    const field = screen.getByLabelText('6-digit code');
    // Pasted as a person pastes it: no length limit cuts "123 457" short before its digits are read.
    expect(field).not.toHaveAttribute('maxlength');
    await userEvent.click(field);
    await userEvent.paste(' 123 457');
    expect(field).toHaveValue('123457');
    expect(onComplete).toHaveBeenCalledWith('123457');
  });

  it('takes the code a phone fills in from the message', () => {
    const onComplete = vi.fn();
    renderIn(<Harness onComplete={onComplete} />);
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '482913' } });
    expect(onComplete).toHaveBeenCalledWith('482913');
  });

  it('goes on once for a code, not again while it stays complete', async () => {
    const onComplete = vi.fn();
    renderIn(<Harness onComplete={onComplete} />);
    const field = screen.getByLabelText('6-digit code');
    await userEvent.type(field, '1234567');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue('123456');
  });

  it('says what is wrong and points the field at it', () => {
    renderIn(<Harness error="That code is wrong or has expired." />);
    const field = screen.getByLabelText('6-digit code');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('That code is wrong or has expired.');
  });

  it('takes a new code pasted after a refused one, not the old digits', async () => {
    const onComplete = vi.fn();
    renderIn(<Harness onComplete={onComplete} />);
    const field = screen.getByLabelText('6-digit code');
    fireEvent.change(field, { target: { value: '000000' } });
    fireEvent.change(field, { target: { value: '000000482913' } });
    expect(field).toHaveValue('482913');
    expect(onComplete).toHaveBeenLastCalledWith('482913');
  });

  it('sets tall cells across the row with a dotted error (decision 0320)', () => {
    const { container } = renderIn(<CodeInput label="6-digit code" value="12" onChange={() => undefined} size="tall" error="That code didn't match. 2 tries left." />);
    expect(container.querySelectorAll('.h-field.flex-1')).toHaveLength(6);
    expect(screen.getByRole('alert')).toHaveTextContent("That code didn't match. 2 tries left.");
    expect(screen.getByRole('alert').querySelector('svg')).toBeNull();
  });
});
