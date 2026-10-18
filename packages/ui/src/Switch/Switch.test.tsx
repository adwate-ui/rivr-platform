import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Switch } from './Switch.tsx';

describe('Switch', () => {
  it('is a switch named by its label that says whether it is on', () => {
    renderIn(<Switch label="Seat calls" isOn onChange={() => undefined} />);
    expect(screen.getByRole('switch', { name: 'Seat calls' })).toHaveAttribute('aria-checked', 'true');
  });

  it('asks for the other state when pressed, by the switch or by its label', async () => {
    const onChange = vi.fn();
    renderIn(<Switch label="Tournaments" isOn={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Tournaments' }));
    await userEvent.click(screen.getByText('Tournaments'));

    expect(onChange.mock.calls).toEqual([[true], [true]]);
  });

  it('is reached with Tab and pressed with Space or Enter', async () => {
    const onChange = vi.fn();
    renderIn(<Switch label="Seat calls" isOn onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('switch')).toHaveFocus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');

    expect(onChange.mock.calls).toEqual([[false], [false]]);
  });

  it('keeps a 44 px target around its track', () => {
    renderIn(<Switch label="Seat calls" isOn onChange={() => undefined} />);
    expect(screen.getByRole('switch')).toHaveClass('min-h-touch', 'min-w-touch');
  });

  it('reads its hint as the description', () => {
    renderIn(<Switch label="Seat calls" hint="When your seat is ready." isOn onChange={() => undefined} />);
    expect(screen.getByRole('switch')).toHaveAccessibleDescription('When your seat is ready.');
  });

  it('ignores presses while disabled', async () => {
    const onChange = vi.fn();
    renderIn(<Switch label="Seat calls" isOn onChange={onChange} isDisabled />);

    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Switch label="Seat calls" hint="When your seat is ready." isOn onChange={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
