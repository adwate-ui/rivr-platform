import type { ReactNode, Ref } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { useIsInConsole } from '../internal/consoleFrame.ts';
import { STICKY_BAR_TOP } from '../internal/consoleMain.ts';
import { Text } from '../Text/Text.tsx';
import type { DataTableColumn, DataTableSort } from './columns.ts';
import { GUTTER, headerRowClasses, heldTitle, LOOK, priorityOf, tickPlace, type Layout, spansCell } from './rows.tsx';
import { TickHeader } from './Selection.tsx';

// The table's header row, apart from rows.tsx: each column's name, which sorts it, and its menu (owner, 9 Nov).

interface HeaderCellProps<Row> {
  readonly column: DataTableColumn<Row>;
  readonly sort: DataTableSort | null;
  readonly onSort: (key: string) => void;
  readonly place: string;
  /** The column's menu beside its name (owner, 9 Nov): its order and its filter; none for a column with neither. */
  readonly menu: ReactNode;
}

/** The menu of a column ending at its right, pulled out by its inset; nothing for a column with none. */
const PulledOut = ({ children }: { children: ReactNode }) => (children === null ? null : <span className="-me-1 inline-flex">{children}</span>);

/**
 * A column's heading: its name, a press on which sorts it, and its menu. In a column ending at its right the menu is pulled
 * out by its inset, so at a desk the funnel ends where the figures do (audit F-208); below 1180 px its target is 44 px wide.
 */
function HeaderCell<Row>({ column, sort, onSort, place, menu }: HeaderCellProps<Row>) {
  const direction = sort?.key === column.key ? sort.direction : undefined;
  const classes = cx('min-w-0 items-center gap-1', column.align === 'end' ? 'justify-end' : 'justify-start', place);
  const name = column.sortValue === undefined ? <Text variant="caption" tone="muted">{column.header}</Text> : (
    <button type="button" onClick={() => onSort(column.key)} title={column.header}
      className="flex min-h-touch min-w-touch items-center gap-1 whitespace-nowrap font-text text-12 text-content-muted transition-colors hover:text-content focus-visible:text-content tablet:min-h-control tablet:min-w-6">
      <span className="truncate">{column.header}</span>
      {direction === undefined ? null : <Icon name={direction === 'ascending' ? 'sortAscending' : 'sortDescending'} size="sm" />}
    </button>
  );
  return <div role="columnheader" aria-sort={column.sortValue === undefined ? undefined : direction ?? 'none'} className={classes}>{name}{column.align === 'end' ? <PulledOut>{menu}</PulledOut> : menu}</div>;
}

export interface HeaderRowProps<Row> {
  readonly columns: readonly DataTableColumn<Row>[];
  readonly sort: DataTableSort | null;
  readonly onSort: (key: string) => void;
  readonly layout: Layout;
  /** Above a long list's scrolling body, which it keeps the same room for a scrollbar as. */
  readonly isVirtual: boolean;
  readonly ref: Ref<HTMLDivElement>;
  /** Each column's menu beside its name. */
  readonly menuFor: (column: DataTableColumn<Row>) => ReactNode;
}

/**
 * The header row: held at the top of the page's scrolling area, on the page's colour, as the rows pass under it. In the
 * console that area keeps a space above a screen, and a held box stops at it: the header is taken up by as much, to the
 * area's top edge, or the rows would show in the gap over it (the UI review of redesign RD-29). Shown
 * from 768 px, and below in the scroll layout, where it follows the body sideways; the cards name their own columns.
 */
export function HeaderRow<Row>({ columns, sort, onSort, layout, isVirtual, ref, menuFor }: HeaderRowProps<Row>) {
  const look = LOOK[layout.narrow];
  const held = cx('sticky z-nav bg-table-header', useIsInConsole() ? STICKY_BAR_TOP : 'top-0', look.headerGroup);
  return (
    <div role="rowgroup" ref={ref} className={held} style={isVirtual ? { ...GUTTER, overflowY: 'hidden' } : undefined}>
      <div role="row" aria-rowindex={1} className={headerRowClasses(layout)} style={layout.grid}>
        {layout.ticks === null ? null : <TickHeader ticks={layout.ticks} place={tickPlace(layout, true)} />}
        {columns.map((column, at) => (
          <HeaderCell key={column.key} column={column} sort={sort} onSort={onSort} menu={menuFor(column)}
            place={cx(look.headerCell, spansCell(column, priorityOf(column, at) === 'primary', layout) && look.span,
              priorityOf(column, at) === 'primary' && heldTitle(layout))} />
        ))}
      </div>
    </div>
  );
}

