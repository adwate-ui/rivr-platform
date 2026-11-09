import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import type { DataTableColumn, DataTableSort } from './columns.ts';
import { FilterControls } from './FilterControls.tsx';
import { isOn, type ColumnFilter, type FilteredColumn } from './filters.ts';

/** What a column's menu works on: the column and its filter's kind, every row, and the table's order and filter for it. */
export interface ColumnMenuProps<Row> {
  readonly column: DataTableColumn<Row>;
  /** Its filter's kind; none for a column that only sorts. */
  readonly filtered: FilteredColumn<Row> | undefined;
  readonly rows: readonly Row[];
  readonly sort: DataTableSort | null;
  readonly onSort: (sort: DataTableSort) => void;
  readonly filter: ColumnFilter | undefined;
  readonly onFilter: (filter: ColumnFilter | undefined, isTyping?: boolean) => void;
  /** `icon`, the filter icon beside the column's heading; `words`, the column's name, on a phone's bar above the cards. */
  readonly look: 'icon' | 'words';
  /** The menu closed, however: its change is kept at once, so a row opened straight after keeps it. */
  readonly onClose?: (() => void) | undefined;
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-focus';
// 44 px below 1180 px; at a desk 24 px, so a heading keeps to one line beside it.
const ICON_TRIGGER = `inline-flex size-touch shrink-0 items-center justify-center rounded-md transition-colors tablet:size-6 hover:bg-subtle-hover hover:text-content aria-expanded:bg-subtle-hover aria-expanded:text-content ${FOCUS}`;
const WORDS_TRIGGER = `flex min-h-touch items-center gap-1 rounded-md px-2 font-text text-14 transition-colors hover:text-content aria-expanded:bg-subtle-hover ${FOCUS}`;
const PANEL = 'fixed z-overlay flex max-h-palette-list w-column-menu max-w-full flex-col gap-3 overflow-y-auto rounded-lg bg-raised p-3 shadow-modal focus:outline-none';

/**
 * Under its trigger, lined up with its start, or with its end where it would run off the page; never past either edge,
 * as on a phone, where the page may be narrower than the menu.
 */
export function placeOf(trigger: Pick<HTMLElement, 'getBoundingClientRect'>, pageWidth: number): CSSProperties {
  const edges = trigger.getBoundingClientRect();
  const width = Math.min(tokens.size.columnMenu, pageWidth);
  const wanted = edges.left + width > pageWidth ? edges.right - width : edges.left;
  return { top: edges.bottom + tokens.space[1], left: Math.min(Math.max(wanted, 0), pageWidth - width) };
}

/**
 * Escape closes the menu back to its trigger, and so does Tab past its last control or Shift+Tab before its first, which
 * would otherwise take the focus to the end of the page.
 */
function onPanelKey(event: KeyboardEvent<HTMLDivElement>, close: (toTrigger: boolean) => void) {
  if (event.key !== 'Escape' && event.key !== 'Tab') return;
  if (event.key === 'Tab') {
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input')];
    const edge = event.shiftKey ? controls[0] : controls.at(-1);
    if (edge === undefined || document.activeElement !== edge) return;
  }
  event.preventDefault();
  close(true);
}

/** As it opens, the focus on its first control; while open, a press elsewhere, a scroll of the page or a new size closes it. */
function useClosingElsewhere(isOpen: boolean, trigger: RefObject<HTMLButtonElement | null>, panel: RefObject<HTMLDivElement | null>, closed: () => void) {
  // Only as it opens: the listeners below are set again at each change typed, and must not take the focus from the field.
  useEffect(() => {
    if (isOpen) panel.current?.querySelector<HTMLElement>('button, input')?.focus();
  }, [isOpen, panel]);
  useEffect(() => {
    if (!isOpen) return undefined;
    const elsewhere = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && (panel.current?.contains(target) === true || trigger.current?.contains(target) === true)) return;
      closed();
    };
    document.addEventListener('pointerdown', elsewhere);
    document.addEventListener('scroll', elsewhere, true);
    window.addEventListener('resize', closed);
    return () => {
      document.removeEventListener('pointerdown', elsewhere);
      document.removeEventListener('scroll', elsewhere, true);
      window.removeEventListener('resize', closed);
    };
  }, [isOpen, trigger, panel, closed]);
}

/**
 * Open or not, and where: opened by its trigger; closed by Escape, a press or the focus elsewhere, a scroll or a new size.
 * As OverflowMenu's, but a dialog of form controls, portalled so a header that scrolls sideways never cuts it.
 */
function usePanel(onClose: (() => void) | undefined) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const isOpen = place !== null;
  const closed = () => {
    setPlace(null);
    onClose?.();
  };
  useClosingElsewhere(isOpen, trigger, panel, closed);
  const open = () => { if (trigger.current !== null) setPlace(placeOf(trigger.current, window.innerWidth)); };
  const close = (toTrigger: boolean) => {
    closed();
    if (toTrigger) trigger.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => onPanelKey(event, close);
  // Clear goes with the filter it clears: the focus stays in the menu, so Escape still closes it.
  const focusPanel = () => panel.current?.focus();
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (event.currentTarget.contains(next) || trigger.current?.contains(next) === true)) return;
    close(false);
  };
  return { trigger, panel, place, isOpen, open, close, onKeyDown, onBlur, focusPanel };
}

/** The column's order, either way, its filter, and Clear while a filter is in force. */
function MenuBody<Row>({ column, filtered, rows, sort, onSort, filter, onFilter, onCleared }: ColumnMenuProps<Row> & { onCleared: () => void }) {
  const direction = sort?.key === column.key ? sort.direction : undefined;
  return (
    <>
      {column.sortValue === undefined ? null : (
        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" size="small" icon="sortAscending" isPressed={direction === 'ascending'} onClick={() => onSort({ key: column.key, direction: 'ascending' })}>
            {t('ui.dataTable.sortAscending')}
          </Button>
          <Button variant="subtle" size="small" icon="sortDescending" isPressed={direction === 'descending'} onClick={() => onSort({ key: column.key, direction: 'descending' })}>
            {t('ui.dataTable.sortDescending')}
          </Button>
        </div>
      )}
      {filtered === undefined ? null : <FilterControls filtered={filtered} rows={rows} filter={filter} onFilter={onFilter} />}
      {isOn(filter) ? (
        <div className="flex">
          <Button variant="text" size="small" onClick={() => { onFilter(undefined); onCleared(); }}>{t('ui.dataTable.clearColumn')}</Button>
        </div>
      ) : null}
    </>
  );
}

/** The trigger's name: the column, and whether it is filtered and sorted. */
function triggerName<Row>({ column, filter, sort }: ColumnMenuProps<Row>): string {
  const direction = sort?.key === column.key ? sort.direction : undefined;
  return [
    t('ui.dataTable.columnMenu', { column: column.header }),
    ...(isOn(filter) ? [t('ui.dataTable.filtered')] : []),
    ...(direction === undefined ? [] : [t('ui.dataTable.sorted', { direction: t(`ui.dataTable.${direction}`) })]),
  ].join(', ');
}

/** The trigger's face: the filter icon, or the column's name with its order and a filter icon while filtered. */
function TriggerFace<Row>({ look, column, filter, sort }: ColumnMenuProps<Row>) {
  if (look === 'icon') return <Icon name="filter" size="sm" />;
  const direction = sort?.key === column.key ? sort.direction : undefined;
  return (
    <>
      {column.header}
      {direction === undefined ? null : <Icon name={direction === 'ascending' ? 'sortAscending' : 'sortDescending'} size="sm" />}
      {isOn(filter) ? <Icon name="filter" size="sm" /> : null}
    </>
  );
}

/**
 * A column's menu (owner, 9 Nov: every column filtered by its type, from its header): sort either way, its filter by
 * kind, and Clear. A dialog on a raised panel over the page, so a header that scrolls sideways never cuts it; opened by
 * a press, Enter, Space or the down arrow, with the focus on its first control; Escape closes it back to its trigger.
 */
export function ColumnMenu<Row>(props: ColumnMenuProps<Row>) {
  const { trigger, panel, place, isOpen, open, close, onKeyDown, onBlur, focusPanel } = usePanel(props.onClose);
  const panelId = useId();
  const isActive = isOn(props.filter) || (props.look === 'words' && props.sort?.key === props.column.key);
  return (
    <>
      <button ref={trigger} type="button" data-column-menu={props.column.key} aria-label={triggerName(props)} aria-haspopup="dialog" aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined} onClick={() => (isOpen ? close(false) : open())}
        onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); open(); } }}
        className={cx(props.look === 'icon' ? ICON_TRIGGER : WORDS_TRIGGER, isActive ? 'text-content' : 'text-content-muted')}>
        <TriggerFace {...props} />
      </button>
      {place === null ? null : createPortal(
        <div ref={panel} id={panelId} role="dialog" aria-label={t('ui.dataTable.columnMenu', { column: props.column.header })} tabIndex={-1}
          style={place} className={PANEL} onKeyDown={onKeyDown} onBlur={onBlur}>
          <MenuBody {...props} onCleared={focusPanel} />
        </div>,
        document.body,
      )}
    </>
  );
}
