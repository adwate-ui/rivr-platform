import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { ChoiceChips } from '../ChoiceChips/ChoiceChips.tsx';
import { Input } from '../Input/Input.tsx';
import type { DataTableColumn } from './columns.ts';
import { choicesOf, NO_FILTERS, type ColumnFilters } from './filters.ts';

interface ColumnFiltersProps<Row> {
  /** Named by the Filters button that opens it (aria-controls). */
  readonly id: string;
  readonly columns: readonly DataTableColumn<Row>[];
  /** Every row, filtered or not, so a choice never vanishes as others are picked. */
  readonly rows: readonly Row[];
  readonly filters: ColumnFilters;
  readonly onChange: (filters: ColumnFilters) => void;
}

/**
 * The table's Filters, open below its bar (owner, 8 Nov: filters on every table): a box for each column filtered by its
 * words and chips for each filtered by its values, any of which may be picked; then Clear.
 */
export function ColumnFiltersPanel<Row>({ id, columns, rows, filters, onChange }: ColumnFiltersProps<Row>) {
  const set = (key: string, next: { typed?: string; chosen?: readonly string[] }) =>
    onChange({ ...filters, [key]: { typed: next.typed ?? '', chosen: next.chosen ?? [] } });
  const typed = columns.filter((column) => column.filter === 'text');
  // A choice column whose rows hold no value has nothing to pick, so it shows nothing.
  const choices = columns.filter((column) => column.filter === 'choice')
    .map((column) => ({ column, options: choicesOf(column, rows) })).filter(({ options }) => options.length > 0);
  return (
    <div id={id} role="group" aria-label={t('ui.dataTable.filters')} className="flex flex-col gap-4 rounded-md bg-subtle p-4">
      {typed.length === 0 ? null : (
        <div className="grid grid-cols-1 gap-4 medium:grid-cols-2">
          {typed.map((column) => (
            <Input key={column.key} type="search" label={column.header} value={filters[column.key]?.typed ?? ''} autoComplete="off"
              onChange={(event) => set(column.key, { typed: event.target.value })} />
          ))}
        </div>
      )}
      {choices.map(({ column, options }) => (
        <ChoiceChips key={column.key} label={column.header} mode="many" look="subtle" selected={filters[column.key]?.chosen ?? []}
          options={options.map(({ value, count }) => ({ value, label: value, count }))}
          onChange={(chosen) => set(column.key, { chosen })} />
      ))}
      <div className="flex">
        <Button variant="text" size="small" onClick={() => onChange(NO_FILTERS)}>{t('ui.dataTable.clearFilters')}</Button>
      </div>
    </div>
  );
}
