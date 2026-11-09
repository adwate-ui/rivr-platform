import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../internal/classes.ts';
import { nextRadioIndex } from '../internal/radioKeys.ts';

/** One option: the value it stands for and what it says. */
export interface SegmentedOption<Value extends string> {
  readonly value: Value;
  /** Already translated. */
  readonly label: string;
}

/**
 * The height at a desk, from 1180 px: `compact`, 36 px in all, beside a compact button in a screen's header; `small`,
 * 32 px, inside a row or a tile. Below 1180 px each option is a 44 px touch target (decision 0282).
 */
export type SegmentedSize = 'compact' | 'small';

export interface SegmentedProps<Value extends string> {
  /** What is chosen, for example "View". Not shown: screen readers read it as the group's name. */
  label: string;
  /** Two to four options, one always chosen. */
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  size?: SegmentedSize;
}

// The track's 2 px inset is a transparent border over its fill: 2 px is off the 4 px spacing scale (console v3).
const TRACK = 'inline-flex rounded-md border-2 border-transparent bg-subtle';

const SEGMENT =
  'inline-flex items-center justify-center rounded-sm px-3 font-text text-13 leading-control text-content transition-colors ' +
  'focus-visible:outline focus-visible:outline-focus';

const HEIGHT: Record<SegmentedSize, string> = { compact: 'min-h-touch tablet:min-h-8', small: 'min-h-touch tablet:min-h-7' };

/**
 * One choice of two to four, such as the floor's Summary or Seats (console v3): a radio group on a faint track, the
 * chosen option on cream at 12% with a gold edge inside it (F-019). It is one stop for Tab, and the arrow keys move along it and choose as they go.
 */
export function Segmented<Value extends string>({ label, options, value, onChange, size = 'compact' }: SegmentedProps<Value>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = Math.max(0, options.findIndex((option) => option.value === value));
  const choose = (index: number) => {
    const option = options[index];
    if (option !== undefined && option.value !== value) onChange(option.value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextRadioIndex(event.key, index, options.length);
    if (next === null) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    choose(next);
  };
  return (
    <div role="radiogroup" aria-label={label} className={TRACK}>
      {options.map((option, index) => {
        const isChosen = option.value === value;
        return (
          <button key={option.value} ref={(element) => { buttons.current[index] = element; }} type="button" role="radio"
            aria-checked={isChosen} tabIndex={index === chosen ? 0 : -1} onClick={() => choose(index)} onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(SEGMENT, HEIGHT[size], isChosen && 'bg-cream-track font-medium inset-ring inset-ring-gold')}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
