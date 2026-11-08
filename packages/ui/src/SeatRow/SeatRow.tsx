import { t } from '@rivr/i18n';
import { cx } from '../internal/classes.ts';

export interface SeatRowProps {
  /** The seat's number, 1 to 9. */
  number: number;
  /** Who sits there; none for an open seat, which says Open. */
  name?: string | undefined;
  /** At the right: the call time left, "2 h 56 min", or "Call time done". */
  meta?: string | undefined;
  /** What the player asks for, "Top-up" or "Wants +1 h": a gold dot and gold words in place of the call time. */
  request?: string | undefined;
  /** The staff member's density (console v3): 42 px rows, or 34 px compact, at a desk. */
  density?: 'comfortable' | 'compact';
  /** Opens the seat: the player's sheet, or seating someone in an open seat. */
  onSelect: () => void;
}

/**
 * One seat in a table's list on the live floor (console v3): its number, who sits there, and their call time left, or
 * what they ask for with a gold dot. The whole row is one button, read as "Seat 2, Vidya Chadha, Top-up". 44 px below
 * 1180 px (decision 0282).
 */
export function SeatRow({ number, name, meta, request, density = 'comfortable', onSelect }: SeatRowProps) {
  const who = name ?? t('ui.console.seatRow.open');
  const aside = request ?? meta;
  return (
    <button type="button" onClick={onSelect} aria-label={[t('ui.console.seatRow.seat', { number }), who, aside].filter(Boolean).join(', ')}
      className={cx('flex min-h-touch w-full items-center gap-3 rounded-md px-3 text-start font-text transition-colors hover:bg-subtle',
        'focus-visible:outline-2 focus-visible:outline-focus',
        density === 'compact' ? 'tablet:min-h-row-compact' : 'tablet:min-h-row')}>
      <span aria-hidden="true" className="w-5 shrink-0 text-12 text-content-muted tabular-nums">{number}</span>
      <span aria-hidden="true" className={cx('min-w-0 flex-1 truncate text-14', name === undefined ? 'text-content-muted' : 'text-content')}>{who}</span>
      {aside === undefined ? null : (
        <span aria-hidden="true" className={cx('flex shrink-0 items-center gap-2 text-12 whitespace-nowrap', request === undefined ? 'text-content-muted' : 'text-gold')}>
          {request === undefined ? null : <span className="size-pip rounded-full bg-action" />}
          {aside}
        </span>
      )}
    </button>
  );
}
