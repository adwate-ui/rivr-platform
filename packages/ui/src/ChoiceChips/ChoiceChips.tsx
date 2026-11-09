import { t } from '@rivr/i18n';
import { useId, useRef, type KeyboardEvent } from 'react';
import { cx } from '../internal/classes.ts';
import { useIsInConsole } from '../internal/consoleFrame.ts';
import { nextRadioIndex } from '../internal/radioKeys.ts';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

/** One choice: the value it stands for and what it says. */
export interface ChoiceChip<Value extends string> {
  readonly value: Value;
  readonly label: string;
  /** How many there are of it, shown after the label and read with it as the chip's name: "Pending, 3". */
  readonly count?: number | undefined;
  /** A line under the label in the `card` look, read as the choice's description: "Bonus chips on a buy-in, % or fixed". */
  readonly description?: string | undefined;
}

export interface ChoiceChipsProps<Value extends string> {
  /** What is being chosen, for example "Games". Screen readers read it as the group's name. */
  label: string;
  options: readonly ChoiceChip<Value>[];
  selected: readonly Value[];
  onChange: (selected: Value[]) => void;
  /**
   * `many` lets any number be chosen, a group of toggle buttons; `one` is a radio group (#699): the arrow keys move
   * between the choices and choose, and pressing the chosen one keeps it.
   */
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
   * rating of 1 to 5 or Add time's three lengths (decision 0320). `subtle`, the console's filter chips (console v3): a
   * faint cream fill, the chosen one gold-tinted with a gold edge inside it, 34 px at a desk and 44 px below 1180 px. `card`, the console's choice
   * of a kind with a line on each (console v3, a promotion's reward): outlined cards, one a row on a phone and two from
   * 768 px, the chosen one gold-edged and tinted. `chip` elsewhere.
   */
  look?: 'chip' | 'pill' | 'tile' | 'tabs' | 'subtle' | 'card';
}

type ChipLook = NonNullable<ChoiceChipsProps<string>['look']>;

const CHIP =
  'min-h-touch rounded-md border px-4 font-text text-14 leading-control font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-disabled';

const PILL = 'min-h-touch rounded-full border px-4 font-text text-14 leading-control transition-colors disabled:cursor-not-allowed disabled:opacity-disabled';

// Five ratings sit in 52 px tiles; three lengths of time in 56 px ones, as in the prototype. Every look's label has a
// whole-pixel line box (leading-control), so centred in its chip it starts on a pixel (#762).
const TILE = 'rounded-md border font-text text-18 leading-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-disabled';

const TILE_ROW: Record<number, string> = { 3: 'grid grid-cols-3 gap-2', 5: 'grid grid-cols-5 gap-2' };

// The Order screen's categories (decision 0320): words over a hairline, the chosen one underlined in gold under its word
// alone. Each word keeps 12 px either side, so the gaps between words are even, and the first starts on the column (F-210).
const TAB = '-mb-px flex min-h-touch min-w-touch items-stretch px-3 font-text text-16 font-medium transition-colors first:pl-0';

// The console's filter chips (console v3): filled rather than outlined, cream words on either fill, never muted ones.
const SUBTLE =
  'inline-flex min-h-touch items-center rounded-md px-3 font-text text-13 leading-control text-content transition-colors tablet:min-h-row-compact ' +
  'focus-visible:outline focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-disabled';

// The console's cards (console v3): a semibold label and a muted line under it, both from the card's start.
const CARD =
  'flex min-h-touch flex-col items-start justify-center gap-1 rounded-md border px-3 py-2 text-start font-text transition-colors ' +
  'focus-visible:outline focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-disabled';

/** The row the choices sit in, by look. */
function rowClasses(look: ChipLook, optionCount: number, isOneRow: boolean): string {
  if (look === 'tile') return TILE_ROW[optionCount] ?? 'grid grid-cols-3 gap-2';
  if (look === 'card') return 'grid grid-cols-1 gap-2 medium:grid-cols-2';
  if (look === 'tabs') return 'flex gap-2 border-b border-hairline';
  return cx('flex gap-2', isOneRow ? 'overflow-x-auto' : 'flex-wrap');
}

/** The console's looks (console v3): filled chips, and outlined cards with a line each. */
function consoleClasses(look: 'subtle' | 'card', isOn: boolean): string {
  if (look === 'card') return cx(CARD, isOn ? 'border-gold bg-gold-tint' : 'border-control');
  // The edge is inside the chip, so nothing moves as it is chosen; the tint alone would be 1.11:1 against the others (F-019).
  return cx(SUBTLE, isOn ? 'bg-selected font-medium inset-ring inset-ring-gold' : 'bg-subtle hover:bg-subtle-hover');
}

/** The classes of one choice in each look, on or off. */
function choiceClasses(look: ChipLook, isOn: boolean, optionCount: number): string {
  if (look === 'tabs') return cx(TAB, isOn ? 'text-content' : 'text-content-muted');
  if (look === 'subtle' || look === 'card') return consoleClasses(look, isOn);
  if (look === 'chip') return cx(CHIP, isOn ? 'border-action bg-raised text-content' : 'border-control text-content-muted');
  const picked = isOn ? 'border-gold bg-gold-tint text-content' : 'border-control text-content-muted';
  return look === 'pill' ? cx(PILL, picked) : cx(TILE, optionCount === 5 ? 'h-round' : 'h-tile', picked);
}

/**
 * A chip's name: with its count, `Pending, 3`; a card's, its label alone, its line read as its description; otherwise
 * none, so its words name it.
 */
function namingOf(chip: ChoiceChip<string>, descriptionId: string) {
  if (chip.description !== undefined) return { 'aria-label': chip.label, 'aria-describedby': descriptionId };
  return { 'aria-label': chip.count === undefined ? undefined : t('ui.console.choiceChips.withCount', { label: chip.label, count: chip.count }) };
}

/** A chip's label, then any count, in the chip's own colour and set apart by its regular weight; a card's label over its line, in cream on a chosen card's tint (F-026). */
function ChipWords({ chip, descriptionId, isOn }: { chip: ChoiceChip<string>; descriptionId: string; isOn: boolean }) {
  if (chip.description !== undefined) {
    return (
      <>
        <span className="text-14 font-semibold leading-control text-content">{chip.label}</span>
        <span id={descriptionId} className={cx('text-12', isOn ? 'text-content' : 'text-content-muted')}>{chip.description}</span>
      </>
    );
  }
  return (
    <>
      {chip.label}
      {chip.count === undefined ? null : <span className="ms-2 font-regular tabular-nums">{chip.count}</span>}
    </>
  );
}

/** A choice's words, and on a tab the gold line under the chosen word, on the row's hairline (F-210). */
function Words({ chip, look, isOn, descriptionId }: { chip: ChoiceChip<string>; look: ChipLook; isOn: boolean; descriptionId: string }) {
  if (look !== 'tabs') return <ChipWords chip={chip} descriptionId={descriptionId} isOn={isOn} />;
  return (
    <span className={cx('flex items-center border-b-2', isOn ? 'border-gold' : 'border-transparent')}>
      <ChipWords chip={chip} descriptionId={descriptionId} isOn={isOn} />
    </span>
  );
}

interface RowProps<Value extends string> extends ChoiceChipsProps<Value> {
  readonly labelId: string;
}

const chipClasses = (look: ChipLook, isOn: boolean, optionCount: number, isOneRow: boolean) =>
  cx(choiceClasses(look, isOn, optionCount), isOneRow && 'shrink-0 whitespace-nowrap');

/**
 * One choice of a few, as a radio group (#699): only the chosen chip (or the first) is in the Tab order, the arrow keys
 * move to the next and choose it, and pressing the chosen one keeps it.
 */
function RadioChips<Value extends string>({ labelId, options, selected, onChange, isDisabled, isOneRow = false, look = 'chip' }: RowProps<Value>) {
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const chosenAt = options.findIndex((option) => selected.includes(option.value));
  const choose = (index: number) => {
    const option = options[index];
    if (option !== undefined && !selected.includes(option.value)) onChange([option.value]);
  };
  // A press focuses its chip by itself; an arrow key moves the focus along with the choice.
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextRadioIndex(event.key, index, options.length);
    if (next === null) return;
    event.preventDefault();
    choose(next);
    chips.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby={labelId} data-chip-row={isOneRow ? '' : undefined} className={rowClasses(look, options.length, isOneRow)}>
      {options.map((option, index) => {
        const isOn = selected.includes(option.value);
        return (
          <button key={option.value} ref={(node) => { chips.current[index] = node; }} type="button" role="radio" aria-checked={isOn}
            {...namingOf(option, `${labelId}-${String(index)}`)} tabIndex={index === Math.max(chosenAt, 0) ? 0 : -1} disabled={isDisabled}
            onClick={() => choose(index)} onKeyDown={(event) => move(event, index)} className={chipClasses(look, isOn, options.length, isOneRow)}>
            <Words chip={option} look={look} isOn={isOn} descriptionId={`${labelId}-${String(index)}`} />
          </button>
        );
      })}
    </div>
  );
}

/** Any number of choices, as a group of toggle buttons: pressing one adds it or takes it away. */
function ToggleChips<Value extends string>({ labelId, options, selected, onChange, isDisabled, isOneRow = false, look = 'chip' }: RowProps<Value>) {
  const press = (value: Value) => onChange(selected.includes(value) ? selected.filter((chosen) => chosen !== value) : [...selected, value]);
  return (
    <div role="group" aria-labelledby={labelId} data-chip-row={isOneRow ? '' : undefined} className={rowClasses(look, options.length, isOneRow)}>
      {options.map((option, index) => {
        const isOn = selected.includes(option.value);
        return (
          <button key={option.value} type="button" aria-pressed={isOn} {...namingOf(option, `${labelId}-${String(index)}`)} disabled={isDisabled}
            onClick={() => press(option.value)} className={chipClasses(look, isOn, options.length, isOneRow)}>
            <Words chip={option} look={look} isOn={isOn} descriptionId={`${labelId}-${String(index)}`} />
          </button>
        );
      })}
    </div>
  );
}

/** A preference picked from a few choices, such as games or stakes: a row of chips that wraps, or scrolls. */
export function ChoiceChips<Value extends string>(props: ChoiceChipsProps<Value>) {
  const { label, mode = 'many', isLabelVisuallyHidden = false } = props;
  const labelId = useId();
  // On the console chips are filled unless they name another look (audit F-125).
  const isInConsole = useIsInConsole();
  const look = props.look ?? (isInConsole ? 'subtle' : 'chip');
  return (
    <Stack gap={2}>
      {isLabelVisuallyHidden ? (
        <span id={labelId} className="sr-only">{label}</span>
      ) : (
        <Text id={labelId} variant="label">
          {label}
        </Text>
      )}
      {mode === 'one' ? <RadioChips {...props} look={look} labelId={labelId} /> : <ToggleChips {...props} look={look} labelId={labelId} />}
    </Stack>
  );
}
