import { useId, useState, type Ref, type SyntheticEvent } from 'react';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { cx } from '../internal/classes.ts';
import { Label } from '../Label/Label.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

export interface CodeInputProps {
  /** The visible label: "Code sent to +91 98765 43210". */
  label: string;
  /** The digits typed so far. */
  value: string;
  /** Digits only, never more than `length`: whatever is typed, pasted or filled in is cleaned first. */
  onChange: (value: string) => void;
  /** Runs once every digit is in, so a code filled in from a message goes on by itself. */
  onComplete?: ((code: string) => void) | undefined;
  /** How many digits; six unless given. */
  length?: number;
  hint?: string | undefined;
  /** What is wrong and what to do. Marks the cells invalid. */
  error?: string | undefined;
  autoFocus?: boolean;
  isDisabled?: boolean;
  name?: string;
  ref?: Ref<HTMLInputElement>;
  /** `tall`, the redesign's 60 px cells sharing the row (decision 0320); 48 px squares otherwise. */
  size?: 'regular' | 'tall';
}

/** One cell: its digit, the gold edge of the next one to fill while the field has focus, red when the code is wrong. */
function Cell({ digit, isNext, isInvalid, isTall }: { digit: string | undefined; isNext: boolean; isInvalid: boolean; isTall: boolean }) {
  // The next cell's 2 px edge is the field's focus, red on a refused code, so the focus shows either way (WCAG 2.4.7).
  const next = isInvalid ? 'border-2 border-alert' : 'border-2 border-accent';
  const edge = isNext ? next : isInvalid ? 'border-alert' : digit === undefined ? 'border-control' : 'border-content';
  return (
    <span className={cx('flex min-w-0 items-center justify-center rounded-md border bg-raised font-text text-28 text-content', isTall ? 'h-field flex-1' : 'h-12 w-12', edge)}>
      {digit}
    </span>
  );
}

const ERROR_LOOK = { regular: 'icon', tall: 'dot' } as const;

/** The hint and the error under the cells, each with the id the field points at. */
function CodeNotes({ id, hint, error, size }: { id: string; hint: string | undefined; error: string | undefined; size: 'regular' | 'tall' }) {
  return (
    <>
      {hint ? <Text variant="small" tone="muted" id={`${id}-hint`}>{hint}</Text> : null}
      {error ? <ErrorMessage id={`${id}-error`} look={ERROR_LOOK[size]}>{error}</ErrorMessage> : null}
    </>
  );
}

interface CellsProps {
  value: string;
  length: number;
  hasFocus: boolean;
  isInvalid: boolean;
  isTall: boolean;
}

/** A cell a digit; the next one to fill has the gold edge while the field has focus. */
function Cells({ value, length, hasFocus, isInvalid, isTall }: CellsProps) {
  return Array.from({ length }, (_, index) => (
    <Cell key={index} digit={value[index]} isNext={hasFocus && index === Math.min(value.length, length - 1)} isInvalid={isInvalid} isTall={isTall} />
  ));
}

/** What was typed, pasted or filled in, as the code's digits: a whole code pasted after the digits already there is the new
 * code, and wins over the old. */
function digitsOf(typed: string, value: string, length: number): string {
  const all = typed.replace(/\D/g, '');
  const fresh = all.startsWith(value) && all.length - value.length >= length ? all.slice(value.length) : all;
  return fresh.slice(0, length);
}

/** The caret after the last digit, so a tap on any cell types on from where the gold cell shows. Not on focus: a paste or a
 * fill selects what is there to replace it, and moving the caret would add to it instead. */
const caretToEnd = (event: SyntheticEvent<HTMLInputElement>) => {
  const end = event.currentTarget.value.length;
  event.currentTarget.setSelectionRange(end, end);
};

/**
 * A one-time code as a row of cells, one a digit (S-01). One real field lies over the cells, so the phone's offer to fill
 * the code from a message, a paste and a screen reader all work as with any field; the cells only show what it holds. It
 * takes any length of paste and keeps the digits (a length limit would cut `123 456` short before they are read). Its
 * focus is the gold edge of the next cell, shown whenever the field has focus; no ring round the row as well (P-07).
 */
export function CodeInput({ label, value, onChange, onComplete, length = 6, hint, error, autoFocus, isDisabled = false, name, ref, size = 'regular' }: CodeInputProps) {
  const id = useId();
  const [hasFocus, setHasFocus] = useState(Boolean(autoFocus));
  const describedBy = cx(hint && `${id}-hint`, error && `${id}-error`) || undefined;
  const change = (typed: string) => {
    const digits = digitsOf(typed, value, length);
    onChange(digits);
    if (digits.length === length && digits !== value) onComplete?.(digits);
  };
  return (
    <Stack gap={2}>
      <Label htmlFor={id}>{label}</Label>
      <div data-code-cells className={cx('relative flex gap-2', isDisabled && 'opacity-disabled')}>
        <Cells value={value} length={length} hasFocus={hasFocus} isInvalid={Boolean(error)} isTall={size === 'tall'} />
        <input
          ref={ref}
          id={id}
          name={name}
          value={value}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          disabled={isDisabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          // The digits show in the cells: the field itself, caret and selection, stays out of sight over them.
          className="absolute inset-0 size-full bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
          onChange={(event) => change(event.target.value)}
          onFocus={() => setHasFocus(true)}
          onClick={caretToEnd}
          onBlur={() => setHasFocus(false)}
        />
      </div>
      <CodeNotes id={id} hint={hint} error={error} size={size} />
    </Stack>
  );
}
