import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Keypad } from './Keypad.tsx';

describe('Keypad', () => {
  it('is a group named by its label', () => {
    renderIn(<Keypad label="Pot" value="" onChange={() => undefined} />);

    expect(screen.getByRole('group', { name: 'Pot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '000' })).toBeInTheDocument();
  });

  it('adds digits and three noughts, and Delete takes the last digit off', async () => {
    const onChange = vi.fn();
    renderIn(<Keypad label="Pot" value="48" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: '000' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onChange.mock.calls).toEqual([['485'], ['48000'], ['4']]);
  });

  it('never starts an amount with a nought', async () => {
    const onChange = vi.fn();
    renderIn(<Keypad label="Pot" value="" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '0' }));
    await userEvent.click(screen.getByRole('button', { name: '000' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes no more digits than it allows, 000 included', async () => {
    const onChange = vi.fn();
    renderIn(<Keypad label="Pot" value="1234567" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '000' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));

    expect(onChange.mock.calls).toEqual([['12345670'], ['12345679']]);
  });

  it('is reached with Tab and pressed with Space, and takes digits and Backspace from a keyboard', async () => {
    const onChange = vi.fn();
    renderIn(<Keypad label="Pot" value="4" onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('8');
    await userEvent.keyboard('{Backspace}');

    expect(onChange.mock.calls).toEqual([['41'], ['48'], ['']]);
  });

  it('ignores presses while disabled', async () => {
    const onChange = vi.fn();
    renderIn(<Keypad label="Pot" value="48" onChange={onChange} isDisabled />);

    await userEvent.click(screen.getByRole('button', { name: '5' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Keypad label="Pot" value="48000" onChange={() => undefined} />);

    expect(await axeViolations(container)).toEqual([]);
  });
});
