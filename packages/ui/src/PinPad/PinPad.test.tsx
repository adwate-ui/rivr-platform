import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PinPad } from './PinPad.tsx';

describe('PinPad', () => {
  it('is a group named by its label that says how many digits are in, never which', () => {
    renderIn(<PinPad label="PIN for Pema Lepcha" value="27" onChange={() => undefined} />);

    expect(screen.getByRole('group', { name: 'PIN for Pema Lepcha' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '2 of 4 digits entered' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('7');
    await userEvent.keyboard('{Backspace}');

    expect(onChange.mock.calls).toEqual([['21'], ['27'], ['']]);
  });

  it('ignores presses while disabled, and shows what is wrong', async () => {
    const onChange = vi.fn();
    renderIn(<PinPad label="PIN" value="" onChange={onChange} isDisabled error="That PIN is not right." />);

    await userEvent.click(screen.getByRole('button', { name: '5' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('That PIN is not right.');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PinPad label="PIN for Pema Lepcha" value="27" onChange={() => undefined} error="That PIN is not right." />);

    expect(await axeViolations(container)).toEqual([]);
  });
});
