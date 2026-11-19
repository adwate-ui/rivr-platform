import { t } from '@rivr/i18n';
import { cx } from '../internal/classes.ts';
import { MemberLink } from '../MemberLink/MemberLink.tsx';

export interface SeatRowProps {
  /** The seat's number, 1 to 9. */
  number: number;
  /** Who sits there; none for an open seat, which says Open. */
  name?: string | undefined;
  /** Whose account the name opens, through `MemberLink`. */
  memberId?: string | undefined;
  /** At the right: the call time left, "2 h 56 min", or "Call time done". */
  meta?: string | undefined;
  /** What the player asks for, "Top-up" or "Wants +1 h": a gold dot and gold words in place of the call time. */
  request?: string | undefined;
  /** The staff member's density (console v3): 42 px rows, or 34 px compact, at a desk. */
  density?: 'comfortable' | 'compact';
  /** Opens the seat: the player's sheet, or seating someone in an open seat. */
  onSelect: () => void;
}

/** Who sits there: their name, a link to their account with `memberId`; or Open, muted. */
function Who({ name, memberId }: Pick<SeatRowProps, 'name' | 'memberId'>) {
  if (name === undefined) return <span aria-hidden="true" className="relative min-w-0 flex-1 truncate text-14 text-content-muted pointer-events-none">{t('ui.console.seatRow.open')}</span>;
  if (memberId === undefined) return <span aria-hidden="true" className="relative min-w-0 flex-1 truncate text-14 text-content pointer-events-none">{name}</span>;
  return <span className="relative min-w-0 flex-1 truncate text-14 text-content pointer-events-none"><MemberLink memberId={memberId}>{name}</MemberLink></span>;
}

/**
 * One seat in a table's list on the live floor (console v3): its number, who sits there, and their call time left, or
 * what they ask for with a gold dot. The row's button covers it, read as "Seat 2, Vidya Chadha, Top-up"; the name above it
 * is the player's own link to their account (owner, 19 Nov), so a click on the name opens Members and anywhere else the
 * seat. The button comes first, then the name, for Tab. 44 px below 1180 px (decision 0282).
 */
export function SeatRow({ number, name, memberId, meta, request, density = 'comfortable', onSelect }: SeatRowProps) {
  const aside = request ?? meta;
  return (
    <div className={cx('relative isolate flex min-h-touch w-full items-center gap-3 px-3 font-text',
      density === 'compact' ? 'tablet:min-h-row-compact' : 'tablet:min-h-row')}>
      <button type="button" onClick={onSelect} aria-label={[t('ui.console.seatRow.seat', { number }), name ?? t('ui.console.seatRow.open'), aside].filter(Boolean).join(', ')}
        className="absolute inset-0 rounded-md transition-colors hover:bg-subtle focus-visible:outline focus-visible:outline-focus" />
      <span aria-hidden="true" className="relative w-5 shrink-0 text-12 text-content-muted tabular-nums pointer-events-none">{number}</span>
      <Who name={name} memberId={memberId} />
      {aside === undefined ? null : (
        <span aria-hidden="true" className={cx('relative flex shrink-0 items-center gap-2 text-12 whitespace-nowrap pointer-events-none', request === undefined ? 'text-content-muted' : 'text-gold')}>
          {request === undefined ? null : <span className="size-pip rounded-full bg-action" />}
          {aside}
        </span>
      )}
    </div>
  );
}
