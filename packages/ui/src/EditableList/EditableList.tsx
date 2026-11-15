import { formatNumber, t } from '@rivr/i18n';
import { useId, useRef, useState } from 'react';
import { Button } from '../Button/Button.tsx';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { Text } from '../Text/Text.tsx';
import { rangeText, readUnit, type Unit, type UnitRange } from '../UnitInput/unit.ts';
import { UnitField } from '../UnitInput/UnitField.tsx';

export interface EditableListProps {
  /** What the list holds, read as its name: "Add time choices". */
  label: string;
  /** What one entry is called; numbered, it names each field: "Choice" gives "Choice 1". */
  entryLabel: string;
  /** The button that adds an entry: "Add a choice". */
  addLabel: string;
  /** What each entry counts, shown after it. */
  unit: Unit;
  /** The least an entry may be. */
  min: number;
  /** The most an entry may be. */
  max: number;
  /** The entries at first, in order. */
  initialValues: readonly number[];
  /** Every entry in order; null while any entry is blank, repeated or outside the range, so the screen saves nothing. */
  onChange: (values: readonly number[] | null) => void;
}

/** One entry as typed; its id keeps its field as others are removed. */
interface Entry {
  readonly id: number;
  readonly typed: string;
}

/** What the list checks entries against. */
interface Rule {
  readonly unit: Unit;
  readonly range: UnitRange;
}

/** Why the entry at `at` is refused: blank, outside the range, or a value an earlier entry holds; nothing when it stands. */
function refusalOf(entries: readonly Entry[], at: number, { unit, range }: Rule): string | undefined {
  const typed = entries[at]?.typed ?? '';
  if (typed === '') return t('ui.console.editableList.empty');
  const { value, isRefused } = readUnit(typed, range);
  if (isRefused) return rangeText(unit, range);
  const isRepeated = entries.slice(0, at).some((earlier) => readUnit(earlier.typed, range).value === value);
  return isRepeated ? t('ui.console.editableList.repeated') : undefined;
}

/** Every entry's number in order, or null while any is refused. */
function valuesOf(entries: readonly Entry[], rule: Rule): readonly number[] | null {
  if (entries.some((_, at) => refusalOf(entries, at, rule) !== undefined)) return null;
  return entries.flatMap(({ typed }) => {
    const { value } = readUnit(typed, rule.range);
    return value === null ? [] : [value];
  });
}

interface EntryRowProps {
  readonly name: string;
  readonly unit: Unit;
  readonly entry: Entry;
  readonly error: string | undefined;
  /** Added by a press: it takes the focus as it appears. */
  readonly isNew: boolean;
  readonly onTyped: (typed: string) => void;
  readonly onRemove: () => void;
}

/** An entry: its field and Remove on one line, level at their foot, and why it is refused under them. */
function EntryRow({ name, unit, entry, error, isNew, onTyped, onRemove }: EntryRowProps) {
  const errorId = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <UnitField label={name} unit={unit} typed={entry.typed} onTyped={onTyped} apartErrorId={error === undefined ? undefined : errorId} autoFocus={isNew} />
        </div>
        <Button variant="text" size="compact" aria-label={t('ui.console.editableList.removeNamed', { entry: name })} onClick={onRemove}>{t('ui.console.editableList.remove')}</Button>
      </div>
      {error === undefined ? null : <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </div>
  );
}

/**
 * A list of numbers in one unit that an admin adds to, edits and removes from (redesign RD-14), such as the lengths a
 * seated member can ask for. An entry left blank, repeating an earlier one or outside `min` to `max` is refused, with why
 * under it, and the list gives the screen nothing until every entry stands. A new entry takes the focus; after Remove the
 * focus stays on the list. It keeps what is typed, so the screen mounts it anew (a `key`) to start from other values.
 */
export function EditableList({ label, entryLabel, addLabel, unit, min, max, initialValues, onChange }: EditableListProps) {
  const rule = { unit, range: { min, max } };
  const [entries, setEntries] = useState<readonly Entry[]>(() => initialValues.map((value, id) => ({ id, typed: String(value) })));
  const [firstNewId] = useState(initialValues.length);
  const nextId = useRef(initialValues.length);
  const list = useRef<HTMLDivElement>(null);
  const change = (next: readonly Entry[]) => {
    setEntries(next);
    onChange(valuesOf(next, rule));
  };
  const add = () => {
    change([...entries, { id: nextId.current, typed: '' }]);
    nextId.current += 1;
  };
  const remove = (id: number) => {
    change(entries.filter((entry) => entry.id !== id));
    list.current?.focus();
  };
  return (
    <div ref={list} role="group" aria-label={label} tabIndex={-1} className="flex flex-col gap-4 focus:outline-none">
      {entries.length === 0 ? <Text tone="muted">{t('ui.console.editableList.none')}</Text> : null}
      {entries.map((entry, at) => (
        <EntryRow key={entry.id} name={t('ui.console.editableList.entry', { label: entryLabel, number: formatNumber(at + 1) })} unit={unit} entry={entry}
          error={refusalOf(entries, at, rule)} isNew={entry.id >= firstNewId} onRemove={() => remove(entry.id)}
          onTyped={(typed) => change(entries.map((one) => (one.id === entry.id ? { ...one, typed } : one)))} />
      ))}
      <div className="flex">
        <Button variant="subtle" size="compact" onClick={add}>{addLabel}</Button>
      </div>
    </div>
  );
}
