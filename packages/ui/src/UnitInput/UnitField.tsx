import { t } from '@rivr/i18n';
import { Input } from '../Input/Input.tsx';
import { formRefusal, unitWord, type NumberForm, type Unit } from './unit.ts';

export interface UnitFieldProps {
  /** What the number is: "Seat hold", or a stake's name. */
  label: string;
  /** What it counts, its word after the number; left out for a plain count, a percentage or money. */
  unit?: Unit | undefined;
  /** How it is typed: a whole number (the default); a percentage, `%` after it; or rupees, `₹` before it. */
  form?: NumberForm | undefined;
  /** What is typed, as typed. */
  typed: string;
  onTyped: (typed: string) => void;
  /** One line under the field while nothing is wrong: a setting's limits. */
  hint?: string | undefined;
  /** Why the number is refused, under the field. */
  error?: string | undefined;
  /** The id of the error where the caller shows it apart, as under a row of field and button: the field points at it. */
  apartErrorId?: string | undefined;
  /** For a field added by a press, such as a list's new entry: it takes the focus as it appears. */
  autoFocus?: boolean;
}

/** The word after the number: `%` for a percentage, else its unit's, `minute` after 1; none for a count or money. */
function suffixOf(unit: Unit | undefined, form: NumberForm, typed: string): string | undefined {
  if (form === 'percent') return t('ui.console.unitInput.percent');
  return unit === undefined ? undefined : unitWord(unit, typed);
}

/**
 * The one field a number is typed in on the console (#1001): a setting's panel, UnitInput, EditableList and StakeValues.
 * Its unit after it, its hint under it, and what is wrong under it in place of the hint. It keeps every character typed;
 * one it does not take is refused with why ("Whole numbers only."), never dropped. It holds no state and checks no range;
 * its caller keeps what is typed and says when the number is refused.
 */
export function UnitField({ label, unit, form = 'whole', typed, onTyped, hint, error, apartErrorId, autoFocus = false }: UnitFieldProps) {
  const apart = apartErrorId === undefined ? {} : { 'aria-describedby': apartErrorId, 'aria-invalid': true };
  // Shown apart, the caller says why, the character refused included (unitRefusal); here the field says it under itself.
  const shown = apartErrorId === undefined ? formRefusal(typed, form) ?? error : error;
  return (
    <Input label={label} inputMode={form === 'whole' ? 'numeric' : 'decimal'} autoComplete="off" prefix={form === 'rupees' ? t('ui.console.unitInput.rupee') : undefined}
      suffix={suffixOf(unit, form, typed)} value={typed} hint={shown === undefined ? hint : undefined} error={shown}
      autoFocus={autoFocus} onChange={(event) => onTyped(event.target.value)} {...apart} />
  );
}
