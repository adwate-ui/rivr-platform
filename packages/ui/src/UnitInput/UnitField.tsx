import { Input } from '../Input/Input.tsx';
import { unitWord, type Unit } from './unit.ts';

export interface UnitFieldProps {
  /** What the number is: "Seat hold", or a stake's name. */
  label: string;
  unit: Unit;
  /** The digits typed. */
  typed: string;
  onTyped: (typed: string) => void;
  /** One line under the field while nothing is wrong. */
  hint?: string | undefined;
  /** Why the number is refused, under the field. */
  error?: string | undefined;
  /** The id of the error where the caller shows it apart, as under a row of field and button: the field points at it. */
  apartErrorId?: string | undefined;
  /** For a field added by a press, such as a list's new entry: it takes the focus as it appears. */
  autoFocus?: boolean;
}

// A setting's number is at most six digits: 5,000 Bonus, 1,440 minutes.
const MOST_DIGITS = 6;

/**
 * The field UnitInput, EditableList and StakeValues share: digits only, with the unit after them. It holds no state and
 * checks no range; its caller keeps what is typed and says when it is refused.
 */
export function UnitField({ label, unit, typed, onTyped, hint, error, apartErrorId, autoFocus = false }: UnitFieldProps) {
  const apart = apartErrorId === undefined ? {} : { 'aria-describedby': apartErrorId, 'aria-invalid': true };
  return (
    <Input label={label} inputMode="numeric" autoComplete="off" maxLength={MOST_DIGITS} suffix={unitWord(unit, typed)} value={typed} hint={hint} error={error}
      autoFocus={autoFocus} onChange={(event) => onTyped(event.target.value.replace(/\D/g, ''))} {...apart} />
  );
}
