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
  /**
   * Keeps the chips in one row that scrolls sideways, fading at its end, rather than wrapping: a filter above a list,
   * which should not push the list down a phone's screen (UI polish audit A-05).
   */
  isOneRow?: boolean;
  /**
   * `pill`, the redesign's rounded chips, picked in gold tint; `tile`, square choices in a row of equal columns, such as a
   * rating of 1 to 5 or Add time's three lengths (decision 0320). `chip` elsewhere.
   */
  look?: 'chip' | 'pill' | 'tile' | 'tabs';
}

const CHIP =
  'min-h-touch rounded-md border px-4 font-text text-14 leading-control font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-disabled';

const PILL = 'min-h-touch rounded-full border px-4 font-text text-14 leading-control transition-colors disabled:cursor-not-allowed disabled:opacity-disabled';

// Five ratings sit in 52 px tiles; three lengths of time in 56 px ones, as in the prototype. Every look's label has a
// whole-pixel line box (leading-control), so centred in its chip it starts on a pixel (#762).
const TILE = 'rounded-md border font-text text-18 leading-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-disabled';

const TILE_ROW: Record<number, string> = { 3: 'grid grid-cols-3 gap-2', 5: 'grid grid-cols-5 gap-2' };

// The Order screen's categories (decision 0320): words over a hairline, the chosen one underlined in gold.
const TAB = '-mb-px min-h-touch min-w-touch border-b-2 font-text text-16 font-medium transition-colors';

/** The row the choices sit in, by look. */
function rowClasses(look: 'chip' | 'pill' | 'tile' | 'tabs', optionCount: number, isOneRow: boolean): string {
  if (look === 'tile') return TILE_ROW[optionCount] ?? 'grid grid-cols-3 gap-2';
  if (look === 'tabs') return 'flex gap-6 border-b border-hairline';
  return cx('flex gap-2', isOneRow ? 'overflow-x-auto' : 'flex-wrap');
}

/** The classes of one choice in each look, on or off. */
function choiceClasses(look: 'chip' | 'pill' | 'tile' | 'tabs', isOn: boolean, optionCount: number): string {
  if (look === 'tabs') return cx(TAB, isOn ? 'border-gold text-content' : 'border-transparent text-content-muted');
  if (look === 'chip') return cx(CHIP, isOn ? 'border-action bg-raised text-content' : 'border-control text-content-muted');
  const picked = isOn ? 'border-gold bg-gold-tint text-content' : 'border-control text-content-muted';
  return look === 'pill' ? cx(PILL, picked) : cx(TILE, optionCount === 5 ? 'h-round' : 'h-tile', picked);
}

/** A preference picked from a few choices, such as games or stakes: a row of chips that wraps, or scrolls. */
export function ChoiceChips<Value extends string>({
  label, options, selected, onChange, mode = 'many', isDisabled, isLabelVisuallyHidden = false, isOneRow = false, look = 'chip',
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
      <div role="group" aria-labelledby={labelId} data-chip-row={isOneRow ? '' : undefined}
        className={rowClasses(look, options.length, isOneRow)}>
        {options.map((option) => {
          const isOn = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isOn}
              disabled={isDisabled}
              onClick={() => press(option.value)}
              className={cx(choiceClasses(look, isOn, options.length), isOneRow && 'shrink-0 whitespace-nowrap')}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </Stack>
  );
}
