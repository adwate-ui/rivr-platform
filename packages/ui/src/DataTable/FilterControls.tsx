import { t } from '@rivr/i18n';
import { ChoiceChips } from '../ChoiceChips/ChoiceChips.tsx';
import { Input } from '../Input/Input.tsx';
import { choicesOf, DATE_PRESETS, type ColumnFilter, type FilteredColumn } from './filters.ts';

/** What a column's filter works on: the column and its kind, every row, its filter in force, and how it changes. */
export interface FilterControlProps<Row> {
  readonly filtered: FilteredColumn<Row>;
  /** Every row, filtered or not, so a choice never vanishes as others are picked. */
  readonly rows: readonly Row[];
  readonly filter: ColumnFilter | undefined;
  /** A new filter, or none; `isTyping` while words or figures are typed. */
  readonly onFilter: (filter: ColumnFilter | undefined, isTyping?: boolean) => void;
}

function TextFilter<Row>({ filter, onFilter }: FilterControlProps<Row>) {
  return (
    <Input type="search" label={t('ui.dataTable.contains')} autoComplete="off" value={filter?.kind === 'text' ? filter.typed : ''}
      onChange={(event) => onFilter(event.target.value === '' ? undefined : { kind: 'text', typed: event.target.value }, true)} />
  );
}

/** Each of the column's values with how many rows hold it; a long list scrolls in the menu. */
function ChoiceFilter<Row>({ filtered, rows, filter, onFilter }: FilterControlProps<Row>) {
  const options = choicesOf(filtered.column, rows).map(({ value, count }) => ({ value, label: value, count }));
  return (
    <div>
      <ChoiceChips label={filtered.column.header} isLabelVisuallyHidden mode="many" look="subtle" options={options}
        selected={filter?.kind === 'choice' ? filter.chosen : []}
        onChange={(chosen) => onFilter(chosen.length === 0 ? undefined : { kind: 'choice', chosen })} />
    </div>
  );
}

/** A figure, or hours, from and to: either may be left blank. */
function RangeFilter<Row>({ filtered, filter, onFilter }: FilterControlProps<Row>) {
  const { min, max } = filter?.kind === 'range' ? filter : { min: '', max: '' };
  const suffix = filtered.kind === 'duration' ? t('ui.dataTable.hoursUnit') : undefined;
  const set = (next: { readonly min: string; readonly max: string }) =>
    onFilter(next.min.trim() === '' && next.max.trim() === '' ? undefined : { kind: 'range', ...next }, true);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input label={t('ui.dataTable.from')} inputMode="decimal" autoComplete="off" suffix={suffix} value={min} onChange={(event) => set({ min: event.target.value, max })} />
      <Input label={t('ui.dataTable.to')} inputMode="decimal" autoComplete="off" suffix={suffix} value={max} onChange={(event) => set({ min, max: event.target.value })} />
    </div>
  );
}

/** A preset of days counted back from today, or days from and to. */
function DateFilter<Row>({ filter, onFilter }: FilterControlProps<Row>) {
  const { from, to } = filter?.kind === 'dateRange' ? filter : { from: '', to: '' };
  const setDays = (next: { readonly from: string; readonly to: string }) =>
    onFilter(next.from === '' && next.to === '' ? undefined : { kind: 'dateRange', ...next });
  return (
    <div className="flex flex-col gap-3">
      <ChoiceChips label={t('ui.dataTable.days')} isLabelVisuallyHidden mode="one" look="subtle" selected={filter?.kind === 'date' ? [filter.preset] : []}
        options={DATE_PRESETS.map((value) => ({ value, label: t(`ui.dataTable.datePresets.${value}`) }))}
        onChange={([preset]) => onFilter(preset === undefined ? undefined : { kind: 'date', preset })} />
      {/* One under the other: a date field shows its whole day only at a menu's full width. */}
      <div className="flex flex-col gap-3">
        <Input type="date" label={t('ui.dataTable.from')} value={from} onChange={(event) => setDays({ from: event.target.value, to })} />
        <Input type="date" label={t('ui.dataTable.to')} value={to} onChange={(event) => setDays({ from, to: event.target.value })} />
      </div>
    </div>
  );
}

/** A column's filter by its kind (owner, 9 Nov): words it contains, values to choose, a range, or days. */
export function FilterControls<Row>(props: FilterControlProps<Row>) {
  switch (props.filtered.kind) {
    case 'text': return <TextFilter {...props} />;
    case 'choice': return <ChoiceFilter {...props} />;
    case 'number':
    case 'duration': return <RangeFilter {...props} />;
    case 'date': return <DateFilter {...props} />;
  }
}
