import { t } from '@rivr/i18n';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

/** What sorting needs of a column; DataTable's columns are these and more. */
interface SortableColumn {
  readonly key: string;
  readonly header: string;
  readonly sortValue?: unknown;
}

/** The order in force, as DataTable keeps it. */
type Sort = { readonly key: string; readonly direction: 'ascending' | 'descending' } | null;

/**
 * Below 768 px, where the header row is hidden: each sortable column as a button above the cards, the one in use marked
 * (#605). DataTable draws it only there, so a desk's page holds no second set of sort buttons.
 */
export function PhoneSort({ label, columns, sort, onSort }: { label: string; columns: readonly SortableColumn[]; sort: Sort; onSort: (key: string) => void }) {
  const sortable = columns.filter((column) => column.sortValue !== undefined);
  if (sortable.length === 0) return null;
  return (
    // Named for its table, as a screen may hold several.
    <div role="group" aria-label={t('ui.dataTable.sortTable', { table: label })} className="flex flex-wrap items-center gap-x-4">
      <Text variant="small" tone="muted">{t('ui.dataTable.sortBy')}</Text>
      {sortable.map((column) => {
        const direction = sort?.key === column.key ? sort.direction : undefined;
        const name = direction === undefined ? t('ui.dataTable.sortByColumn', { column: column.header })
          : t('ui.dataTable.sortedBy', { column: column.header, direction: t(`ui.dataTable.${direction}`) });
        return (
          <button key={column.key} type="button" aria-label={name} aria-pressed={direction !== undefined} onClick={() => onSort(column.key)}
            className="flex min-h-touch min-w-touch items-center justify-center gap-1 font-text text-14 text-content-muted transition-colors hover:text-content focus-visible:text-content aria-pressed:text-content">
            {column.header}
            {direction === undefined ? null : <Icon name={direction === 'ascending' ? 'chevronUp' : 'chevronDown'} size="sm" />}
          </button>
        );
      })}
    </div>
  );
}
