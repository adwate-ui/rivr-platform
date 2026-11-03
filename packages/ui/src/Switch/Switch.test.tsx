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

  it("draws the prototype's 46 by 28 track with a round knob that moves across when on", () => {
    const { container, rerender } = renderIn(<Switch label="Seat calls" isOn={false} onChange={() => undefined} />);
    const track = container.querySelector('[data-switch-track]');
    expect(track).toHaveClass('w-switch-width', 'h-switch-height', 'rounded-full', 'border-control');
    expect(track?.firstElementChild).toHaveClass('size-switch-knob', 'rounded-full', 'bg-cream');
    rerender(<Switch label="Seat calls" isOn onChange={() => undefined} />);
    expect(track).toHaveClass('bg-action');
    expect(track?.firstElementChild).toHaveClass('translate-x-switch-travel', 'bg-raised');
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

  it('dims only its control when disabled, so the hint that says why stays legible', () => {
    renderIn(<Switch label="Notifications on this phone" hint="Blocked in your phone's settings." isOn={false} isDisabled onChange={() => undefined} />);
    expect(screen.getByText("Blocked in your phone's settings.").closest('.opacity-disabled')).toBeNull();
    expect(screen.getByRole('switch')).toHaveClass('disabled:opacity-disabled');
  });
});
