import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { formRefusal, unitRefusal, type NumberForm, type Unit } from './unit.ts';
import { UnitField } from './UnitField.tsx';

interface TypedProps {
  readonly form?: NumberForm;
  readonly unit?: Unit;
  readonly hint?: string;
  readonly error?: string;
}

/** The field as a screen holds it: what is typed kept by its caller. */
function Typed({ form, unit, hint, error }: TypedProps) {
  const [typed, setTyped] = useState('');
  return <UnitField label="Value" form={form} unit={unit} typed={typed} hint={hint} error={error} onTyped={setTyped} />;
}

function draw(props: TypedProps) {
  const drawn = renderIn(<Typed {...props} />);
  return { field: screen.getByRole('textbox', { name: 'Value' }), ...drawn };
}

describe('UnitField', () => {
  it('keeps "1.5" in a whole-number field and says whole numbers only, in place of its hint', async () => {
    const { field, container } = draw({ unit: 'minutes', hint: 'Between 5 and 240 minutes.' });
    expect(field).toHaveAccessibleDescription('minutes Between 5 and 240 minutes.');
    await userEvent.type(field, '1.5');
    expect(field).toHaveValue('1.5');
    expect(field).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Whole numbers only.');
    expect(screen.queryByText('Between 5 and 240 minutes.')).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.type(field, '{Backspace}{Backspace}');
    expect(field).toHaveValue('1');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field).toHaveAccessibleDescription('minute Between 5 and 240 minutes.');
  });

  it('takes a percentage of up to two decimals, % after it, and refuses a third', async () => {
    const { field } = draw({ form: 'percent', hint: 'Up to two decimals.' });
    expect(field).toHaveAttribute('inputmode', 'decimal');
    await userEvent.type(field, '5.25');
    expect(field).not.toBeInvalid();
    expect(field).toHaveAccessibleDescription('% Up to two decimals.');
    await userEvent.type(field, '5');
    expect(field).toHaveValue('5.255');
    expect(screen.getByRole('alert')).toHaveTextContent('Numbers only, up to two decimals.');
  });

  it('takes rupees, grouped, with ₹ before them read with the field, and refuses a letter', async () => {
    const { field, container } = draw({ form: 'rupees' });
    await userEvent.type(field, '10,00,000.50');
    expect(field).not.toBeInvalid();
    expect(field).toHaveAccessibleDescription('₹');
    await userEvent.type(field, 'a');
    expect(screen.getByRole('alert')).toHaveTextContent('Numbers only, up to two decimals.');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says its caller\'s error under it while every character is taken', async () => {
    const { field } = draw({ hint: 'Between 1 and 10.', error: 'Between 1 and 10.' });
    await userEvent.tab();
    expect(field).toHaveFocus();
    await userEvent.keyboard('12');
    expect(field).toHaveValue('12');
    expect(screen.getByRole('alert')).toHaveTextContent('Between 1 and 10.');
  });

  it('reads which characters each form takes, and why a whole number is refused', () => {
    expect(formRefusal('1,440', 'whole')).toBeUndefined();
    expect(formRefusal('-5', 'whole')).toBe('Whole numbers only.');
    expect(formRefusal('5.', 'percent')).toBeUndefined();
    expect(formRefusal('3,000.505', 'rupees')).toBe('Numbers only, up to two decimals.');
    expect(unitRefusal('', 'minutes', { min: 5, max: 240 })).toBeUndefined();
    expect(unitRefusal('1.5', 'minutes', { min: 5, max: 240 })).toBe('Whole numbers only.');
    expect(unitRefusal('300', 'minutes', { min: 5, max: 240 })).toBe('Between 5 and 240 minutes.');
    expect(unitRefusal('1,440', 'minutes', { min: 5, max: 1440 })).toBeUndefined();
  });
});
