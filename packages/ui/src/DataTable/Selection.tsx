import { t } from '@rivr/i18n';
import { cx } from '../internal/classes.ts';

/** The rows chosen, by their keys from `rowKey`, and what to do when the choice changes. The screen keeps the choice. */
export interface DataTableSelection {
  readonly selected: readonly string[];
  readonly onChange: (keys: string[]) => void;
}

/** The choice as the table shows it: each row's tick, and the header's, which stands for every row as shown. */
export interface Ticks {
  readonly isTicked: (key: string) => boolean;
  readonly toggle: (key: string) => void;
  readonly every: 'all' | 'some' | 'none';
  readonly toggleEvery: () => void;
}

/**
 * The ticks for the rows as shown (filtered): the header's ticks every one of them, or, when all are ticked, none of
 * them. Rows the filter hides keep their choice either way.
 */
export function ticksFor(selection: DataTableSelection, shown: readonly string[]): Ticks {
  const chosen = new Set(selection.selected);
  const ticked = shown.filter((key) => chosen.has(key)).length;
  const every = ticked === 0 ? 'none' : ticked === shown.length ? 'all' : 'some';
  return {
    isTicked: (key) => chosen.has(key),
    toggle: (key) => selection.onChange(chosen.has(key) ? selection.selected.filter((other) => other !== key) : [...selection.selected, key]),
    every,
    toggleEvery: () => {
      const showing = new Set(shown);
      const hidden = selection.selected.filter((key) => !showing.has(key));
      selection.onChange(every === 'all' ? hidden : [...hidden, ...shown]);
    },
  };
}

interface TickProps {
  readonly label: string;
  readonly isChecked: boolean;
  /** Some of the rows ticked: the header's tick shows a dash. */
  readonly isMixed: boolean;
  readonly onChange: () => void;
}

/** A native checkbox in the gold; the label round it takes the tap, 44 px each way below 1180 px (decision 0282). */
export function Tick({ label, isChecked, isMixed, onChange }: TickProps) {
  return (
    <label className="flex min-h-touch min-w-touch cursor-pointer items-center justify-center tablet:min-h-0 tablet:min-w-0">
      <input type="checkbox" aria-label={label} checked={isChecked} onChange={onChange}
        ref={(box) => { if (box !== null) box.indeterminate = isMixed; }}
        className="size-4 cursor-pointer accent-gold focus-visible:outline-2 focus-visible:outline-focus" />
    </label>
  );
}

/** A row's tick, read with the row's title: "Select Arjun Mehta". `place` sets it in the row for the layout. */
export function TickCell({ title, isChecked, onToggle, place }: { title: string; isChecked: boolean; onToggle: () => void; place: string }) {
  return (
    <div role="cell" className={cx('flex items-center', place)}>
      <Tick label={t('ui.console.dataTable.selectRow', { row: title })} isChecked={isChecked} isMixed={false} onChange={onToggle} />
    </div>
  );
}

/** The header's tick, for every row as shown: ticked when all are, a dash when some are. */
export function TickHeader({ ticks, place }: { ticks: Ticks; place: string }) {
  return (
    <div role="columnheader" className={cx('flex items-center', place)}>
      <Tick label={t('ui.console.dataTable.selectAll')} isChecked={ticks.every === 'all'} isMixed={ticks.every === 'some'} onChange={ticks.toggleEvery} />
    </div>
  );
}
