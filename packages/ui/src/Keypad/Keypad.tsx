import { t } from '@rivr/i18n';
import { useId, type KeyboardEvent } from 'react';
import { cx } from '../internal/classes.ts';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

export interface KeypadProps {
  /** What the digits are, for example "Pot". Read out as the keypad's name. */
  label: string;
  /** The whole rupees entered so far, as digits: "48000" is ₹48,000. The screen shows it formatted. */
  value: string;
  onChange: (value: string) => void;
  /** The most digits it takes: 8 is up to ₹9,99,99,999. */
  maxDigits?: number;
  /** Ignores presses, for example while a hand is logged. */
  isDisabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'delete'] as const;

const KEY =
  'min-h-touch h-16 rounded-md border border-hairline bg-raised font-text leading-snug text-content ' +
  'select-none transition-colors active:bg-surface disabled:cursor-not-allowed disabled:opacity-disabled';

/**
 * The dealer tablet's pot keypad (#42), as in the prototype: 1 to 9, 000, 0 and Delete. An amount
 * never starts with a nought, 000 adds three noughts to an amount already started, and it takes no
 * more than `maxDigits`. Digits typed on a keyboard and Backspace work too.
 */
export function Keypad({ label, value, onChange, maxDigits = 8, isDisabled }: KeypadProps) {
  const labelId = useId();
  const add = (digits: string) => {
    if (isDisabled || (value === '' && digits.startsWith('0'))) return;
    const next = (value + digits).slice(0, maxDigits);
    if (next !== value) onChange(next);
  };
  const remove = () => {
    if (!isDisabled && value !== '') onChange(value.slice(0, -1));
  };
  const typed = (event: KeyboardEvent) => {
    if (/^[0-9]$/.test(event.key)) add(event.key);
    else if (event.key === 'Backspace') remove();
  };
  return (
    <Stack gap={3}>
      <Text id={labelId} variant="label">{label}</Text>
      <div role="group" aria-labelledby={labelId} onKeyDown={typed} className="grid grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button key={key} type="button" className={cx(KEY, key === 'delete' ? 'text-16' : 'text-28')} disabled={isDisabled}
            onClick={() => (key === 'delete' ? remove() : add(key))}>
            {key === 'delete' ? t('ui.keypad.delete') : key}
          </button>
        ))}
      </div>
    </Stack>
  );
}
