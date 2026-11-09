import { t } from '@rivr/i18n';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

/** A seat on the tile's bar: open, someone seated, or someone who needs the floor (a request, a top-up, leaving). */
export type TileSeat = 'open' | 'seated' | 'needsYou';

export interface TableTileProps {
  /** "Table 1". */
  name: string;
  /** "50/100". */
  stake: string;
  /** Each seat in seat order, the bar's segments: nine at a full table. */
  seats: readonly TileSeat[];
  /** A table not running tonight: "Closed" and `openAction` in place of the bar. */
  isClosed?: boolean;
  /** On a closed table: the action that opens it, as `<Button variant="subtle" size="small">Open table</Button>`. */
  openAction?: ReactNode;
  /** Its seats listed under it. */
  isExpanded: boolean;
  /** A press anywhere on the tile but ⋯ shows or hides its seats. */
  onToggle: () => void;
  /** ⋯: the table's settings. */
  onSettings: () => void;
  /** The seats, as `SeatRow`s, shown while expanded. */
  children?: ReactNode;
  /** Brought into the middle of the view as it mounts or is asked: the table a link pointed at (a member's Show). */
  isScrolledTo?: boolean;
}

// An open seat is an outline at 4.37:1 against the tile, not a fill nearly the tile's own colour (WCAG 1.4.11).
const SEGMENT: Record<TileSeat, string> = { open: 'border border-control', seated: 'bg-content-muted', needsYou: 'bg-action' };

function count(seats: readonly TileSeat[], state: TileSeat): number {
  return seats.filter((seat) => seat === state).length;
}

/** "2 need you", in gold with its dot; "1 needs you" for one. */
function needsLine(needs: number): string {
  return needs === 1 ? t('ui.console.tableTile.needsYouOne') : t('ui.console.tableTile.needsYou', { count: needs });
}

/**
 * The bar and the line under it: how many sit there, then who needs the floor or Show seats. The line is part of the
 * button's name, as it shows (WCAG 2.5.3); the bar is read out in words.
 */
function Occupancy({ seats, isExpanded, summaryId, lineId }: { seats: readonly TileSeat[]; isExpanded: boolean; summaryId: string; lineId: string }) {
  const needs = count(seats, 'needsYou');
  const seated = count(seats, 'seated') + needs;
  return (
    <>
      <span aria-hidden="true" className="flex gap-1">
        {seats.map((seat, index) => <span key={index} className={cx('h-pip min-w-0 flex-1 rounded-sm', SEGMENT[seat])} />)}
      </span>
      <span id={summaryId} className="sr-only">{needs === 1 ? t('ui.console.tableTile.barOne', { seated: count(seats, 'seated'), open: count(seats, 'open') }) : t('ui.console.tableTile.bar', { seated: count(seats, 'seated'), needs, open: count(seats, 'open') })}</span>
      <span id={lineId} className="flex items-center justify-between gap-3 text-13 leading-snug">
        <span className="text-content-muted">{t('ui.console.tableTile.seated', { seated, total: seats.length })}</span>
        {/* A space between, so the button reads "6 of 9 seated 2 need you"; a flex row draws none. */}
        {' '}
        {needs > 0 ? (
          <span className="flex items-center gap-2 text-gold"><span aria-hidden="true" className="size-pip rounded-full bg-action" />{needsLine(needs)}</span>
        ) : (
          <span className="text-content-muted">{t(isExpanded ? 'ui.console.tableTile.hideSeats' : 'ui.console.tableTile.showSeats')}</span>
        )}
      </span>
    </>
  );
}

/**
 * The keyboard's button for the seats: named with the table and what the line under the bar shows (WCAG 2.5.3), the bar
 * read out as its description. No handler of its own: its press reaches the head's, so the seats toggle once.
 */
function SeatsButton({ seats, nameId, seatsId, isOpen }: { seats: readonly TileSeat[]; nameId: string; seatsId: string; isOpen: boolean }) {
  const summaryId = useId();
  const lineId = useId();
  return (
    <button type="button" aria-expanded={isOpen} aria-controls={isOpen ? seatsId : undefined} aria-labelledby={`${nameId} ${lineId}`}
      aria-describedby={summaryId} className="-mx-1 flex flex-col gap-3 rounded-md px-1 text-start font-text focus-visible:outline-2 focus-visible:outline-focus">
      <Occupancy seats={seats} isExpanded={isOpen} summaryId={summaryId} lineId={lineId} />
    </button>
  );
}

/** A tile brought into the middle of the view while `isScrolledTo` turns on. */
function useScrolledTo(isScrolledTo: boolean) {
  const tile = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isScrolledTo) tile.current?.scrollIntoView({ block: 'center' });
  }, [isScrolledTo]);
  return tile;
}

/**
 * One table on the live floor (console v3): its name and stake, ⋯ for its settings, a bar of its seats (open, seated, in
 * gold the ones who need the floor) and how many need it. A tile that needs the floor has a gold inner ring (decision 0463).
 * A press on the tile shows its seats under it; the keyboard's button is the bar's line, which says whether they show.
 * A closed table says so, with the action that opens it.
 */
export function TableTile({ name, stake, seats, isClosed = false, openAction, isExpanded, onToggle, onSettings, children, isScrolledTo }: TableTileProps) {
  const nameId = useId();
  const tile = useScrolledTo(isScrolledTo === true);
  const seatsId = useId();
  const needsYou = !isClosed && seats.includes('needsYou');
  const isOpen = isExpanded && !isClosed;
  return (
    <div ref={tile} role="group" aria-labelledby={nameId} className={cx('overflow-hidden rounded-lg bg-raised', needsYou && 'inset-ring inset-ring-gold-edge')}>
      {/* A press anywhere on the head shows or hides the seats, as the button inside it does from the keyboard; ⋯ keeps its own. */}
      <div onClick={isClosed ? undefined : onToggle} className={cx('flex flex-col gap-3 px-4 pt-4 pb-3', !isClosed && 'cursor-pointer transition-colors hover:bg-subtle')}>
        <div className="flex items-center gap-2">
          <h3 id={nameId} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 font-text leading-snug">
            <span className="truncate text-15 font-semibold">{name}</span>
            {/* A space between, so the name reads "Table 1 50/100"; a flex row draws none. */}
            {' '}
            <span className="shrink-0 text-13 font-regular text-content-muted">{stake}</span>
          </h3>
          <button type="button" aria-label={t('ui.console.tableTile.settings', { table: name })}
            onClick={(event) => { event.stopPropagation(); onSettings(); }}
            className="-my-2 -mr-2 flex size-touch shrink-0 items-center justify-center rounded-md text-content-muted transition-colors hover:bg-subtle-hover hover:text-content focus-visible:outline-2 focus-visible:outline-focus tablet:size-8">
            <Icon name="overflow" size="sm" />
          </button>
        </div>
        {isClosed ? (
          <div className="flex min-h-touch items-center justify-between gap-3 tablet:min-h-8">
            <span className="text-13 text-content-muted">{t('ui.console.tableTile.closed')}</span>
            {openAction}
          </div>
        ) : (
          <SeatsButton seats={seats} nameId={nameId} seatsId={seatsId} isOpen={isOpen} />
        )}
      </div>
      {isOpen ? <div id={seatsId} className="border-t border-subtle px-2 pt-1 pb-2">{children}</div> : null}
    </div>
  );
}
