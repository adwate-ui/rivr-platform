import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { readUnit, type Unit } from './unit.ts';
import { UnitInput } from './UnitInput.tsx';

/** A seat hold of 5 to 240 minutes, starting at 20. */
function seatHold(initialValue: number | null = 20) {
  const onChange = vi.fn();
  const drawn = renderIn(<UnitInput label="Seat hold" unit="minutes" min={5} max={240} initialValue={initialValue} hint="How long a called seat waits" onChange={onChange} />);
  return { onChange, field: screen.getByRole('textbox', { name: 'Seat hold' }), ...drawn };
}

describe('UnitInput', () => {
  it('shows the value with its unit, read with the field, and gives the number typed', async () => {
    const { onChange, field, container } = seatHold();
    expect(field).toHaveValue('20');
    expect(field).toHaveAccessibleDescription('minutes How long a called seat waits');
    await userEvent.clear(field);
    await userEvent.type(field, '45');
    expect(onChange).toHaveBeenLastCalledWith(45);
    expect(field).not.toBeInvalid();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('refuses a number outside its range: it says the range and gives no value', async () => {
    const { onChange, field } = seatHold();
    await userEvent.clear(field);
    await userEvent.type(field, '4');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(field).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Between 5 and 240 minutes.');
    await userEvent.type(field, '00');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('alert')).toHaveTextContent('Between 5 and 240 minutes.');
    await userEvent.clear(field);
    await userEvent.type(field, '240');
    expect(onChange).toHaveBeenLastCalledWith(240);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses a character other than a digit, saying whole numbers only, and a blank field is no value and no error', async () => {
    const { onChange, field } = seatHold(null);
    expect(field).toHaveValue('');
    await userEvent.type(field, '1.5');
    expect(field).toHaveValue('1.5');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(field).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Whole numbers only.');
    await userEvent.clear(field);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each<[Unit, string, string]>([
    ['minutes', 'minute', 'minutes'], ['hours', 'hour', 'hours'], ['days', 'day', 'days'], ['years', 'year', 'years'], ['players', 'player', 'players'], ['playersWaiting', 'player waiting', 'players waiting'], ['seconds', 'second', 'seconds'], ['bonus', 'Bonus', 'Bonus'],
  ])('writes %s after the number: one %s, many %s', async (unit, one, many) => {
    renderIn(<UnitInput label="Value" unit={unit} min={1} max={5000} initialValue={1} onChange={vi.fn()} />);
    const field = screen.getByRole('textbox', { name: 'Value' });
    expect(field).toHaveAccessibleDescription(one);
    await userEvent.type(field, '0');
    expect(field).toHaveAccessibleDescription(many);
  });

  it('reads what is typed against the range, both ends allowed', () => {
    expect(readUnit('', { min: 1, max: 10 })).toEqual({ value: null, isRefused: false });
    expect(readUnit('1', { min: 1, max: 10 })).toEqual({ value: 1, isRefused: false });
    expect(readUnit('10', { min: 1, max: 10 })).toEqual({ value: 10, isRefused: false });
    expect(readUnit('11', { min: 1, max: 10 })).toEqual({ value: null, isRefused: true });
    expect(readUnit('0', { min: 1, max: 10 })).toEqual({ value: null, isRefused: true });
    expect(readUnit('2.5', { min: 1, max: 10 })).toEqual({ value: null, isRefused: true });
    expect(readUnit('1,440', { min: 1, max: 1440 })).toEqual({ value: 1440, isRefused: false });
  });
});
