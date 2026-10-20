import { useId } from 'react';
import { cx } from '../internal/classes.ts';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

/** One choice: the value it stands for and what it says. */
export interface ChoiceChip<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export interface ChoiceChipsProps<Value extends string> {
  /** What is being chosen, for example "Games". Screen readers read it as the group's name. */
  label: string;
  options: readonly ChoiceChip<Value>[];
  selected: readonly Value[];
  onChange: (selected: Value[]) => void;
  /** `many` lets any number be chosen; `one` keeps at most one, and pressing it again clears it. */
  mode?: 'one' | 'many';
  /** Dims the chips and ignores presses, for example while a change is saved. */
  isDisabled?: boolean;
  /**
   * Keeps the label for screen readers only, where the screen already shows it once for many groups:
   * a table cell under its column's header, for example.
   */
  isLabelVisuallyHidden?: boolean;
}

const CHIP =
  'min-h-touch rounded-md border px-4 font-text text-14 leading-snug font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-disabled';

/** A preference picked from a few choices, such as games or stakes: a row of chips that wraps. */
export function ChoiceChips<Value extends string>({
  label, options, selected, onChange, mode = 'many', isDisabled, isLabelVisuallyHidden = false,
}: ChoiceChipsProps<Value>) {
  const labelId = useId();
  const press = (value: Value) => {
    const isOn = selected.includes(value);
    if (mode === 'one') onChange(isOn ? [] : [value]);
    else onChange(isOn ? selected.filter((chosen) => chosen !== value) : [...selected, value]);
  };
  return (
    <Stack gap={2}>
      {isLabelVisuallyHidden ? (
        <span id={labelId} className="sr-only">{label}</span>
      ) : (
        <Text id={labelId} variant="label">
          {label}
        </Text>
      )}
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isOn = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isOn}
              disabled={isDisabled}
              onClick={() => press(option.value)}
              className={cx(CHIP, isOn ? 'border-content text-content' : 'border-hairline text-content-muted')}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </Stack>
  );
}
