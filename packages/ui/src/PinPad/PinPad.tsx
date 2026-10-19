import { t } from '@rivr/i18n';
import { useId, type KeyboardEvent } from 'react';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { cx } from '../internal/classes.ts';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

export interface PinPadProps {
  /** Whose PIN it is or what it is for, for example "PIN for Pema Lepcha". Read out with the keys. */
  label: string;
  /** The digits entered so far. Shown only as filled dots, never as digits. */
  value: string;
  onChange: (value: string) => void;
  /** How many digits a PIN has: the dots, and the most the pad takes. */
  length?: number;
  /** What is wrong and what to do, under the dots. */
  error?: string | undefined;
  /** Ignores presses, for example while the PIN is checked. */
  isDisabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;

const KEY =
  'min-h-touch h-16 rounded-md border border-hairline bg-raised font-text leading-snug text-content ' +
  'select-none transition-colors active:bg-surface disabled:cursor-not-allowed disabled:opacity-disabled';

/**
 * The dealer tablet's PIN pad (#41): a dot for each digit and a keypad of 1 to 9, 0 and Delete, as
 * in the prototype's dealer sign-in. Digits typed on a keyboard and Backspace work too.
 */
export function PinPad({ label, value, onChange, length = 4, error, isDisabled }: PinPadProps) {
  const labelId = useId();
  const add = (digit: string) => {
    if (!isDisabled && value.length < length) onChange(value + digit);
  };
  const remove = () => {
    if (!isDisabled) onChange(value.slice(0, -1));
  };
  const typed = (event: KeyboardEvent) => {
    if (/^[0-9]$/.test(event.key)) add(event.key);
    else if (event.key === 'Backspace') remove();
  };
  return (
    <Stack gap={4}>
      <Text id={labelId} variant="label">{label}</Text>
      <div role="group" aria-labelledby={labelId} onKeyDown={typed} className="flex flex-col gap-4">
        <div role="status" aria-label={t('ui.pinPad.entered', { count: value.length, length })} className="flex gap-3">
          {Array.from({ length }, (_, index) => (
            <span key={index} className={cx('size-4 rounded-lg border border-content', index < value.length && 'bg-content')} />
          ))}
        </div>
        {error === undefined ? null : <ErrorMessage>{error}</ErrorMessage>}
        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((key, index) => key === '' ? <span key={index} /> : (
            <button key={key} type="button" className={cx(KEY, key === 'delete' ? 'text-16' : 'text-28')} disabled={isDisabled}
              onClick={() => (key === 'delete' ? remove() : add(key))}>
              {key === 'delete' ? t('ui.pinPad.delete') : key}
            </button>
          ))}
        </div>
      </div>
    </Stack>
  );
}
