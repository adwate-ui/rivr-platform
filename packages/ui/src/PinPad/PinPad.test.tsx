import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PinPad } from './PinPad.tsx';

describe('PinPad', () => {
  it('is a group named by its label that says how many digits are in, never which', () => {
    renderIn(<PinPad label="PIN for Pema Lepcha" value="27" onChange={() => undefined} />);

    expect(screen.getByRole('group', { name: 'PIN for Pema Lepcha' })).toBeInTheDocument();
    // In the status region's words, which a screen reader reads as they change (F5-08).
    expect(screen.getByRole('status')).toHaveTextContent('2 of 4 digits entered');
    expect(screen.queryByText('27')).toBeNull();
  });

  it('adds a pressed digit, and Delete takes the last one off', async () => {
    const onChange = vi.fn();
    renderIn(<PinPad label="PIN" value="27" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onChange.mock.calls).toEqual([['274'], ['2']]);
  });

  it('takes no more digits than a PIN has', async () => {
    const onChange = vi.fn();
    renderIn(<PinPad label="PIN" value="2741" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '9' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('is reached with Tab and pressed with Space, and takes digits and Backspace from a keyboard', async () => {
    const onChange = vi.fn();
    renderIn(<PinPad label="PIN" value="2" onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByLabelText('PIN', { selector: 'input' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('7');
    await userEvent.keyboard('{Backspace}');

    expect(onChange.mock.calls).toEqual([['21'], ['27'], ['']]);
  });

  it('is backed by a password field a password manager can fill, which the keys write into (F-063)', () => {
    renderIn(<PinPad label="PIN" value="27" onChange={() => undefined} />);
    const field = screen.getByLabelText('PIN', { selector: 'input' });
    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(field).toHaveAttribute('autocomplete', 'current-password');
    expect(field).toHaveValue('27');
    // Set on the element, so the PIN is never in the page's HTML.
    expect(field).not.toHaveAttribute('value');
    // A tap on the dots focuses it, so they are a touch target.
    expect(field.closest('label')).toHaveClass('min-h-touch');
  });

  it('takes a whole PIN pasted or filled in, and ignores any other, which could burn a try (F-063)', () => {
    const onChange = vi.fn();
    renderIn(<PinPad label="PIN" value="" onChange={onChange} />);
    const field = screen.getByLabelText('PIN', { selector: 'input' });
    for (const paste of ['27419', ' 27-4', '274']) fireEvent.change(field, { target: { value: paste } });
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('');
    fireEvent.change(field, { target: { value: '2741' } });
    expect(onChange).toHaveBeenCalledWith('2741');
  });

  it('counts a digit typed in the field once', async () => {
    const onChange = vi.fn();
    renderIn(<PinPad label="PIN" value="2" onChange={onChange} />);
    screen.getByLabelText('PIN', { selector: 'input' }).focus();
    await userEvent.keyboard('7');
    expect(onChange.mock.calls).toEqual([['27']]);
  });

  it('holds the field shut while disabled', () => {
    renderIn(<PinPad label="PIN" value="" onChange={() => undefined} isDisabled />);
    expect(screen.getByLabelText('PIN', { selector: 'input' })).toBeDisabled();
  });

  it('ignores presses while disabled, and shows what is wrong', async () => {
    const onChange = vi.fn();
    renderIn(<PinPad label="PIN" value="" onChange={onChange} isDisabled error="That PIN is not right." />);

    await userEvent.click(screen.getByRole('button', { name: '5' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('That PIN is not right.');
  });

  it('shows what is wrong under the keypad, so the keys stay where they were (D-05)', () => {
    renderIn(<PinPad label="PIN" value="" onChange={() => undefined} error="That PIN is not right." />);
    const lastKey = screen.getByRole('button', { name: 'Delete' });
    const error = screen.getByRole('alert');
    expect(lastKey.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PinPad label="PIN for Pema Lepcha" value="27" onChange={() => undefined} error="That PIN is not right." />);

    expect(await axeViolations(container)).toEqual([]);
  });
});
