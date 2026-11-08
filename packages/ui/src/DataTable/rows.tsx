import { tokens } from '@rivr/tokens';
import { Fragment, useState, type CSSProperties, type MouseEvent, type ReactNode, type UIEvent } from 'react';
import { cx } from '../internal/classes.ts';
import { useIsWide } from '../useIsWide/useIsWide.ts';
import type { DataTableColumn } from './columns.ts';
import { textOf } from './DataTableExport.tsx';
import { OpenedRow, placesOf } from './OpenedRow.tsx';
import { TickCell, type Ticks } from './Selection.tsx';

// A line's height from 768 px, below 1180 px, where a row stays a 44 px target (decision 0282).
const ROW_HEIGHT = tokens.space[12];
// A card below 768 px: each line this high, the gap between lines, the padding above and below, the hairline under it.
const CARD_LINE = tokens.space[6];
const CARD_GAP = tokens.space[1];
const CARD_PADDING = tokens.space[3] * 2;
const HAIRLINE = 1;
// A long list's body: twelve such lines high.
const BODY_HEIGHT = ROW_HEIGHT * 12;
// Rows drawn beyond each edge of the view, so a quick scroll shows no gap.
const OVERSCAN = 6;
// A scrolling body and the header above it keep the same room for a scrollbar, so their columns line up.
export const GUTTER = { scrollbarGutter: 'stable' } as const;

type Priority = NonNullable<DataTableColumn<unknown>['priority']>;

/** How the header and every row are drawn. */
export interface Layout {
  /** Below 768 px: a card per row, or the table's lines scrolling sideways; `sideways`, lines scrolling sideways at every width. */
  readonly narrow: 'cards' | 'scroll' | 'sideways';
  /** A row's height from 1180 px. */
  readonly density: 'comfortable' | 'compact';
  readonly ticks: Ticks | null;
  /** Where rows are lines and have ticks: the ticks' column as wide as a tick, then a share per column, two for a wide one. */
  readonly grid: CSSProperties | undefined;
}

export function layoutOf<Row>(columns: readonly DataTableColumn<Row>[], narrow: Layout['narrow'], density: Layout['density'], ticks: Ticks | null): Layout {
  const shares = columns.reduce((sum, column) => sum + (column.isWide ? 2 : 1), 0);
  const ticksColumn = ticks === null ? '' : 'auto ';
  // Sideways, each share is at least a column's width, so the line grows past the page and scrolls rather than squeeze.
  if (narrow === 'sideways') return { narrow, density, ticks, grid: { gridTemplateColumns: `${ticksColumn}repeat(${shares}, minmax(${tokens.size.column}px, 1fr))` } };
  return { narrow, density, ticks, grid: ticks === null ? undefined : { gridTemplateColumns: `${ticksColumn}repeat(${shares}, minmax(0, 1fr))` } };
}

export const priorityOf = (column: DataTableColumn<never>, index: number): Priority => column.priority ?? (index === 0 ? 'primary' : 'secondary');

// From 768 px up a row is a line of equal columns; below, it is a card: its title, then a line for each other column.
const WIDE_GRID = 'medium:grid medium:grid-flow-col medium:auto-cols-fr medium:items-center medium:gap-4';
// In the scroll layout a row is a line at every width; below 768 px it is at least a line of text wide and scrolls sideways.
const LINE = 'grid grid-flow-col auto-cols-fr items-center gap-4 max-medium:min-w-text';
// The first column in the scroll layout below 768 px: held at the start, on the page's colour, as the rest scrolls under it.
const HELD = 'max-medium:sticky max-medium:bg-surface';

/** What differs between the layouts below 768 px. */
export const LOOK = {
  cards: {
    header: WIDE_GRID,
    row: `flex flex-col gap-1 py-3 ${WIDE_GRID}`,
    // A long list's row, of one height; else one whose long text wraps onto its next line (F5-05).
    fixed: 'absolute inset-x-0 top-0 overflow-clip medium:h-12 medium:py-0',
    free: 'relative medium:min-h-12 medium:py-2',
    headerCell: 'hidden medium:flex',
    // On a card a secondary cell names its column before its value, from data-label (styles.css).
    cell: { primary: '', secondary: 'flex justify-between gap-3 medium:block', optional: 'hidden medium:block' },
    span: 'medium:col-span-2',
    end: 'medium:text-end',
    group: undefined,
    headerGroup: undefined,
  },
  scroll: {
    header: LINE,
    row: LINE,
    fixed: 'absolute inset-x-0 top-0 overflow-clip',
    free: 'relative min-h-12 py-2',
    headerCell: 'flex',
    cell: { primary: '', secondary: '', optional: '' },
    span: 'col-span-2',
    end: 'text-end',
    group: 'max-medium:overflow-x-auto',
    headerGroup: 'max-medium:overflow-x-hidden',
  },
  // At every width (the docked Members table, owner 9 Nov): lines as wide as their columns need, scrolling sideways.
  sideways: {
    header: 'grid items-center gap-4 min-w-min',
    row: 'grid items-center gap-4 min-w-min',
    fixed: 'absolute inset-x-0 top-0 overflow-clip',
    free: 'relative min-h-12 py-2',
    headerCell: 'flex',
    cell: { primary: '', secondary: '', optional: '' },
    span: 'col-span-2',
    end: 'text-end',
    group: 'overflow-x-auto',
    headerGroup: 'overflow-x-hidden',
  },
} as const;

const DENSITY = { comfortable: 'tablet:min-h-row tablet:py-1', compact: 'tablet:min-h-row-compact tablet:py-1' } as const;

/** The title's cell in the scroll layout below 768 px: held after the ticks, or at the start. */
export function heldTitle(layout: Layout): string | undefined {
  if (layout.narrow === 'cards') return undefined;
  // Sideways at every width the ticks are held where there are any, else the title.
  if (layout.narrow === 'sideways') return layout.ticks === null ? 'sticky left-0 bg-surface' : undefined;
  return cx(HELD, layout.ticks === null ? 'max-medium:left-0' : 'max-medium:left-touch');
}

/** Where a tick sits below 768 px: held with the title, at a card's start, or alone in the cards' header row. */
export function tickPlace(layout: Layout, isHeader: boolean): string {
  if (layout.narrow === 'sideways') return 'sticky left-0 bg-surface';
  if (layout.narrow === 'scroll') return `${HELD} max-medium:left-0`;
  return isHeader ? '' : 'absolute inset-y-0 left-0 medium:static';
}

export function headerRowClasses(layout: Layout): string {
  const look = LOOK[layout.narrow];
  // Below 768 px the cards' header shows only the tick for every row, above each card's.
  if (layout.narrow === 'cards' && layout.ticks !== null) return cx('relative flex border-b border-hairline medium:px-3', look.header);
  return cx('relative border-b border-hairline px-3', look.header, layout.narrow === 'cards' && 'hidden');
}

/**
 * A row's fill: the chosen one when ticked, from 768 px. Below, a tick shows it alone: a card's column names are muted,
 * which falls below 4.5:1 on the fill, and the held first column keeps the page's colour.
 */
function fillOf(isTicked: boolean, opens: boolean): string {
  if (isTicked) return 'medium:bg-selected';
  return opens ? 'hover:bg-subtle' : 'hover:bg-raised';
}

function rowClasses(layout: Layout, isOneLine: boolean, opens: boolean, isTicked: boolean): string {
  const look = LOOK[layout.narrow];
  // A card with a tick leaves room at its start for it.
  const sides = layout.narrow === 'cards' && layout.ticks !== null ? 'pl-12 pr-3 medium:px-3' : 'px-3';
  return cx('border-b border-hairline transition-colors', look.row, sides, isOneLine ? look.fixed : cx(look.free, DENSITY[layout.density]),
    opens && 'cursor-pointer', fillOf(isTicked, opens));
}

function cellClasses<Row>(column: DataTableColumn<Row>, priority: Priority, layout: Layout, isOneLine: boolean): string {
  const look = LOOK[layout.narrow];
  const isTitle = priority === 'primary';
  // The console's type: the title 15 px medium, the rest 13 px, all in the full colour, which stays clear on a row's fill.
  return cx('min-w-0 font-text text-content wrap-anywhere', isTitle ? 'text-15 font-medium' : 'text-13', isOneLine && 'truncate',
    look.cell[priority], isTitle && heldTitle(layout), column.isWide && look.span, column.align === 'end' ? look.end : 'text-start');
}

/** The title cell's content: when rows open, the button a keyboard and a screen reader open the row with. */
function Title({ content, onOpen, isOneLine }: { content: ReactNode; onOpen: (() => void) | undefined; isOneLine: boolean }) {
  if (onOpen === undefined) return <>{content}</>;
  return (
    <button type="button" onClick={onOpen}
      className="flex min-h-touch w-full cursor-pointer items-center text-start text-content underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus tablet:min-h-0">
      <span className={isOneLine ? 'truncate' : undefined}>{content}</span>
    </button>
  );
}

/** A cell's words as its title, in a long list whose rows keep to one line, so text cut short can still be read (F5-05). */
function titleOf(content: ReactNode, isOneLine: boolean): string | undefined {
  return isOneLine && (typeof content === 'string' || typeof content === 'number') ? String(content) : undefined;
}

interface BodyCellProps<Row> {
  readonly row: Row;
  readonly column: DataTableColumn<Row>;
  readonly priority: Priority;
  readonly layout: Layout;
  readonly isOneLine: boolean;
  readonly onRowOpen: ((row: Row) => void) | undefined;
}

function BodyCell<Row>({ row, column, priority, layout, isOneLine, onRowOpen }: BodyCellProps<Row>) {
  const content = column.cell(row);
  return (
    // A long list's rows are one height, so there a cell keeps to one line and its words are its title (F5-05);
    // elsewhere long text wraps onto the row's next line rather than be cut. On a phone's card, a value with no
    // spaces (a key, a link) breaks rather than spill, and data-label names the column before the value.
    <div role="cell" data-label={layout.narrow === 'cards' && priority === 'secondary' ? column.header : undefined}
      title={titleOf(content, isOneLine)} className={cellClasses(column, priority, layout, isOneLine)}>
      {priority === 'primary' ? <Title content={content} onOpen={onRowOpen && (() => onRowOpen(row))} isOneLine={isOneLine} /> : content}
    </div>
  );
}

// A click on a control in a row (its tick, a button in a cell, the title's own) is the control's, not the row's.
const CONTROLS = 'a, button, input, label, select, textarea';

function isOnControl(event: MouseEvent<HTMLElement>): boolean {
  const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null;
  return control !== null && event.currentTarget.contains(control);
}

/** A tick's name: the row's title in words, else its key. */
function titleWords<Row>(row: Row, id: string, columns: readonly DataTableColumn<Row>[]): string {
  const title = columns.find((column, at) => priorityOf(column, at) === 'primary');
  return (title === undefined ? '' : textOf(title.cell(row))) || id;
}

interface BodyRowProps<Row> {
  readonly row: Row;
  /** The row's key, from rowKey. */
  readonly id: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly index: number;
  readonly layout: Layout;
  readonly onRowOpen: ((row: Row) => void) | undefined;
  /** In a long list: where the row is drawn, and its height. */
  readonly place?: { readonly offset: number; readonly height: number };
}

/** A row. When rows open, a click anywhere on it opens it; its title's button is how a keyboard does, so the row takes no focus. */
function BodyRow<Row>({ row, id, columns, index, layout, onRowOpen, place }: BodyRowProps<Row>) {
  const isOneLine = place !== undefined;
  const isTicked = layout.ticks?.isTicked(id) === true;
  return (
    <div role="row" aria-rowindex={index + 2} onClick={onRowOpen && ((event) => { if (!isOnControl(event)) onRowOpen(row); })}
      className={rowClasses(layout, isOneLine, onRowOpen !== undefined, isTicked)}
      style={place === undefined ? layout.grid : { ...layout.grid, transform: `translateY(${place.offset}px)`, height: place.height }}>
      {layout.ticks === null ? null : (
        <TickCell title={titleWords(row, id, columns)} isChecked={isTicked} onToggle={() => layout.ticks?.toggle(id)} place={tickPlace(layout, false)} />
      )}
      {columns.map((column, at) => (
        <BodyCell key={column.key} row={row} column={column} priority={priorityOf(column, at)} layout={layout} isOneLine={isOneLine} onRowOpen={onRowOpen} />
      ))}
    </div>
  );
}

export interface BodyProps<Row> {
  readonly rows: readonly Row[];
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rowKey: (row: Row) => string;
  readonly onRowOpen: ((row: Row) => void) | undefined;
  readonly layout: Layout;
  /** The body scrolled sideways (the scroll layout below 768 px): the header follows it. */
  readonly onScrollX: (event: UIEvent<HTMLElement>) => void;
  /** What a row opened in place, drawn under it; only when every row is drawn. */
  readonly rowDetail?: ((row: Row) => ReactNode) | undefined;
}

/** Up to VIRTUAL_FROM rows: every one drawn, each followed by its detail when it has one open. */
export function PlainBody<Row>({ rows, columns, rowKey, onRowOpen, layout, onScrollX, rowDetail }: BodyProps<Row>) {
  const details = rows.map((row) => rowDetail?.(row) ?? null);
  const places = placesOf(details);
  return (
    <div role="rowgroup" className={LOOK[layout.narrow].group} onScroll={onScrollX}>
      {rows.map((row, at) => (
        <Fragment key={rowKey(row)}>
          <BodyRow row={row} id={rowKey(row)} columns={columns} index={places[at] ?? at} layout={layout} onRowOpen={onRowOpen} />
          {details[at] === null ? null : <OpenedRow index={(places[at] ?? at) + 1} columns={columns.length + (layout.ticks === null ? 0 : 1)}>{details[at]}</OpenedRow>}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * A card's height below 768 px, for the drawn window of a long list: its title (a 44 px button when rows open), a line
 * for each secondary column, and what is between and around them. A long list's cells keep to one line, so it holds.
 */
function cardHeight<Row>(columns: readonly DataTableColumn<Row>[], opens: boolean): number {
  const secondary = columns.filter((column, index) => priorityOf(column, index) === 'secondary').length;
  return (opens ? tokens.size.touch : CARD_LINE) + secondary * (CARD_GAP + CARD_LINE) + CARD_PADDING + HAIRLINE;
}

/** A long list's row height: from 1180 px the density's; a line's from 768 px or in the scroll layout; else a card's. */
function useRowHeight<Row>(columns: readonly DataTableColumn<Row>[], opens: boolean, layout: Layout): number {
  const isDesk = useIsWide('tablet');
  const isLine = useIsWide('medium') || layout.narrow === 'scroll';
  if (isDesk) return layout.density === 'compact' ? tokens.size.rowCompact : tokens.size.row;
  return isLine ? ROW_HEIGHT : cardHeight(columns, opens);
}

/**
 * Past VIRTUAL_FROM rows: a scrolling body of a fixed height, which takes keyboard focus so arrow keys
 * scroll it. Rows are all one height, so the rows in view, and a few either side, follow from how far
 * it is scrolled; only those are drawn.
 */
export function VirtualBody<Row>({ rows, columns, rowKey, onRowOpen, layout, onScrollX }: BodyProps<Row>) {
  const [scrolled, setScrolled] = useState(0);
  const height = useRowHeight(columns, onRowOpen !== undefined, layout);
  const first = Math.max(0, Math.floor(scrolled / height) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrolled + BODY_HEIGHT) / height) + OVERSCAN);
  return (
    <div role="rowgroup" tabIndex={0} className="overflow-y-auto focus-visible:outline-2 focus-visible:outline-focus"
      style={{ ...GUTTER, height: BODY_HEIGHT }} onScroll={(event) => { setScrolled(event.currentTarget.scrollTop); onScrollX(event); }}>
      <div className="relative w-full" style={{ height: rows.length * height }}>
        {rows.slice(first, last).map((row, index) => (
          <BodyRow key={rowKey(row)} row={row} id={rowKey(row)} columns={columns} index={first + index} layout={layout} onRowOpen={onRowOpen}
            place={{ offset: (first + index) * height, height }} />
        ))}
      </div>
    </div>
  );
}
