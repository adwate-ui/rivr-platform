import { t } from '@rivr/i18n';
import { Fragment, type ReactNode } from 'react';
import { Text } from '../Text/Text.tsx';

/** What the bar needs of a column; DataTable's columns are these and more. */
interface BarColumn {
  readonly key: string;
}

/**
 * Below 768 px, where the header row is hidden: each column that sorts or filters as its name above the cards, opening
 * its menu (#605; owner, 9 Nov). DataTable draws it only there, so a desk's page holds no second set of menus.
 */
export function PhoneSort<Column extends BarColumn>({ label, columns, menu }: { label: string; columns: readonly Column[]; menu: (column: Column) => ReactNode }) {
  const items = columns.map((column) => ({ key: column.key, node: menu(column) })).filter(({ node }) => node !== null);
  if (items.length === 0) return null;
  return (
    // Named for its table, as a screen may hold several.
    <div role="group" aria-label={t('ui.dataTable.sortTable', { table: label })} className="flex flex-wrap items-center gap-x-2">
      <Text variant="small" tone="muted">{t('ui.dataTable.sortBy')}</Text>
      {items.map(({ key, node }) => <Fragment key={key}>{node}</Fragment>)}
    </div>
  );
}
