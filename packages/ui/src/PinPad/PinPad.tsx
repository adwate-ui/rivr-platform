import { t } from '@rivr/i18n';
import { useId, useLayoutEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
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
  /** What is wrong and what to do, under the keypad. */
  error?: string | undefined;
  /** Ignores presses, for example while the PIN is checked. */
  isDisabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;

const KEY =
  'min-h-touch h-16 rounded-md border border-control bg-raised font-text leading-snug text-content ' +
  'select-none transition-colors active:bg-surface disabled:cursor-not-allowed disabled:opacity-disabled';

/** A dot for each digit, and the count in words inside the status region, which a screen reader reads as they change; a label is not (F5-08). */
function PinDots({ entered, length }: { entered: number; length: number }) {
  return (
    <span role="status" className="flex gap-4">
      <span className="sr-only">{t('ui.pinPad.entered', { count: entered, length })}</span>
      {Array.from({ length }, (_, index) => (
        <span key={index} className={cx('size-6 rounded-full border border-content', index < entered && 'bg-content')} />
      ))}
    </span>
  );
}

/**
 * What the field's new text leaves as the PIN: a digit typed or deleted, or a whole PIN pasted or filled in. Anything else is
 * ignored, as a part of a PIN, or more than one, could burn a try on Sign in.
 */
function nextPin(text: string, value: string, length: number): string {
  const isWhole = /^\d+$/.test(text) && text.length === length;
  const isOneKey = /^\d*$/.test(text) && text.length <= length && Math.abs(text.length - value.length) <= 1;
  return isWhole || isOneKey ? text : value;
}

interface PinFieldProps {
  labelId: string;
  value: string;
  length: number;
  isDisabled: boolean | undefined;
  onChange: (value: string) => void;
}

/** The hidden password field behind the dots (F-063). The PIN is set on the element and never as an attribute, so it is not in the page's HTML. */
function PinField({ labelId, value, length, isDisabled, onChange }: PinFieldProps) {
  const field = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (field.current !== null) field.current.value = value;
  }, [value]);
  const write = (event: ChangeEvent<HTMLInputElement>) => {
    const element = event.currentTarget;
    const next = nextPin(element.value, value, length);
    element.value = next;
    if (next !== value) onChange(next);
  };
  return <input ref={field} type="password" inputMode="numeric" autoComplete="current-password" aria-labelledby={labelId} className="sr-only" disabled={isDisabled} onChange={write} />;
}

/**
 * The dealer tablet's PIN pad (#41): a dot for each digit and a keypad of 1 to 9, 0 and Delete, as
 * in the prototype's dealer sign-in. Digits typed on a keyboard and Backspace work too. What is wrong
 * shows under the keypad, so the keys never move under a finger (D-05). The dots are the label of a hidden password field
 * the keys write into, so a PIN can be pasted or filled by a password manager: a tap on the dots focuses it (F-063, WCAG 3.3.8).
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
    // The field takes what is typed in it for itself.
    if (event.target instanceof HTMLInputElement) return;
    if (/^[0-9]$/.test(event.key)) add(event.key);
    else if (event.key === 'Backspace') remove();
  };
  return (
    <Stack gap={4}>
      <Text id={labelId} variant="label">{label}</Text>
      <div role="group" aria-labelledby={labelId} onKeyDown={typed} className="flex flex-col gap-4">
        <label className="flex min-h-touch w-fit items-center rounded-md focus-within:outline-2 focus-within:outline-focus">
          <PinField labelId={labelId} value={value} length={length} isDisabled={isDisabled} onChange={onChange} />
          <PinDots entered={value.length} length={length} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((key) => key === '' ? <span key="blank" /> : (
            <button key={key} type="button" className={cx(KEY, key === 'delete' ? 'text-16' : 'text-28')} disabled={isDisabled}
              onClick={() => (key === 'delete' ? remove() : add(key))}>
              {key === 'delete' ? t('ui.pinPad.delete') : key}
            </button>
          ))}
        </div>
        {error === undefined ? null : <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </Stack>
  );
}
