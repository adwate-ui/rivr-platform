import { useState } from 'react';
import { rangeText, readUnit, type Unit } from './unit.ts';
import { UnitField } from './UnitField.tsx';

export interface UnitInputProps {
  /** What the number is: "Seat hold". */
  label: string;
  /** What it counts, shown after it: `20 minutes`, `6 players`, `5000 Bonus`. */
  unit: Unit;
  /** The least it may be. */
  min: number;
  /** The most it may be. */
  max: number;
  /** The value at first; left out or null, a blank field. */
  initialValue?: number | null;
  /** One line under the field while nothing is wrong. */
  hint?: string;
  /** The whole number typed; null while the field is blank or holds a number it refuses, so the screen saves nothing. */
  onChange: (value: number | null) => void;
}

/**
 * A whole number typed in its unit (redesign RD-14): minutes, hours, days, players, seconds or Bonus. Only digits are
 * taken; a number outside `min` to `max` is refused, with the range said under the field. It keeps what is typed, so the
 * screen mounts it anew (a `key`) to start from another value.
 */
export function UnitInput({ label, unit, min, max, initialValue = null, hint, onChange }: UnitInputProps) {
  const [typed, setTyped] = useState(initialValue === null ? '' : String(initialValue));
  const range = { min, max };
  const { isRefused } = readUnit(typed, range);
  return (
    <UnitField label={label} unit={unit} typed={typed} hint={isRefused ? undefined : hint} error={isRefused ? rangeText(unit, range) : undefined}
      onTyped={(next) => {
        setTyped(next);
        onChange(readUnit(next, range).value);
      }} />
  );
}
